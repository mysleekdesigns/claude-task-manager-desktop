/**
 * Fix Service
 *
 * High-level service for managing automated code fixes on tasks.
 * Coordinates between the fix agent pool and database.
 */

import { BrowserWindow } from 'electron';
import { databaseService } from './database.js';
import { fixAgentPool } from './fix-agent-pool.js';
import { reviewAgentPool } from './review-agent-pool.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type {
  FixType,
  FixStatus,
  FixProgressResponse,
  ReviewFinding,
  FixVerificationResult,
  ReviewType,
} from '../../src/types/ipc.js';

const logger = createIPCLogger('FixService');

/**
 * Configuration for fix verification workflow.
 */
const VERIFICATION_CONFIG = {
  /** Minimum score increase required for verification to pass */
  MIN_SCORE_IMPROVEMENT: 10,
  /** If post-fix score exceeds this threshold, verification passes regardless of improvement */
  MIN_POST_FIX_SCORE: 70,
  /** Maximum number of retry attempts allowed */
  MAX_RETRIES: 2,
};

/**
 * FixService provides a high-level interface for automated code fixes.
 *
 * Features:
 * - Start fixes for specific review findings
 * - Track fix progress
 * - Cancel running fixes
 * - Handle fix completion and results
 */
class FixService {
  /** Reference to main window for IPC events */
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window for IPC events.
   *
   * @param window - The main BrowserWindow instance
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    fixAgentPool.setMainWindow(window);
  }

  /**
   * Start a fix for a specific type of findings.
   *
   * This will:
   * 1. Validate the task exists
   * 2. Get the project path from the task
   * 3. Create a TaskFix record in the database
   * 4. Start the fix agent
   *
   * @param taskId - The task ID to fix
   * @param fixType - Type of fix to perform (security, quality, testing)
   * @param findings - Array of findings to fix
   */
  async startFix(
    taskId: string,
    fixType: FixType,
    findings: ReviewFinding[]
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Get task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, targetPath: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.project?.targetPath) {
      throw new Error(`Task's project has no target path: ${taskId}`);
    }

    // Create or update TaskFix record with IN_PROGRESS status
    const existingFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (existingFix) {
      await prisma.taskFix.update({
        where: { id: existingFix.id },
        data: {
          status: 'IN_PROGRESS',
          findings: JSON.stringify(findings),
          summary: null,
          patch: null,
          researchNotes: null,
          startedAt: new Date(),
          completedAt: null,
        },
      });
    } else {
      await prisma.taskFix.create({
        data: {
          taskId,
          fixType,
          status: 'IN_PROGRESS',
          findings: JSON.stringify(findings),
          startedAt: new Date(),
        },
      });
    }

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for fix events');
    }

    // Get the TaskFix record we just created/updated
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      throw new Error(`TaskFix record not found for ${taskId}:${fixType}`);
    }

    // Start the fix agent
    await fixAgentPool.startFix({
      taskId,
      fixType,
      fixId: taskFix.id,
      projectPath: task.project.targetPath,
      findings,
    });

    logger.info(`Started ${fixType} fix for task ${taskId}`);
  }

  /**
   * Start fixes for multiple types of findings.
   *
   * This will create TaskFix records for each type and start all fix agents.
   *
   * @param taskId - The task ID to fix
   * @param findingsByType - Map of fix types to their findings
   */
  async startAllFixes(
    taskId: string,
    findingsByType: Map<FixType, ReviewFinding[]>
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Get task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, targetPath: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.project?.targetPath) {
      throw new Error(`Task's project has no target path: ${taskId}`);
    }

    // Create TaskFix records for each type
    for (const [fixType, findings] of findingsByType) {
      const existingFix = await prisma.taskFix.findUnique({
        where: {
          taskId_fixType: { taskId, fixType },
        },
      });

      if (existingFix) {
        await prisma.taskFix.update({
          where: { id: existingFix.id },
          data: {
            status: 'IN_PROGRESS',
            findings: JSON.stringify(findings),
            summary: null,
            patch: null,
            researchNotes: null,
            startedAt: new Date(),
            completedAt: null,
          },
        });
      } else {
        await prisma.taskFix.create({
          data: {
            taskId,
            fixType,
            status: 'IN_PROGRESS',
            findings: JSON.stringify(findings),
            startedAt: new Date(),
          },
        });
      }
    }

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for fix events');
    }

    // Convert Map to FindingsByType object
    const findingsObj: {
      security?: ReviewFinding[];
      quality?: ReviewFinding[];
      performance?: ReviewFinding[];
    } = {};
    for (const [fixType, findings] of findingsByType) {
      findingsObj[fixType] = findings;
    }

    // Start all fix agents
    await fixAgentPool.startAllFixes(
      taskId,
      task.project.targetPath,
      findingsObj
    );

    logger.info(
      `Started ${String(findingsByType.size)} fixes for task ${taskId}`
    );
  }

  /**
   * Get the progress of a fix for a task.
   *
   * @param taskId - The task ID to query
   * @param fixType - Type of fix to query
   * @returns Fix progress response or null if not found
   */
  async getFixProgress(
    taskId: string,
    fixType: FixType
  ): Promise<FixProgressResponse | null> {
    const prisma = databaseService.getClient();

    // Get TaskFix record
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      return null;
    }

    // Get current activity from the agent pool if running
    const currentActivity = fixAgentPool.getCurrentActivity(taskId, fixType);

    const response: FixProgressResponse = {
      taskId,
      fixType: taskFix.fixType as FixType,
      status: taskFix.status as FixStatus,
    };

    // Only include optional properties if they have values
    if (taskFix.summary) {
      response.summary = taskFix.summary;
    }

    if (currentActivity) {
      response.currentActivity = currentActivity;
    }

    return response;
  }

  /**
   * Cancel a running fix for a task.
   *
   * @param taskId - The task ID to cancel fix for
   * @param fixType - Type of fix to cancel
   */
  async cancelFix(taskId: string, fixType: FixType): Promise<void> {
    const prisma = databaseService.getClient();

    // Cancel the agent
    fixAgentPool.cancelFix(taskId, fixType);

    // Update TaskFix status to FAILED
    await prisma.taskFix.updateMany({
      where: {
        taskId,
        fixType,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'FAILED',
        summary: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    logger.info(`Cancelled ${fixType} fix for task ${taskId}`);
  }

  /**
   * Handle completion of a fix.
   *
   * Called by the fix agent pool when a fix finishes.
   *
   * @param taskId - Task ID
   * @param fixType - Type of fix completed
   * @param result - Result of the fix operation
   */
  async handleFixComplete(
    taskId: string,
    fixType: FixType,
    result: {
      success: boolean;
      summary?: string;
      patch?: string;
      researchNotes?: string;
    }
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Update the TaskFix record
    await prisma.taskFix.update({
      where: {
        taskId_fixType: { taskId, fixType },
      },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        summary: result.summary ?? (result.success ? 'Fix completed' : 'Fix failed'),
        patch: result.patch ?? null,
        researchNotes: result.researchNotes ?? null,
        completedAt: new Date(),
      },
    });

    logger.info(
      `${fixType} fix ${result.success ? 'completed' : 'failed'} for task ${taskId}`
    );

    // Emit completion event
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:complete:${taskId}`, {
        taskId,
        fixType,
        success: result.success,
        summary: result.summary,
      });
    }
  }

  /**
   * Start verification after a fix agent completes.
   *
   * This will:
   * 1. Get the original review data to find pre-fix score
   * 2. Update TaskFix status to 'VERIFYING'
   * 3. Run a single review of the same type using ReviewAgentPool
   * 4. The review result will be handled by handleVerificationComplete
   *
   * @param taskId - The task ID being verified
   * @param fixType - Type of fix to verify (maps to ReviewType)
   */
  async startVerification(taskId: string, fixType: FixType): Promise<void> {
    const prisma = databaseService.getClient();

    // Get the TaskFix record
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      throw new Error(`TaskFix not found for ${taskId}:${fixType}`);
    }

    // Get the original review to capture pre-fix score
    const reviewType: ReviewType = fixType; // FixType and ReviewType share the same values
    const originalReview = await prisma.taskReview.findUnique({
      where: {
        taskId_reviewType: { taskId, reviewType },
      },
    });

    const preFixScore = originalReview?.score ?? 0;

    // Update TaskFix to VERIFYING status and store pre-fix score
    await prisma.taskFix.update({
      where: { id: taskFix.id },
      data: {
        status: 'VERIFYING',
        preFixScore,
      },
    });

    logger.info(`Starting verification for ${fixType} fix on task ${taskId} (pre-fix score: ${String(preFixScore)})`);

    // Get task details for the review
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, targetPath: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.project?.targetPath) {
      throw new Error(`Task's project has no target path: ${taskId}`);
    }

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for verification events');
    }

    // Emit progress event for verification starting
    this.mainWindow.webContents.send(`fix:progress:${taskId}:${fixType}`, {
      taskId,
      fixType,
      status: 'VERIFYING' as FixStatus,
      phase: 'verify',
      currentActivity: {
        message: `${fixType}: Running targeted verification review...`,
        timestamp: Date.now(),
      },
    });

    // Get original findings from TaskFix for targeted verification
    const originalFindings = JSON.parse(taskFix.findings || '[]') as ReviewFinding[];

    // Build verification-specific task description with original findings
    const verificationContext = this.buildVerificationPrompt(
      fixType,
      originalFindings,
      task.description || task.title
    );

    // Run a single review of the same type with targeted verification context
    await reviewAgentPool.startReviewAgent(
      {
        taskId,
        reviewType,
        projectPath: task.project.targetPath,
        taskDescription: verificationContext,
      },
      this.mainWindow
    );

    logger.info(
      `Targeted verification review started for ${fixType} fix on task ${taskId} ` +
      `(checking ${String(originalFindings.length)} original findings)`
    );
  }

  /**
   * Handle completion of a verification review.
   *
   * Called when the verification review finishes. This method:
   * 1. Gets the pre-fix score from TaskFix record
   * 2. Performs finding-by-finding comparison
   * 3. Calculates score improvement and regression detection
   * 4. Determines if verification passed using strict rules
   * 5. Updates TaskFix with verification results
   * 6. Emits verification result event
   *
   * STRICT PASS RULES:
   * - If postFixScore < preFixScore → ALWAYS FAIL (regression)
   * - If new findings introduced that weren't in original → FAIL
   * - Only pass if at least one original finding was fixed
   *
   * @param taskId - Task ID
   * @param fixType - Type of fix that was verified
   * @param postFixScore - Score from the verification review
   * @param postFixFindings - Remaining findings from verification review
   */
  async handleVerificationComplete(
    taskId: string,
    fixType: FixType,
    postFixScore: number,
    postFixFindings: ReviewFinding[]
  ): Promise<void> {
    logger.info(
      `handleVerificationComplete called for ${fixType} on task ${taskId} with score ${String(postFixScore)}`
    );

    const prisma = databaseService.getClient();

    // Get the TaskFix record with pre-fix score and original findings
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      logger.error(`TaskFix not found for verification completion: ${taskId}:${fixType}`);
      return;
    }

    const preFixScore = taskFix.preFixScore ?? 0;
    const scoreImprovement = postFixScore - preFixScore;
    const originalFindings = JSON.parse(taskFix.findings || '[]') as ReviewFinding[];

    // === FINDING-BY-FINDING COMPARISON ===

    // Categorize post-fix findings
    let originalFindingsRemaining = 0;
    let newFindingsIntroduced = 0;

    for (const finding of postFixFindings) {
      if (this.isNewFinding(finding)) {
        // Explicitly marked as new by the review
        newFindingsIntroduced++;
      } else if (this.isOriginalFinding(finding, originalFindings)) {
        // This is an original finding that's still present
        originalFindingsRemaining++;
      } else {
        // Not clearly marked as new, but doesn't match originals
        // Treat as a new finding (regression)
        newFindingsIntroduced++;
      }
    }

    // Calculate how many original findings were fixed
    const fixedCount = originalFindings.length - originalFindingsRemaining;

    // === STRICT PASS/FAIL DETERMINATION ===

    // Rule 1: Score dropped = ALWAYS FAIL (regression)
    const scoreDropped = scoreImprovement < 0;

    // Rule 2: New findings introduced = FAIL (regression)
    const hasNewIssues = newFindingsIntroduced > 0;

    // Rule 3: Must have fixed at least one thing
    const fixedSomething = fixedCount > 0;

    // Rule 4: Standard thresholds (only apply if no regression)
    const meetsThresholds =
      scoreImprovement >= VERIFICATION_CONFIG.MIN_SCORE_IMPROVEMENT ||
      postFixScore >= VERIFICATION_CONFIG.MIN_POST_FIX_SCORE;

    // Detect regression
    const hasRegression = scoreDropped || hasNewIssues;

    // STRICT: Fail if ANY regression, regardless of other improvements
    // Otherwise, must fix something AND meet thresholds
    const passed = !hasRegression && fixedSomething && meetsThresholds;

    // === BUILD VERIFICATION SUMMARY ===

    let verificationSummary: string;

    if (hasRegression) {
      // Regression detected - always fail with clear message
      const regressionReasons: string[] = [];
      if (scoreDropped) {
        regressionReasons.push(`score decreased (${String(preFixScore)} → ${String(postFixScore)})`);
      }
      if (hasNewIssues) {
        regressionReasons.push(`${String(newFindingsIntroduced)} new issue(s) introduced`);
      }
      verificationSummary = `VERIFICATION FAILED - REGRESSION DETECTED: ${regressionReasons.join(', ')}. ` +
        `Fixed ${String(fixedCount)}/${String(originalFindings.length)} original issues, but fix caused new problems.`;
    } else if (!fixedSomething) {
      // No regression, but nothing was fixed
      verificationSummary = `VERIFICATION FAILED: No original issues were fixed. ` +
        `All ${String(originalFindings.length)} original finding(s) still present. ` +
        `Score: ${String(preFixScore)} → ${String(postFixScore)}.`;
    } else if (!meetsThresholds) {
      // Fixed something but didn't meet score thresholds
      verificationSummary = `VERIFICATION FAILED: Fixed ${String(fixedCount)}/${String(originalFindings.length)} issues, ` +
        `but score improvement insufficient. Score: ${String(preFixScore)} → ${String(postFixScore)} ` +
        `(+${String(scoreImprovement)}). Minimum: +${String(VERIFICATION_CONFIG.MIN_SCORE_IMPROVEMENT)} or score >= ${String(VERIFICATION_CONFIG.MIN_POST_FIX_SCORE)}.`;
    } else {
      // Passed all checks
      verificationSummary = `VERIFICATION PASSED: Fixed ${String(fixedCount)}/${String(originalFindings.length)} issues. ` +
        `Score improved from ${String(preFixScore)} to ${String(postFixScore)} (+${String(scoreImprovement)}). ` +
        `No regressions detected.`;
    }

    // Apply regression penalty to score for display purposes
    // This doesn't affect the stored postFixScore, just shows the penalty
    const adjustedScore = hasNewIssues
      ? Math.max(0, postFixScore - (newFindingsIntroduced * 20))
      : postFixScore;

    logger.info(
      `Verification analysis for ${fixType} on task ${taskId}: ` +
      `fixed=${String(fixedCount)}/${String(originalFindings.length)}, ` +
      `remaining=${String(originalFindingsRemaining)}, ` +
      `newIssues=${String(newFindingsIntroduced)}, ` +
      `hasRegression=${String(hasRegression)}, ` +
      `score=${String(preFixScore)}->${String(postFixScore)} (adjusted=${String(adjustedScore)})`
    );

    // Update TaskFix record with verification results
    await prisma.taskFix.update({
      where: { id: taskFix.id },
      data: {
        postFixScore,
        scoreImprovement,
        verificationSummary,
        postFixFindings: JSON.stringify(postFixFindings),
        status: passed ? 'VERIFIED_SUCCESS' : 'VERIFIED_FAILED',
        verifiedAt: new Date(),
      },
    });

    logger.info(
      `Verification ${passed ? 'PASSED' : 'FAILED'} for ${fixType} fix on task ${taskId}`
    );

    // Determine if retry is allowed
    const canRetry = !passed && taskFix.retryCount < VERIFICATION_CONFIG.MAX_RETRIES;

    // Emit verification result event
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const verificationResult: FixVerificationResult = {
        preFixScore,
        postFixScore,
        scoreImprovement,
        remainingFindings: postFixFindings,
        summary: verificationSummary,
        passed,
        // New fields for per-finding tracking
        fixedCount,
        originalFindingsRemaining,
        newFindingsIntroduced,
        hasRegression,
      };

      logger.info(
        `Emitting fix:verified and fix:progress events for ${fixType} on task ${taskId}`
      );

      this.mainWindow.webContents.send(`fix:verified:${taskId}:${fixType}`, {
        taskId,
        fixType,
        verification: verificationResult,
        canRetry,
        retryCount: taskFix.retryCount,
      });

      // Also send a progress update with the final status
      this.mainWindow.webContents.send(`fix:progress:${taskId}:${fixType}`, {
        taskId,
        fixType,
        status: passed ? 'VERIFIED_SUCCESS' as FixStatus : 'VERIFIED_FAILED' as FixStatus,
        phase: 'verify',
        verification: verificationResult,
        retryCount: taskFix.retryCount,
        canRetry,
        currentActivity: {
          message: verificationSummary,
          timestamp: Date.now(),
        },
      });
    } else {
      logger.error(
        `Cannot emit verification events for ${fixType} on task ${taskId}: ` +
        `mainWindow is ${this.mainWindow ? 'destroyed' : 'null'}`
      );
    }
  }

  /**
   * Retry a fix with remaining findings after a failed verification.
   *
   * This will:
   * 1. Get the TaskFix record and check retry count
   * 2. Get remaining findings from postFixFindings
   * 3. Increment retryCount
   * 4. Start fix again with only remaining findings
   *
   * @param taskId - Task ID to retry fix for
   * @param fixType - Type of fix to retry
   */
  async retryFix(taskId: string, fixType: FixType): Promise<void> {
    const prisma = databaseService.getClient();

    // Get the TaskFix record
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      throw new Error(`TaskFix not found for retry: ${taskId}:${fixType}`);
    }

    // Check retry count
    if (taskFix.retryCount >= VERIFICATION_CONFIG.MAX_RETRIES) {
      throw new Error(
        `Maximum retries (${String(VERIFICATION_CONFIG.MAX_RETRIES)}) exceeded for ${fixType} fix on task ${taskId}`
      );
    }

    // Get remaining findings from postFixFindings
    const remainingFindings = JSON.parse(taskFix.postFixFindings || '[]') as ReviewFinding[];

    if (remainingFindings.length === 0) {
      throw new Error(`No remaining findings to fix for ${taskId}:${fixType}`);
    }

    // Increment retry count
    await prisma.taskFix.update({
      where: { id: taskFix.id },
      data: {
        retryCount: taskFix.retryCount + 1,
        status: 'IN_PROGRESS',
        postFixScore: null,
        scoreImprovement: null,
        verificationSummary: null,
        postFixFindings: '[]',
        verifiedAt: null,
      },
    });

    logger.info(
      `Retrying ${fixType} fix for task ${taskId} (attempt ${String(taskFix.retryCount + 1)}/${String(VERIFICATION_CONFIG.MAX_RETRIES + 1)}) ` +
      `with ${String(remainingFindings.length)} remaining findings`
    );

    // Start fix again with remaining findings
    await this.startFix(taskId, fixType, remainingFindings);
  }

  /**
   * Get the verification result for a fix.
   *
   * @param taskId - Task ID to query
   * @param fixType - Type of fix to query
   * @returns FixVerificationResult or null if not found or not verified
   */
  async getVerificationResult(
    taskId: string,
    fixType: FixType
  ): Promise<FixVerificationResult | null> {
    const prisma = databaseService.getClient();

    // Get the TaskFix record
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      return null;
    }

    // Check if verification has been performed
    if (taskFix.verifiedAt === null || taskFix.postFixScore === null) {
      return null;
    }

    const remainingFindings = JSON.parse(taskFix.postFixFindings || '[]') as ReviewFinding[];
    const passed = taskFix.status === 'VERIFIED_SUCCESS';

    return {
      preFixScore: taskFix.preFixScore ?? 0,
      postFixScore: taskFix.postFixScore,
      scoreImprovement: taskFix.scoreImprovement ?? 0,
      remainingFindings,
      summary: taskFix.verificationSummary ?? '',
      passed,
    };
  }

  /**
   * Build a targeted verification prompt that instructs the review agent
   * to specifically check if the original findings were fixed.
   *
   * @param fixType - Type of fix being verified
   * @param originalFindings - Array of original findings to verify
   * @param taskContext - Original task description for context
   * @returns Verification prompt string
   */
  private buildVerificationPrompt(
    fixType: FixType,
    originalFindings: ReviewFinding[],
    taskContext: string
  ): string {
    // Format each finding with a unique ID for tracking
    const findingsText = originalFindings.map((finding, index) => {
      const findingId = `ORIG-${String(index + 1).padStart(2, '0')}`;
      const lines = [
        `${findingId}. [${finding.severity.toUpperCase()}] ${finding.title}`,
        `   Description: ${finding.description}`,
      ];
      if (finding.file) {
        lines.push(`   Location: ${finding.file}${finding.line ? `:${String(finding.line)}` : ''}`);
      }
      return lines.join('\n');
    }).join('\n\n');

    return `[STRICT TARGETED VERIFICATION REVIEW]

This is a STRICT VERIFICATION review. Your job is to verify whether each specific issue was ACTUALLY fixed.
DO NOT do a general code review - ONLY verify the ${String(originalFindings.length)} specific issue(s) listed below.

=============================================================================
ORIGINAL FINDINGS TO VERIFY (${fixType.toUpperCase()} issues)
=============================================================================

${findingsText || 'No specific findings recorded.'}

=============================================================================
STRICT VERIFICATION SCORING
=============================================================================

For EACH original finding above, determine if it was:
- FIXED (issue no longer exists) → +25 points per finding
- PARTIALLY FIXED (issue reduced but still present) → +10 points per finding
- NOT FIXED (issue still fully present) → 0 points
- REGRESSION (fix made it worse or introduced new issues) → -50 points per regression

Base score calculation:
- Start at 0
- Add points for each fixed/partially fixed finding
- Subtract 50 for EACH regression introduced
- Final score = min(100, max(0, total_points))

=============================================================================
REGRESSION DETECTION - CRITICAL
=============================================================================

A REGRESSION occurs when ANY of these are true:
1. The fix changed code that wasn't related to the original findings
2. The fix introduced NEW issues not present before (mark these as "[NEW]")
3. The fix removed functionality or broke existing behavior
4. The fix made the code MORE complex without actually fixing the issue
5. The fix moved the problem to a different location instead of fixing it

**If ANY regression is detected, include it in findings with "[NEW]" prefix in title**

=============================================================================
REQUIRED OUTPUT FORMAT - MUST FOLLOW EXACTLY
=============================================================================

For EACH original finding, you MUST classify it. Then output:

<review_json>
{
  "score": <calculated as described above>,
  "findings": [
    // Include ONLY:
    // 1. Original findings that are STILL PRESENT or PARTIALLY FIXED
    // 2. NEW issues introduced by the fix (prefix title with "[NEW]")

    // For still-present original findings, prefix description with "STILL PRESENT:" or "PARTIALLY FIXED:"
    // For new issues introduced, prefix title with "[NEW]"
  ]
}
</review_json>

=============================================================================
EXAMPLES
=============================================================================

EXAMPLE 1: 2 of 3 original issues fixed, no regressions
Score calculation: 2 * 25 = 50, plus 0 for unfixed = 50 points
<review_json>
{
  "score": 50,
  "findings": [
    {
      "severity": "high",
      "title": "SQL Injection Risk",
      "description": "STILL PRESENT: User input is still concatenated directly into SQL query",
      "file": "src/db/queries.ts",
      "line": 42
    }
  ]
}
</review_json>

EXAMPLE 2: All 4 issues fixed, no regressions
Score calculation: 4 * 25 = 100 points
<review_json>
{
  "score": 100,
  "findings": []
}
</review_json>

EXAMPLE 3: 1 issue fixed, but fix introduced 1 new issue (REGRESSION)
Score calculation: 1 * 25 = 25, minus 50 for regression = -25, clamped to 0
<review_json>
{
  "score": 0,
  "findings": [
    {
      "severity": "medium",
      "title": "Original Issue Title",
      "description": "STILL PRESENT: Original issue description",
      "file": "src/file.ts",
      "line": 10
    },
    {
      "severity": "high",
      "title": "[NEW] Memory Leak in Event Handler",
      "description": "NEW REGRESSION: The fix added an event listener that is never removed, causing memory leaks",
      "file": "src/file.ts",
      "line": 25
    }
  ]
}
</review_json>

EXAMPLE 4: 2 issues partially fixed
Score calculation: 2 * 10 = 20 points
<review_json>
{
  "score": 20,
  "findings": [
    {
      "severity": "medium",
      "title": "Missing Input Validation",
      "description": "PARTIALLY FIXED: Some validation added but edge cases still not handled",
      "file": "src/api.ts"
    },
    {
      "severity": "low",
      "title": "Error Messages Expose Details",
      "description": "PARTIALLY FIXED: Generic errors used in production but stack traces still logged",
      "file": "src/errors.ts"
    }
  ]
}
</review_json>

=============================================================================
TASK CONTEXT
=============================================================================
${taskContext}

=============================================================================
CRITICAL REQUIREMENTS
=============================================================================

1. You MUST include the <review_json>...</review_json> tags
2. For still-present findings, description MUST start with "STILL PRESENT:" or "PARTIALLY FIXED:"
3. For NEW issues introduced by fix, title MUST start with "[NEW]"
4. Score is based ONLY on fix success, NOT general code quality
5. ANY regression (new issues) should result in very low or zero score
6. Do NOT report issues unrelated to the original findings or the fix
7. This is verification of SPECIFIC fixes, not a general review`;
  }

  /**
   * Check if a finding appears to be from the original set.
   * Uses fuzzy matching on title and file location.
   *
   * @param finding - Finding to check
   * @param originalFindings - Original findings to compare against
   * @returns true if this appears to be an original finding still present
   */
  private isOriginalFinding(
    finding: ReviewFinding,
    originalFindings: ReviewFinding[]
  ): boolean {
    const normalizeTitle = (title: string) =>
      title.toLowerCase().replace(/^\[new\]\s*/i, '').replace(/^(still present|partially fixed):\s*/i, '').trim();

    const findingTitle = normalizeTitle(finding.title);
    const findingFile = finding.file?.toLowerCase() || '';

    return originalFindings.some(original => {
      const originalTitle = normalizeTitle(original.title);
      const originalFile = original.file?.toLowerCase() || '';

      // Check for title similarity (contains or substantial overlap)
      const titleMatch =
        findingTitle.includes(originalTitle) ||
        originalTitle.includes(findingTitle) ||
        this.calculateSimilarity(findingTitle, originalTitle) > 0.6;

      // If same file or no file specified, and titles are similar
      const fileMatch =
        !findingFile ||
        !originalFile ||
        findingFile.includes(originalFile) ||
        originalFile.includes(findingFile);

      return titleMatch && fileMatch;
    });
  }

  /**
   * Check if a finding is marked as a new issue introduced by the fix.
   *
   * @param finding - Finding to check
   * @returns true if this is a new issue (regression)
   */
  private isNewFinding(finding: ReviewFinding): boolean {
    const title = finding.title.toLowerCase();
    const description = finding.description.toLowerCase();

    return (
      title.startsWith('[new]') ||
      description.startsWith('new regression:') ||
      description.includes('introduced by') ||
      description.includes('caused by fix') ||
      description.includes('new issue')
    );
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance.
   *
   * @param a - First string
   * @param b - Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Initialize matrix with proper dimensions
    const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
      Array.from({ length: a.length + 1 }, () => 0)
    );

    // Fill first column
    for (let i = 0; i <= b.length; i++) {
      matrix[i]![0] = i;
    }

    // Fill first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    // Fill rest of matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const prevRow = matrix[i - 1]!;
        const currRow = matrix[i]!;

        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          currRow[j] = prevRow[j - 1]!;
        } else {
          currRow[j] = Math.min(
            prevRow[j - 1]! + 1, // substitution
            currRow[j - 1]! + 1, // insertion
            prevRow[j]! + 1     // deletion
          );
        }
      }
    }

    const maxLen = Math.max(a.length, b.length);
    const distance = matrix[b.length]![a.length]!;
    return 1 - distance / maxLen;
  }
}

// Export singleton instance
export const fixService = new FixService();
