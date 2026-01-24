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
        message: `${fixType}: Running verification review...`,
        timestamp: Date.now(),
      },
    });

    // Run a single review of the same type
    // Note: We directly start the review agent for just this review type
    await reviewAgentPool.startReviewAgent(
      {
        taskId,
        reviewType,
        projectPath: task.project.targetPath,
        taskDescription: `Verification review for ${fixType} fix: ${task.description || task.title}`,
      },
      this.mainWindow
    );

    logger.info(`Verification review started for ${fixType} fix on task ${taskId}`);
  }

  /**
   * Handle completion of a verification review.
   *
   * Called when the verification review finishes. This method:
   * 1. Gets the pre-fix score from TaskFix record
   * 2. Calculates score improvement
   * 3. Determines if verification passed
   * 4. Updates TaskFix with verification results
   * 5. Emits verification result event
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
    const prisma = databaseService.getClient();

    // Get the TaskFix record with pre-fix score
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

    // Determine if verification passed
    const passed =
      scoreImprovement >= VERIFICATION_CONFIG.MIN_SCORE_IMPROVEMENT ||
      postFixScore >= VERIFICATION_CONFIG.MIN_POST_FIX_SCORE;

    const verificationSummary = passed
      ? `Verification passed: Score improved from ${String(preFixScore)} to ${String(postFixScore)} (+${String(scoreImprovement)})`
      : `Verification failed: Score ${String(preFixScore)} -> ${String(postFixScore)} (${scoreImprovement >= 0 ? '+' : ''}${String(scoreImprovement)}). Minimum improvement: ${String(VERIFICATION_CONFIG.MIN_SCORE_IMPROVEMENT)} or score >= ${String(VERIFICATION_CONFIG.MIN_POST_FIX_SCORE)}`;

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
      `Verification ${passed ? 'passed' : 'failed'} for ${fixType} fix on task ${taskId}: ` +
      `score ${String(preFixScore)} -> ${String(postFixScore)} (${scoreImprovement >= 0 ? '+' : ''}${String(scoreImprovement)})`
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
      };

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
}

// Export singleton instance
export const fixService = new FixService();
