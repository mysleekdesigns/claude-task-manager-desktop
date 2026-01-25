/**
 * Fix Agent Pool Manager
 *
 * Manages a pool of concurrent AI fix agents that apply fixes based on
 * review findings for security and quality issues.
 */

import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { databaseService } from './database.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type { FixType, ReviewFinding } from '../../src/types/ipc.js';

// Import fixService lazily to avoid circular dependency
// The actual import is done at call time in handleAgentExit
let fixServiceModule: typeof import('./fix-service.js') | null = null;
async function getFixService() {
  if (!fixServiceModule) {
    fixServiceModule = await import('./fix-service.js');
  }
  return fixServiceModule.fixService;
}

const logger = createIPCLogger('FixAgentPool');

/** Flag to track if the pool is shutting down (prevents database operations) */
let isShuttingDown = false;

/**
 * Options for starting a fix agent
 */
export interface FixAgentOptions {
  /** Task ID being fixed */
  taskId: string;
  /** Type of fix to perform */
  fixType: FixType;
  /** Database ID of the TaskFix record */
  fixId: string;
  /** Path to the project directory */
  projectPath: string;
  /** Array of findings to fix */
  findings: ReviewFinding[];
}

/**
 * Findings grouped by fix type for starting all fixes
 */
export interface FindingsByType {
  security?: ReviewFinding[];
  quality?: ReviewFinding[];
  performance?: ReviewFinding[];
}

/**
 * Represents an active fix agent
 */
interface FixAgent {
  /** Unique identifier for the agent */
  id: string;
  /** Task ID being fixed */
  taskId: string;
  /** Type of fix being performed */
  fixType: FixType;
  /** Database ID of the TaskFix record */
  fixId: string;
  /** Child process running Claude Code */
  process: ChildProcess;
  /** Current status of the agent */
  status: 'running' | 'completed' | 'failed';
  /** Output buffer for parsing */
  outputBuffer: string;
  /** Current activity message for real-time status */
  currentMessage?: string;
  /** Partial line buffer for stream-json parsing */
  partialLineBuffer: string;
  /** Whether the spawn event has fired */
  spawnConfirmed: boolean;
  /** Timeout handle for no-output timeout */
  timeoutHandle?: NodeJS.Timeout | undefined;
  /** Timeout handle for spawn confirmation */
  spawnTimeoutHandle?: NodeJS.Timeout | undefined;
}

/**
 * Parsed fix output
 */
export interface FixOutput {
  /** Whether the fix was successful */
  success: boolean;
  /** List of files that were modified */
  filesModified: string[];
  /** Summary of changes made */
  summary: string;
  /** Research sources used for best practices */
  researchSources: string[];
  /** Error message if fix failed */
  error?: string;
  /** Before code from agent output (for minimal change tracking) */
  beforeCode?: string;
  /** After code from agent output (for minimal change tracking) */
  afterCode?: string;
  /** Number of lines changed (for minimal change tracking) */
  linesChanged?: number;
  /** Whether the change is flagged as suspicious (too many lines changed) */
  suspiciousOverScope?: boolean;
}

/**
 * Current activity information for a fix agent
 */
export interface FixActivity {
  message: string;
  timestamp: number;
}

/**
 * Critical constraints that apply to ALL fix types.
 * These are prepended to each fix prompt.
 */
const CRITICAL_CONSTRAINTS = `
## CRITICAL CONSTRAINTS - VIOLATIONS WILL FAIL VERIFICATION

1. CHANGES MUST BE MINIMAL - If you change more than 20 lines total, you're doing it wrong
2. DO NOT touch files not mentioned in the findings
3. DO NOT rename variables, reorganize imports, or add comments
4. DO NOT add new error handling, logging, or features
5. ONLY fix the EXACT issue at the EXACT location specified

## VERIFICATION WILL CHECK:
- Did the score improve? If it dropped, your fix FAILED
- Were only the flagged lines changed? If you changed other lines, your fix FAILED
- Is the code simpler or same complexity? If you made it more complex, your fix FAILED

## OUTPUT REQUIREMENT - BEFORE/AFTER DIFF:
Before making changes, you MUST output:
<before_code>
[The exact lines you're about to change - copy from the file]
</before_code>

After making changes, you MUST output:
<after_code>
[The exact lines after your change]
</after_code>

This diff will be reviewed. If your changes are not minimal, verification will fail.
`;

/**
 * Fix prompts for each fix type
 */
const FIX_PROMPTS: Record<FixType, string> = {
  security: `You are a security fix specialist. Your goal is to fix ONLY the specific vulnerabilities listed below.

===========================================
CRITICAL INSTRUCTIONS - READ FIRST
===========================================
1. Fix ONLY the specific issues listed in the findings - nothing else
2. Make MINIMAL changes - do not refactor, reorganize, or "improve" code that is not flagged
3. Preserve existing patterns, naming conventions, and code structure
4. Do NOT add features, change APIs, or modify behavior beyond the security fix
5. If a file is not listed in the findings, do NOT modify it
6. Focus on the EXACT line/location specified - do not expand scope
${CRITICAL_CONSTRAINTS}

## Step 1: Read the Flagged Code
For EACH finding:
1. Read the file at the specified location
2. Quote the EXACT problematic code in a <before_code> block
3. Understand the specific vulnerable pattern
4. Identify the minimal change needed to fix it

## Step 2: Apply Targeted Fixes
For EACH finding:
1. Apply the fix at the EXACT location specified
2. Keep changes as small as possible (aim for 1-5 lines per finding)
3. Do NOT change surrounding code that is working correctly
4. Preserve comments, formatting, and structure
5. After editing, show the result in an <after_code> block

## What to Fix (Security):
- Input validation/sanitization gaps at the flagged location
- XSS vulnerabilities via innerHTML, dangerouslySetInnerHTML at flagged lines
- Authentication/authorization bypasses at flagged locations
- Injection vulnerabilities (SQL, command, etc.) at flagged locations

## What NOT to Do:
- Do NOT refactor functions that are not flagged
- Do NOT rename variables for "clarity"
- Do NOT add new error handling beyond what is needed for the fix
- Do NOT reorganize imports or code structure
- Do NOT "improve" code that is not part of the finding

## Step 3: Verify
Run: npm run typecheck

===========================================
CRITICAL: REQUIRED OUTPUT FORMAT
===========================================

After completing ALL steps above, you MUST end your response with EXACTLY this format:

<fix_json>
{
  "success": true or false,
  "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
  "summary": "Brief description of specific security fixes applied",
  "researchSources": []
}
</fix_json>

If the code is already secure or no changes are needed:
<fix_json>
{
  "success": false,
  "filesModified": [],
  "summary": "Code at [file:line] is already secure because [specific reason]",
  "researchSources": [],
  "error": "No changes needed - code already meets security requirements"
}
</fix_json>

CRITICAL RULES:
1. You MUST include the <fix_json>...</fix_json> tags - this is REQUIRED
2. Output NOTHING after the closing </fix_json> tag
3. The JSON must be valid - no trailing commas, no comments
4. This output format is MANDATORY - your response will be marked as FAILED without it
5. Only report success:true if you actually modified files to fix vulnerabilities
6. You MUST include <before_code> and <after_code> blocks showing your minimal changes`,

  quality: `You are a code quality specialist. Your goal is to fix ONLY the specific quality issues listed below.

===========================================
CRITICAL INSTRUCTIONS - READ FIRST
===========================================
1. Fix ONLY the specific issues listed in the findings - nothing else
2. Make MINIMAL changes - do not refactor, reorganize, or "improve" code that is not flagged
3. Preserve existing patterns, naming conventions, and code structure
4. Do NOT add features, change APIs, or modify behavior beyond the quality fix
5. If a file is not listed in the findings, do NOT modify it
6. Focus on the EXACT line/location specified - do not expand scope
${CRITICAL_CONSTRAINTS}

## Step 1: Read the Flagged Code
For EACH finding:
1. Read the file at the specified location
2. Quote the EXACT problematic code in a <before_code> block
3. Understand the specific quality issue
4. Identify the minimal change needed to fix it

## Step 2: Apply Targeted Fixes
For EACH finding:
1. Apply the fix at the EXACT location specified
2. Keep changes as small as possible (aim for 1-5 lines per finding)
3. Do NOT change surrounding code that is working correctly
4. Preserve comments, formatting, and structure
5. After editing, show the result in an <after_code> block

## What to Fix (Quality):
- Magic numbers/strings at flagged locations -> extract to named constants
- Missing error handling at flagged locations -> add specific error handling
- Code duplication at flagged locations -> extract to helper function if cited multiple times
- Type safety issues at flagged locations -> add proper types

## What NOT to Do:
- Do NOT refactor entire functions when only one line is flagged
- Do NOT rename variables for "clarity" unless specifically flagged
- Do NOT change code organization or file structure
- Do NOT add new features or enhance functionality
- Do NOT "improve" code that is not part of the finding

## Step 3: Verify
Run: npm run lint && npm run typecheck

===========================================
CRITICAL: REQUIRED OUTPUT FORMAT
===========================================

After completing ALL steps above, you MUST end your response with EXACTLY this format:

<fix_json>
{
  "success": true or false,
  "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
  "summary": "Brief description of specific quality fixes applied",
  "researchSources": []
}
</fix_json>

If the code already meets quality standards or no changes are needed:
<fix_json>
{
  "success": false,
  "filesModified": [],
  "summary": "Code at [file:line] already meets quality standards because [specific reason]",
  "researchSources": [],
  "error": "No changes needed - code already meets quality requirements"
}
</fix_json>

CRITICAL RULES:
1. You MUST include the <fix_json>...</fix_json> tags - this is REQUIRED
2. Output NOTHING after the closing </fix_json> tag
3. The JSON must be valid - no trailing commas, no comments
4. This output format is MANDATORY - your response will be marked as FAILED without it
5. Only report success:true if you actually modified files to fix quality issues
6. You MUST include <before_code> and <after_code> blocks showing your minimal changes`,

  performance: `You are a performance optimization specialist. Your goal is to fix ONLY the specific performance issues listed below.

===========================================
CRITICAL INSTRUCTIONS - READ FIRST
===========================================
1. Fix ONLY the specific issues listed in the findings - nothing else
2. Make MINIMAL changes - do not refactor, reorganize, or "improve" code that is not flagged
3. Preserve existing patterns, naming conventions, and code structure
4. Do NOT add features, change APIs, or modify behavior beyond the performance fix
5. If a file is not listed in the findings, do NOT modify it
6. Focus on the EXACT line/location specified - do not expand scope
${CRITICAL_CONSTRAINTS}

## Step 1: Read the Flagged Code
For EACH finding:
1. Read the file at the specified location
2. Quote the EXACT problematic code in a <before_code> block
3. Understand the specific performance issue
4. Identify the minimal change needed to fix it

## Step 2: Apply Targeted Fixes
For EACH finding:
1. Apply the fix at the EXACT location specified
2. Keep changes as small as possible (aim for 1-5 lines per finding)
3. Do NOT change surrounding code that is working correctly
4. Preserve comments, formatting, and structure
5. After editing, show the result in an <after_code> block

## What to Fix (Performance):
- Missing memoization at flagged locations -> add useMemo/useCallback/React.memo
- Missing cleanup in useEffect at flagged locations -> add cleanup function
- Expensive operations in render at flagged locations -> memoize or move to effect
- Memory leaks at flagged locations -> add proper cleanup

## What NOT to Do:
- Do NOT add memoization to components/hooks that are not flagged
- Do NOT refactor entire components when only one hook is flagged
- Do NOT change component structure or hierarchy
- Do NOT optimize code that is not specifically flagged
- Do NOT "improve" code that is not part of the finding

## Step 3: Verify
Run: npm run typecheck
Ensure memoization dependencies are correct for any changes made.

===========================================
CRITICAL: REQUIRED OUTPUT FORMAT
===========================================

After completing ALL steps above, you MUST end your response with EXACTLY this format:

<fix_json>
{
  "success": true or false,
  "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
  "summary": "Brief description of specific performance fixes applied",
  "researchSources": []
}
</fix_json>

If the code is already optimized or no changes are needed:
<fix_json>
{
  "success": false,
  "filesModified": [],
  "summary": "Code at [file:line] is already optimized because [specific reason]",
  "researchSources": [],
  "error": "No changes needed - code already meets performance requirements"
}
</fix_json>

CRITICAL RULES:
1. You MUST include the <fix_json>...</fix_json> tags - this is REQUIRED
2. Output NOTHING after the closing </fix_json> tag
3. The JSON must be valid - no trailing commas, no comments
4. This output format is MANDATORY - your response will be marked as FAILED without it
5. Only report success:true if you actually modified files to fix performance issues
6. You MUST include <before_code> and <after_code> blocks showing your minimal changes`,
};

/**
 * FixAgentPoolManager manages concurrent AI fix agents.
 *
 * Features:
 * - Concurrent fix execution (max 3 in parallel - one per fix type)
 * - Per-task fix tracking
 * - Automatic result parsing and storage
 * - Graceful cancellation support
 */
class FixAgentPoolManager {
  /** Maximum number of concurrent fix agents (one per fix type) */
  private readonly MAX_CONCURRENT = 3;

  /** Map of active agents by agent ID */
  private activeAgents: Map<string, FixAgent> = new Map();

  /** Map of task IDs to their fix agent IDs */
  private taskFixMap: Map<string, Set<string>> = new Map();

  /** Reference to main window for IPC events */
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window for IPC events.
   *
   * @param window - The main BrowserWindow instance
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start a single fix agent.
   *
   * @param options - Fix agent configuration
   * @returns The agent ID
   */
  async startFix(options: FixAgentOptions): Promise<string> {
    const agentId = randomUUID();
    const prisma = databaseService.getClient();

    try {
      // Update TaskFix record with IN_PROGRESS status
      await prisma.taskFix.update({
        where: { id: options.fixId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          completedAt: null,
          summary: null,
          patch: null,
          researchNotes: null,
        },
      });

      // Build the fix prompt with findings
      const prompt = this.buildFixPrompt(options);

      // Build Claude Code arguments
      const args = this.buildClaudeArgs(prompt);

      // DEBUG: Log the full command being executed
      logger.info(
        `[${options.fixType}] DEBUG: Spawning claude with args: ${JSON.stringify(args)}`
      );
      logger.info(`[${options.fixType}] DEBUG: Working directory: ${options.projectPath}`);

      // Spawn Claude Code process
      const claudeProcess = spawn('claude', args, {
        cwd: options.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      logger.info(
        `Started ${options.fixType} fix agent for task ${options.taskId} (agent: ${agentId}, PID: ${String(claudeProcess.pid)})`
      );

      // Create the agent record
      const agent: FixAgent = {
        id: agentId,
        taskId: options.taskId,
        fixType: options.fixType,
        fixId: options.fixId,
        process: claudeProcess,
        status: 'running',
        outputBuffer: '',
        currentMessage: `Starting ${options.fixType} fix...`,
        partialLineBuffer: '',
        spawnConfirmed: false,
      };

      // Store the agent
      this.activeAgents.set(agentId, agent);

      // Track agent for this task
      let taskAgents = this.taskFixMap.get(options.taskId);
      if (!taskAgents) {
        taskAgents = new Set();
        this.taskFixMap.set(options.taskId, taskAgents);
      }
      taskAgents.add(agentId);

      // IMMEDIATELY emit progress so UI shows RUNNING status
      this.emitProgress(options.taskId, options.fixType, `${options.fixType}: Initializing fix agent...`);

      // Handle the 'spawn' event to confirm process actually started
      claudeProcess.on('spawn', () => {
        agent.spawnConfirmed = true;
        logger.info(
          `[${options.fixType}] DEBUG: spawn event fired - process started successfully (PID: ${String(claudeProcess.pid)})`
        );

        // Clear spawn timeout since we confirmed spawn
        if (agent.spawnTimeoutHandle) {
          clearTimeout(agent.spawnTimeoutHandle);
          agent.spawnTimeoutHandle = undefined;
        }

        // Update status to show process is running
        agent.currentMessage = `${options.fixType}: Fix agent running...`;
        this.emitProgress(options.taskId, options.fixType, agent.currentMessage);
      });

      // Set up spawn confirmation timeout (5 seconds)
      agent.spawnTimeoutHandle = setTimeout(() => {
        if (!agent.spawnConfirmed && agent.status === 'running') {
          logger.error(
            `[${options.fixType}] ERROR: spawn event did not fire within 5 seconds - process may have failed to start`
          );
          agent.currentMessage = `${options.fixType}: Failed to start (spawn timeout)`;
          void this.handleAgentError(
            agentId,
            new Error('Process spawn confirmation timeout - claude CLI may not be in PATH')
          );
        }
      }, 5000);

      // Set up no-output timeout (120 seconds - longer for fixes since they include research)
      agent.timeoutHandle = setTimeout(() => {
        if (agent.status === 'running' && agent.outputBuffer.length === 0) {
          logger.error(
            `[${options.fixType}] ERROR: No output received within 120 seconds - marking as failed`
          );
          agent.currentMessage = `${options.fixType}: Timed out (no output)`;
          void this.handleAgentError(
            agentId,
            new Error('Fix agent timeout - no output received within 120 seconds')
          );
          // Kill the process if it's still running
          try {
            claudeProcess.kill();
          } catch {
            // Process may already be dead
          }
        }
      }, 120000);

      // Handle 'error' event on spawn (e.g., ENOENT if claude not in PATH)
      claudeProcess.on('error', (err: Error) => {
        logger.error(`[${options.fixType}] Process error:`, err);
        logger.error(
          `[${options.fixType}] DEBUG: This may indicate 'claude' CLI is not in PATH or not executable`
        );

        // Clear timeouts
        if (agent.timeoutHandle) {
          clearTimeout(agent.timeoutHandle);
          agent.timeoutHandle = undefined;
        }
        if (agent.spawnTimeoutHandle) {
          clearTimeout(agent.spawnTimeoutHandle);
          agent.spawnTimeoutHandle = undefined;
        }

        // Update message for UI
        agent.currentMessage = `${options.fixType}: Failed - ${err.message}`;
        void this.handleAgentError(agentId, err);
      });

      // Close stdin to start processing
      claudeProcess.stdin?.end();
      logger.info(`[${options.fixType}] DEBUG: stdin closed to trigger CLI processing`);

      // Handle stdout with real-time stream-json parsing
      if (claudeProcess.stdout) {
        logger.info(`[${options.fixType}] DEBUG: Attaching stdout data handler`);
        claudeProcess.stdout.setEncoding('utf8');

        claudeProcess.stdout.on('data', (data: string) => {
          logger.info(
            `[${options.fixType}] DEBUG: stdout received ${String(data.length)} chars`
          );
          logger.info(
            `[${options.fixType}] DEBUG: stdout preview: ${data.substring(0, 200).replace(/\n/g, '\\n')}`
          );

          // Reset no-output timeout since we received data
          if (agent.timeoutHandle) {
            clearTimeout(agent.timeoutHandle);
            agent.timeoutHandle = undefined;
          }

          agent.outputBuffer += data;

          // Parse stream-json lines for real-time status
          // Prepend any partial line from previous chunk
          const fullData = agent.partialLineBuffer + data;
          const lines = fullData.split('\n');

          // Last element might be incomplete, save for next chunk
          agent.partialLineBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('{')) continue;

            try {
              const parsed: unknown = JSON.parse(trimmed);
              const statusMessage = this.extractStatusMessage(parsed, options.fixType);
              if (statusMessage) {
                agent.currentMessage = statusMessage;
                this.emitProgress(options.taskId, options.fixType, statusMessage);
              }
            } catch {
              // Non-JSON or partial line, skip
            }
          }
        });

        // Log stdout end/close events
        claudeProcess.stdout.on('end', () => {
          logger.info(`[${options.fixType}] DEBUG: stdout stream ended`);
        });
        claudeProcess.stdout.on('close', () => {
          logger.info(`[${options.fixType}] DEBUG: stdout stream closed`);
        });
      } else {
        logger.warn(`[${options.fixType}] DEBUG: stdout is null - no output stream available`);
      }

      // Handle stderr
      if (claudeProcess.stderr) {
        claudeProcess.stderr.setEncoding('utf8');
        claudeProcess.stderr.on('data', (data: string) => {
          logger.warn(`[${options.fixType}] stderr: ${data}`);
        });
      }

      // Handle process exit
      claudeProcess.on('exit', (code: number | null, signal: string | null) => {
        logger.info(
          `[${options.fixType}] DEBUG: Process exited with code ${String(code)}, signal ${String(signal)}`
        );

        // Clear timeouts
        if (agent.timeoutHandle) {
          clearTimeout(agent.timeoutHandle);
          agent.timeoutHandle = undefined;
        }
        if (agent.spawnTimeoutHandle) {
          clearTimeout(agent.spawnTimeoutHandle);
          agent.spawnTimeoutHandle = undefined;
        }

        void this.handleAgentExit(agentId, code ?? 1);
      });

      return agentId;
    } catch (error) {
      logger.error(
        `Failed to start ${options.fixType} fix agent for task ${options.taskId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start all fixes for a task in parallel.
   *
   * @param taskId - Task ID to fix
   * @param projectPath - Project directory path
   * @param findingsByType - Findings grouped by fix type
   * @returns Map of fix type to agent ID
   */
  async startAllFixes(
    taskId: string,
    projectPath: string,
    findingsByType: FindingsByType
  ): Promise<Map<FixType, string>> {
    const prisma = databaseService.getClient();
    const agentIds = new Map<FixType, string>();

    const fixTypes: FixType[] = ['security', 'quality', 'performance'];

    // Start agents for each fix type that has findings
    const startPromises: Promise<void>[] = [];

    for (const fixType of fixTypes) {
      const findings = findingsByType[fixType];
      if (!findings || findings.length === 0) {
        logger.info(`Skipping ${fixType} fix - no findings`);
        continue;
      }

      // Create or update TaskFix record
      const startPromise = (async () => {
        const existingFix = await prisma.taskFix.findUnique({
          where: {
            taskId_fixType: {
              taskId,
              fixType,
            },
          },
        });

        let fixId: string;
        if (existingFix) {
          const updated = await prisma.taskFix.update({
            where: { id: existingFix.id },
            data: {
              status: 'PENDING',
              findings: JSON.stringify(findings),
              startedAt: null,
              completedAt: null,
              summary: null,
              patch: null,
              researchNotes: null,
            },
          });
          fixId = updated.id;
        } else {
          const created = await prisma.taskFix.create({
            data: {
              taskId,
              fixType,
              status: 'PENDING',
              findings: JSON.stringify(findings),
            },
          });
          fixId = created.id;
        }

        // Start the fix agent
        const agentId = await this.startFix({
          taskId,
          fixType,
          fixId,
          projectPath,
          findings,
        });

        agentIds.set(fixType, agentId);
      })();

      startPromises.push(startPromise);

      // Respect MAX_CONCURRENT limit
      if (startPromises.length >= this.MAX_CONCURRENT) {
        await Promise.race(startPromises);
      }
    }

    // Wait for all to start
    await Promise.all(startPromises);

    logger.info(`Started ${String(agentIds.size)} fix agents for task ${taskId}`);

    return agentIds;
  }

  /**
   * Cancel a specific fix for a task.
   *
   * @param taskId - Task ID
   * @param fixType - Type of fix to cancel
   */
  cancelFix(taskId: string, fixType: FixType): void {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds) {
      return;
    }

    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.fixType === fixType && agent.status === 'running') {
        try {
          // Clear any pending timeouts
          if (agent.timeoutHandle) {
            clearTimeout(agent.timeoutHandle);
            agent.timeoutHandle = undefined;
          }
          if (agent.spawnTimeoutHandle) {
            clearTimeout(agent.spawnTimeoutHandle);
            agent.spawnTimeoutHandle = undefined;
          }

          agent.process.kill();
          agent.status = 'failed';
          logger.info(`Cancelled ${agent.fixType} fix agent ${agentId}`);
        } catch (error) {
          logger.error(`Failed to kill fix agent ${agentId}:`, error);
        }
      }
    }
  }

  /**
   * Cancel all fixes for a task.
   *
   * @param taskId - Task ID to cancel fixes for
   */
  cancelAllFixes(taskId: string): void {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds) {
      return;
    }

    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.status === 'running') {
        try {
          // Clear any pending timeouts
          if (agent.timeoutHandle) {
            clearTimeout(agent.timeoutHandle);
            agent.timeoutHandle = undefined;
          }
          if (agent.spawnTimeoutHandle) {
            clearTimeout(agent.spawnTimeoutHandle);
            agent.spawnTimeoutHandle = undefined;
          }

          agent.process.kill();
          agent.status = 'failed';
          logger.info(`Cancelled ${agent.fixType} fix agent ${agentId}`);
        } catch (error) {
          logger.error(`Failed to kill fix agent ${agentId}:`, error);
        }
      }
    }

    this.taskFixMap.delete(taskId);
  }

  /**
   * Get the status of an agent.
   *
   * @param agentId - Agent ID to query
   * @returns The agent or undefined if not found
   */
  getAgentStatus(agentId: string): FixAgent | undefined {
    return this.activeAgents.get(agentId);
  }

  /**
   * Check if all fixes for a task are complete.
   *
   * @param taskId - Task ID to check
   * @returns True if all fixes are complete
   */
  areAllFixesComplete(taskId: string): boolean {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds || agentIds.size === 0) {
      return true;
    }

    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.status === 'running') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all active agents for a task.
   *
   * @param taskId - Task ID to query
   * @returns Array of active agents
   */
  getActiveFixesForTask(taskId: string): FixAgent[] {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds) {
      return [];
    }

    const agents: FixAgent[] = [];
    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Get the count of currently active agents.
   *
   * @returns Number of running agents
   */
  getActiveAgentsCount(): number {
    let count = 0;
    for (const agent of this.activeAgents.values()) {
      if (agent.status === 'running') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get current activity for a fix agent.
   *
   * @param taskId - Task ID to query
   * @param fixType - Type of fix to query
   * @returns Current activity or undefined if not found
   */
  getCurrentActivity(taskId: string, fixType: FixType): FixActivity | undefined {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds) {
      return undefined;
    }

    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.fixType === fixType && agent.currentMessage) {
        return {
          message: agent.currentMessage,
          timestamp: Date.now(),
        };
      }
    }

    return undefined;
  }

  /**
   * Check if a fix is currently running.
   *
   * @param taskId - Task ID to check
   * @param fixType - Type of fix to check
   * @returns True if the fix is running
   */
  isFixRunning(taskId: string, fixType: FixType): boolean {
    const agentIds = this.taskFixMap.get(taskId);
    if (!agentIds) {
      return false;
    }

    for (const agentId of agentIds) {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.fixType === fixType && agent.status === 'running') {
        return true;
      }
    }

    return false;
  }

  /**
   * Clean up all fix agents during shutdown.
   * Sets the shutdown flag to prevent database operations and kills all running processes.
   */
  cleanup(): void {
    // Set shutdown flag to prevent database operations during exit handlers
    isShuttingDown = true;

    const runningAgents: string[] = [];

    // Kill all running fix agent processes
    for (const [agentId, agent] of this.activeAgents) {
      if (agent.status === 'running') {
        runningAgents.push(`${agent.fixType}:${agentId}`);

        // Clear any pending timeouts
        if (agent.timeoutHandle) {
          clearTimeout(agent.timeoutHandle);
          agent.timeoutHandle = undefined;
        }
        if (agent.spawnTimeoutHandle) {
          clearTimeout(agent.spawnTimeoutHandle);
          agent.spawnTimeoutHandle = undefined;
        }

        // Kill the process
        try {
          agent.process.kill('SIGTERM');
        } catch (error) {
          // Process may already be dead, try SIGKILL
          try {
            agent.process.kill('SIGKILL');
          } catch {
            // Ignore - process is already terminated
          }
        }

        agent.status = 'failed';
      }
    }

    if (runningAgents.length > 0) {
      logger.info(`Cleaned up ${String(runningAgents.length)} running fix agent(s): ${runningAgents.join(', ')}`);
    }

    // Clear all tracking maps
    this.activeAgents.clear();
    this.taskFixMap.clear();
  }

  /**
   * Build the fix prompt with findings context.
   * Includes explicit preservation instructions and structured finding details.
   */
  private buildFixPrompt(options: FixAgentOptions): string {
    const basePrompt = FIX_PROMPTS[options.fixType];
    const lines: string[] = [];

    lines.push('# Fix Task');
    lines.push('');
    lines.push(`## Fix Type: ${options.fixType.toUpperCase()}`);
    lines.push('');

    // Add critical scope instructions at the top
    lines.push('## SCOPE RESTRICTION');
    lines.push('');
    lines.push('You MUST only fix the specific findings listed below. Do NOT:');
    lines.push('- Modify any code that is not directly related to these findings');
    lines.push('- Refactor, reorganize, or "improve" code beyond fixing the listed issues');
    lines.push('- Add new features, change APIs, or modify behavior unnecessarily');
    lines.push('- Change files that are not listed in the findings');
    lines.push('');

    lines.push('## Findings to Fix');
    lines.push('');
    lines.push(`Total: ${String(options.findings.length)} finding(s) to address`);
    lines.push('');

    for (let i = 0; i < options.findings.length; i++) {
      const finding = options.findings[i]!;
      lines.push(`### Finding ${String(i + 1)}: ${finding.title}`);
      lines.push('');
      lines.push(`**Severity:** ${finding.severity}`);
      lines.push('');

      // Location information with explicit code context instructions
      if (finding.file) {
        const locationStr = finding.line
          ? `${finding.file}:${String(finding.line)}`
          : finding.file;
        lines.push(`**Location:** \`${locationStr}\``);
        lines.push('');
        lines.push('**REQUIRED STEPS:**');
        lines.push(`1. First, READ the file \`${finding.file}\` at line ${finding.line ? String(finding.line) : '1'}`);
        lines.push('2. Quote the EXACT problematic code in a <before_code> block');
        lines.push('3. Apply your minimal fix (aim for 1-5 lines changed)');
        lines.push('4. Show the result in an <after_code> block');
        lines.push('');
      }

      // What's wrong
      lines.push('**Issue Description:**');
      lines.push(finding.description);
      lines.push('');

      // Fix guidance based on type
      lines.push('**Fix Approach:**');
      if (options.fixType === 'security') {
        lines.push('1. Read the file at the specified location');
        lines.push('2. Identify the vulnerable pattern in the flagged code');
        lines.push('3. Apply the minimal security fix (validation, sanitization, or encoding)');
        lines.push('4. Do NOT change any surrounding code');
      } else if (options.fixType === 'quality') {
        lines.push('1. Read the file at the specified location');
        lines.push('2. Understand the quality issue in the flagged code');
        lines.push('3. Apply the minimal fix (extract constant, add type, etc.)');
        lines.push('4. Do NOT refactor beyond the specific issue');
      } else if (options.fixType === 'performance') {
        lines.push('1. Read the file at the specified location');
        lines.push('2. Identify the performance issue in the flagged code');
        lines.push('3. Apply the minimal optimization (add memoization, cleanup, etc.)');
        lines.push('4. Do NOT optimize other parts of the component');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## Instructions');
    lines.push('');
    lines.push(basePrompt);

    return lines.join('\n');
  }

  /**
   * Build Claude Code arguments for a fix.
   */
  private buildClaudeArgs(prompt: string): string[] {
    return [
      '-p', // Print mode
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose', // Required when using --print with --output-format=stream-json
      '--max-turns',
      '15', // Limited turns for focused, minimal fixes - prevents over-scoping
      prompt,
    ];
  }

  /**
   * Handle agent process exit.
   */
  private async handleAgentExit(agentId: string, exitCode: number): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Skip database operations if shutting down or database is disconnected
    if (isShuttingDown || !databaseService.isConnected()) {
      logger.info(`[${agent.fixType}] Skipping database update during shutdown`);
      agent.status = exitCode === 0 ? 'completed' : 'failed';
      return;
    }

    // Variables to track result for emitComplete
    let errorMessage: string | undefined;
    let summaryMessage: string | undefined;

    try {
      const prisma = databaseService.getClient();

      if (exitCode === 0) {
        // Parse the output
        const result = this.parseFixOutput(agent.outputBuffer);

        if (result.success) {
          // Update TaskFix with FIX_APPLIED status (not COMPLETED - verification pending)
          await prisma.taskFix.update({
            where: { id: agent.fixId },
            data: {
              status: 'FIX_APPLIED',
              summary: result.summary,
              patch: result.filesModified.join(', '),
              researchNotes: result.researchSources.join('\n'),
              completedAt: new Date(),
            },
          });

          agent.status = 'completed';
          summaryMessage = result.summary;
          logger.info(
            `${agent.fixType} fix applied for task ${agent.taskId} (files modified: ${String(result.filesModified.length)}), starting verification...`
          );

          // Emit progress showing fix applied, awaiting verification
          this.emitProgress(
            agent.taskId,
            agent.fixType,
            `${agent.fixType}: Fix applied, starting verification...`,
            'FIX_APPLIED'
          );

          // Trigger verification
          try {
            const fixSvc = await getFixService();
            await fixSvc.startVerification(agent.taskId, agent.fixType);
          } catch (verifyError) {
            logger.error(`Failed to start verification for ${agent.fixType} fix on task ${agent.taskId}:`, verifyError);
            // Don't fail the fix if verification fails to start - the fix itself succeeded
          }
        } else {
          // Mark as failed due to fix failure
          const failureSummary = result.error || result.summary || 'Fix failed';
          await prisma.taskFix.update({
            where: { id: agent.fixId },
            data: {
              status: 'FAILED',
              summary: failureSummary,
              completedAt: new Date(),
            },
          });

          agent.status = 'failed';
          errorMessage = result.error;
          summaryMessage = failureSummary;
          logger.warn(
            `${agent.fixType} fix failed for task ${agent.taskId}: ${failureSummary}`
          );
        }
      } else {
        // Mark as failed
        const exitFailureSummary = `Process exited with code ${String(exitCode)}`;
        await prisma.taskFix.update({
          where: { id: agent.fixId },
          data: {
            status: 'FAILED',
            summary: exitFailureSummary,
            completedAt: new Date(),
          },
        });

        agent.status = 'failed';
        errorMessage = exitFailureSummary;
        summaryMessage = exitFailureSummary;
        logger.warn(
          `${agent.fixType} fix failed for task ${agent.taskId} (exit code: ${String(exitCode)})`
        );
      }
    } catch (dbError) {
      logger.error(`[${agent.fixType}] Failed to update database on exit:`, dbError);
      agent.status = 'failed';
      errorMessage = dbError instanceof Error ? dbError.message : 'Database update failed';
    }

    // For failed fixes, emit progress and completion events
    // Note: Successful fixes emit their own FIX_APPLIED status and trigger verification above
    if (agent.status === 'failed') {
      this.emitProgress(
        agent.taskId,
        agent.fixType,
        `${agent.fixType}: Fix failed`,
        'FAILED'
      );
      this.emitComplete(agent.taskId, agent.fixType, false, errorMessage, summaryMessage);
    }
    // For successful fixes, emit completion event (verification will send its own progress updates)
    else if (agent.status === 'completed') {
      this.emitComplete(agent.taskId, agent.fixType, true, undefined, summaryMessage);
    }
  }

  /**
   * Handle agent process error.
   */
  private async handleAgentError(agentId: string, error: Error): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Prevent double-handling if already failed
    if (agent.status === 'failed') {
      logger.warn(`[${agent.fixType}] Agent already marked as failed, skipping duplicate error handling`);
      return;
    }

    const prisma = databaseService.getClient();

    // Mark as failed
    try {
      await prisma.taskFix.update({
        where: { id: agent.fixId },
        data: {
          status: 'FAILED',
          summary: error.message,
          completedAt: new Date(),
        },
      });
    } catch (dbError) {
      logger.error(`[${agent.fixType}] Failed to update database:`, dbError);
    }

    agent.status = 'failed';
    agent.currentMessage = `${agent.fixType}: Failed - ${error.message}`;

    // Emit progress with failure status
    this.emitProgress(agent.taskId, agent.fixType, agent.currentMessage, 'FAILED');

    // Emit completion event for this specific fix (with failure)
    this.emitComplete(agent.taskId, agent.fixType, false, error.message, error.message);
  }

  /**
   * Extract content from XML tags.
   *
   * @param text - The text to search for XML tags
   * @param tagName - The name of the XML tag to extract content from
   * @returns The content inside the tags or null if not found
   */
  private extractFromXmlTags(text: string, tagName: string): string | null {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;

    const startIndex = text.indexOf(openTag);
    if (startIndex === -1) {
      return null;
    }

    const contentStart = startIndex + openTag.length;
    const endIndex = text.indexOf(closeTag, contentStart);
    if (endIndex === -1) {
      return null;
    }

    return text.substring(contentStart, endIndex).trim();
  }

  /**
   * Concatenate all text content from stream-json NDJSON output.
   * Handles various message types from Claude's stream-json format:
   * - "type": "assistant" messages with content arrays
   * - "type": "result" events
   * - "type": "content_block_delta" with delta.text
   * - "type": "text" events
   *
   * Skips metadata messages like:
   * - "type": "system" (hooks, metadata)
   *
   * @param output - The raw NDJSON output from Claude's stream-json format
   * @returns Object with concatenated text and message type counts for debugging
   */
  extractTextFromStreamJson(output: string): { text: string; typeCounts: Record<string, number> } {
    const textParts: string[] = [];
    const lines = output.split('\n');
    const typeCounts: Record<string, number> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const messageType = parsed['type'] as string | undefined;

        // Track message type counts for debugging
        if (messageType) {
          typeCounts[messageType] = (typeCounts[messageType] || 0) + 1;
        }

        // Skip system messages (hooks, metadata, etc.)
        // These include subtype: "hook_started" and subtype: "hook_response"
        if (messageType === 'system') {
          continue;
        }

        // Handle "type": "assistant" messages with content array
        if (messageType === 'assistant' && parsed['message']) {
          const message = parsed['message'] as Record<string, unknown>;
          const content = message['content'] as Array<Record<string, unknown>> | undefined;

          if (content && Array.isArray(content)) {
            for (const block of content) {
              if (block['type'] === 'text' && typeof block['text'] === 'string') {
                textParts.push(block['text']);
              }
            }
          }
        }

        // Handle "type": "result" events
        if (messageType === 'result' && typeof parsed['result'] === 'string') {
          textParts.push(parsed['result']);
        }

        // Handle "type": "content_block_delta" with delta.text
        if (messageType === 'content_block_delta' && parsed['delta']) {
          const delta = parsed['delta'] as Record<string, unknown>;
          if (delta['type'] === 'text_delta' && typeof delta['text'] === 'string') {
            textParts.push(delta['text']);
          }
        }

        // Handle "type": "text" events (direct text output)
        if (messageType === 'text' && typeof parsed['text'] === 'string') {
          textParts.push(parsed['text']);
        }
      } catch {
        // Non-JSON line, skip
      }
    }

    return { text: textParts.join('\n'), typeCounts };
  }

  /**
   * Extract before/after code blocks and calculate lines changed.
   * Used to detect over-scoping in fix agents.
   *
   * @param text - The concatenated output text
   * @returns Object with before code, after code, lines changed, and suspicious flag
   */
  private extractCodeDiff(text: string): {
    beforeCode: string | undefined;
    afterCode: string | undefined;
    linesChanged: number;
    suspiciousOverScope: boolean;
  } {
    const MAX_LINES_ALLOWED = 20;

    // Extract all before_code blocks
    const beforeBlocks: string[] = [];
    const beforeRegex = /<before_code>([\s\S]*?)<\/before_code>/gi;
    let match;
    while ((match = beforeRegex.exec(text)) !== null) {
      if (match[1]) {
        beforeBlocks.push(match[1].trim());
      }
    }

    // Extract all after_code blocks
    const afterBlocks: string[] = [];
    const afterRegex = /<after_code>([\s\S]*?)<\/after_code>/gi;
    while ((match = afterRegex.exec(text)) !== null) {
      if (match[1]) {
        afterBlocks.push(match[1].trim());
      }
    }

    const beforeCode = beforeBlocks.length > 0 ? beforeBlocks.join('\n---\n') : undefined;
    const afterCode = afterBlocks.length > 0 ? afterBlocks.join('\n---\n') : undefined;

    // Calculate total lines changed
    let linesChanged = 0;
    if (beforeCode && afterCode) {
      const beforeLines = beforeCode.split('\n').length;
      const afterLines = afterCode.split('\n').length;
      linesChanged = Math.max(beforeLines, afterLines);
    } else if (afterCode) {
      // Only after code provided - count its lines
      linesChanged = afterCode.split('\n').length;
    }

    // Mark as suspicious if more than MAX_LINES_ALLOWED lines changed
    const suspiciousOverScope = linesChanged > MAX_LINES_ALLOWED;

    if (suspiciousOverScope) {
      logger.warn(
        `OVER-SCOPE WARNING: Agent changed ${String(linesChanged)} lines (max allowed: ${String(MAX_LINES_ALLOWED)})`
      );
    }

    return { beforeCode, afterCode, linesChanged, suspiciousOverScope };
  }

  /**
   * Parse fix output from Claude Code.
   * Handles stream-json NDJSON format where output is wrapped in event structures.
   */
  parseFixOutput(output: string): FixOutput {
    const defaultResult: FixOutput = {
      success: false,
      filesModified: [],
      summary: 'Failed to parse fix output',
      researchSources: [],
      error: 'Failed to parse fix output',
    };

    try {
      // Step 1: Extract all text content from stream-json NDJSON format
      const { text: concatenatedText, typeCounts } = this.extractTextFromStreamJson(output);

      // Log message type distribution for debugging
      logger.info(`Message type distribution: ${JSON.stringify(typeCounts)}`);

      // Step 1.5: Extract before/after code blocks for minimal changes tracking
      const codeDiff = this.extractCodeDiff(concatenatedText);
      if (codeDiff.beforeCode || codeDiff.afterCode) {
        logger.info(
          `Code diff tracking: ${String(codeDiff.linesChanged)} lines changed, ` +
          `suspicious: ${String(codeDiff.suspiciousOverScope)}`
        );
      }

      // Step 2: Look for <fix_json>...</fix_json> tags in concatenated text
      const xmlJsonContent = this.extractFromXmlTags(concatenatedText, 'fix_json');
      if (xmlJsonContent) {
        try {
          const parsed = JSON.parse(xmlJsonContent) as FixOutput;
          if (typeof parsed.success === 'boolean') {
            const result: FixOutput = {
              success: parsed.success,
              filesModified: Array.isArray(parsed.filesModified) ? parsed.filesModified : [],
              summary: typeof parsed.summary === 'string' ? parsed.summary : '',
              researchSources: Array.isArray(parsed.researchSources) ? parsed.researchSources : [],
              linesChanged: codeDiff.linesChanged,
              suspiciousOverScope: codeDiff.suspiciousOverScope,
            };
            // Add code diff tracking only if values exist
            if (codeDiff.beforeCode) {
              result.beforeCode = codeDiff.beforeCode;
            }
            if (codeDiff.afterCode) {
              result.afterCode = codeDiff.afterCode;
            }
            if (!result.success && parsed.error) {
              result.error = parsed.error;
            }
            // Add over-scope warning to summary if suspicious
            if (result.success && codeDiff.suspiciousOverScope) {
              result.summary = `[OVER-SCOPE WARNING: ${String(codeDiff.linesChanged)} lines changed] ${result.summary}`;
            }
            logger.info(`Parsed fix output from XML tags: success=${String(result.success)}, files=${String(result.filesModified.length)}`);
            return result;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON from XML tags:', parseError);
        }
      }

      // Step 3: Also check raw output for XML tags (in case format differs)
      const rawXmlContent = this.extractFromXmlTags(output, 'fix_json');
      if (rawXmlContent) {
        try {
          const parsed = JSON.parse(rawXmlContent) as FixOutput;
          if (typeof parsed.success === 'boolean') {
            const result: FixOutput = {
              success: parsed.success,
              filesModified: Array.isArray(parsed.filesModified) ? parsed.filesModified : [],
              summary: typeof parsed.summary === 'string' ? parsed.summary : '',
              researchSources: Array.isArray(parsed.researchSources) ? parsed.researchSources : [],
              linesChanged: codeDiff.linesChanged,
              suspiciousOverScope: codeDiff.suspiciousOverScope,
            };
            // Add code diff tracking only if values exist
            if (codeDiff.beforeCode) {
              result.beforeCode = codeDiff.beforeCode;
            }
            if (codeDiff.afterCode) {
              result.afterCode = codeDiff.afterCode;
            }
            if (!result.success && parsed.error) {
              result.error = parsed.error;
            }
            // Add over-scope warning to summary if suspicious
            if (result.success && codeDiff.suspiciousOverScope) {
              result.summary = `[OVER-SCOPE WARNING: ${String(codeDiff.linesChanged)} lines changed] ${result.summary}`;
            }
            logger.info(`Parsed fix output from raw XML tags: success=${String(result.success)}, files=${String(result.filesModified.length)}`);
            return result;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON from raw XML tags:', parseError);
        }
      }

      // Step 4: Fallback - CONSERVATIVE handling when <fix_json> tags are missing
      // This is now more strict: we default to FAILURE because proper fixes should include the required output format.
      // The agent was explicitly instructed to output <fix_json> tags, so missing them indicates incomplete work.
      logger.warn('=== FALLBACK SYNTHESIS WARNING ===');
      logger.warn('Claude did not output the required <fix_json> tags. This indicates incomplete or failed fix work.');
      logger.warn('Defaulting to FAILURE - proper fixes must include structured output.');

      if (concatenatedText.length > 100) {
        // Look for evidence that Edit/Write tools were actually used to modify files
        // This is a stronger signal than just keyword matching
        const hasEditToolUsage = /Editing\s+[\w./-]+|Writing\s+[\w./-]+|The file.*has been updated/i.test(concatenatedText);
        const hasWriteConfirmation = /successfully|written|saved|updated.*file/i.test(concatenatedText);

        // Check for "already optimized/secure" claims - these should report success:false
        const claimsAlreadyDone = /already\s*(?:optimized|secure|implemented|in\s*place|done|fixed|has|using|uses)/i.test(concatenatedText);

        // Check for explicit failure indicators
        const hasFailureIndicators = /(?:could\s*not|unable\s*to|failed\s*to|error occurred|cannot|can't|won't|impossible|no\s*changes?\s*(?:needed|required|made))/i.test(concatenatedText);

        // Extract file paths that appear to have been modified (look for edit tool patterns)
        const filesModified: string[] = [];
        const editPatterns = concatenatedText.match(/(?:Editing|Writing|updated)\s+([\w\/.-]+\.(?:tsx?|jsx?|css|scss))/gi);
        if (editPatterns) {
          for (const match of editPatterns) {
            const fileMatch = match.match(/([\w\/.-]+\.(?:tsx?|jsx?|css|scss))/i);
            if (fileMatch?.[1]) {
              filesModified.push(fileMatch[1]);
            }
          }
        }

        // CONSERVATIVE SUCCESS CRITERIA:
        // Only synthesize success if:
        // 1. There's evidence of actual file edits (Edit/Write tool usage)
        // 2. AND there are no failure indicators
        // 3. AND it's not just claiming "already done" without making changes
        const hasActualEdits = (hasEditToolUsage || hasWriteConfirmation) && filesModified.length > 0;
        const synthesizedSuccess = hasActualEdits && !hasFailureIndicators && !claimsAlreadyDone;

        logger.warn(`Fallback analysis:`);
        logger.warn(`  - Edit tool usage detected: ${String(hasEditToolUsage)}`);
        logger.warn(`  - Write confirmation found: ${String(hasWriteConfirmation)}`);
        logger.warn(`  - Files modified detected: ${String(filesModified.length)}`);
        logger.warn(`  - Claims already done: ${String(claimsAlreadyDone)}`);
        logger.warn(`  - Has failure indicators: ${String(hasFailureIndicators)}`);
        logger.warn(`  - Synthesized success: ${String(synthesizedSuccess)}`);

        // Even if we detect edits, mark as failure because the agent didn't follow instructions
        // This ensures proper verification happens
        const result: FixOutput = {
          success: synthesizedSuccess,
          filesModified: synthesizedSuccess ? filesModified : [],
          summary: synthesizedSuccess
            ? `[FALLBACK] Fix applied but agent did not output required format. Files: ${filesModified.join(', ')}`
            : `[FALLBACK] Fix incomplete - agent did not output required <fix_json> format`,
          researchSources: [],
        };

        // Only add error property if not successful
        if (!synthesizedSuccess) {
          result.error = 'Agent did not complete fix process - missing required <fix_json> output tags';
        }

        return result;
      }

      // Parsing failed - provide detailed diagnostic information
      logger.error('Failed to parse fix output - no valid JSON found and insufficient text for fallback');
      logger.error(`Output buffer length: ${String(output.length)} chars`);
      logger.error(`Concatenated text length: ${String(concatenatedText.length)} chars`);
      logger.error(`Message type counts: ${JSON.stringify(typeCounts)}`);

      // Check if any assistant messages were found
      const assistantCount = typeCounts['assistant'] || 0;
      const systemCount = typeCounts['system'] || 0;
      const resultCount = typeCounts['result'] || 0;
      const contentBlockDeltaCount = typeCounts['content_block_delta'] || 0;

      if (assistantCount === 0) {
        logger.error('WARNING: No "assistant" type messages found in output!');
        logger.error(`Found ${String(systemCount)} system messages (hooks/metadata)`);
        logger.error(`Found ${String(resultCount)} result messages`);
        logger.error(`Found ${String(contentBlockDeltaCount)} content_block_delta messages`);
      } else {
        logger.error(`Found ${String(assistantCount)} assistant messages but no <fix_json> tags`);
      }

      // Log sample of concatenated text (actual content, not raw output)
      if (concatenatedText.length > 0) {
        logger.error(`Concatenated text preview (first 500 chars): ${concatenatedText.substring(0, 500).replace(/\n/g, '\\n')}`);
      } else {
        logger.error('Concatenated text is EMPTY - no text content was extracted from messages');
        // Show raw output preview as fallback
        logger.error(`Raw output preview (first 500 chars): ${output.substring(0, 500).replace(/\n/g, '\\n')}`);
      }

      return defaultResult;
    } catch (error) {
      logger.error('Error parsing fix output:', error);
      return {
        ...defaultResult,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract a human-readable status message from stream-json parsed data.
   */
  private extractStatusMessage(parsed: unknown, fixType: FixType): string | null {
    const data = parsed as Record<string, unknown>;

    // Handle assistant messages with tool use
    if (data['type'] === 'assistant' && data['message']) {
      const message = data['message'] as Record<string, unknown>;
      const content = message['content'] as Array<Record<string, unknown>> | undefined;

      if (content) {
        for (const block of content) {
          if (block['type'] === 'tool_use') {
            const toolName = block['name'] as string;
            const input = block['input'] as Record<string, unknown>;
            return this.formatToolMessage(toolName, input, fixType);
          }
          if (block['type'] === 'thinking') {
            return `${fixType}: Analyzing...`;
          }
          if (block['type'] === 'text') {
            const text = block['text'] as string;
            if (text && text.length > 0) {
              return `${fixType}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`;
            }
          }
        }
      }
    }

    // Handle content_block_start events for tool use
    if (data['type'] === 'content_block_start') {
      const contentBlock = data['content_block'] as Record<string, unknown> | undefined;
      if (contentBlock?.['type'] === 'tool_use') {
        const toolName = contentBlock['name'] as string;
        return this.formatToolMessage(toolName, {}, fixType);
      }
    }

    // Handle result events
    if (data['type'] === 'result') {
      return `${fixType}: Processing results...`;
    }

    return null;
  }

  /**
   * Format a tool usage message for display.
   */
  private formatToolMessage(
    toolName: string,
    input: Record<string, unknown>,
    fixType: FixType
  ): string {
    const prefix = `${fixType}:`;
    switch (toolName) {
      case 'Read': {
        const filePath = input['file_path'] as string | undefined;
        return `${prefix} Reading ${filePath?.split('/').pop() || 'file'}...`;
      }
      case 'Glob':
        return `${prefix} Searching for ${(input['pattern'] as string) || 'files'}...`;
      case 'Grep':
        return `${prefix} Searching for "${(input['pattern'] as string) || 'pattern'}"...`;
      case 'Bash':
        return `${prefix} Running command...`;
      case 'Edit': {
        const editPath = input['file_path'] as string | undefined;
        return `${prefix} Editing ${editPath?.split('/').pop() || 'file'}...`;
      }
      case 'Write': {
        const writePath = input['file_path'] as string | undefined;
        return `${prefix} Writing ${writePath?.split('/').pop() || 'file'}...`;
      }
      case 'mcp__crawlforge__deep_research':
        return `${prefix} Researching best practices...`;
      case 'mcp__crawlforge__search_web':
        return `${prefix} Searching for solutions...`;
      case 'mcp__crawlforge__extract_content':
        return `${prefix} Analyzing documentation...`;
      default:
        return `${prefix} Using ${toolName}...`;
    }
  }

  /**
   * Emit progress event to renderer.
   * Sends to fix:progress:{taskId}:{fixType} channel.
   * Format matches FixProgressResponse interface expected by renderer.
   */
  emitProgress(
    taskId: string,
    fixType: FixType,
    message: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'FIX_APPLIED' | 'COMPLETED' | 'FAILED' = 'IN_PROGRESS'
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:progress:${taskId}:${fixType}`, {
        taskId,
        fixType,
        status,
        currentActivity: {
          message,
          timestamp: Date.now(),
        },
      });
    }
  }

  /**
   * Emit completion event to renderer for a specific fix.
   *
   * @param taskId - Task ID
   * @param fixType - Type of fix that completed
   * @param success - Whether the fix succeeded
   * @param error - Optional error message if failed
   * @param summary - Optional summary of the fix result
   */
  private emitComplete(
    taskId: string,
    fixType: FixType,
    success: boolean,
    error?: string,
    summary?: string
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:complete:${taskId}`, {
        taskId,
        fixType,
        success,
        error,
        summary,
      });
    }
  }
}

// Export singleton instance
export const fixAgentPool = new FixAgentPoolManager();
