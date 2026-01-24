/**
 * Review Agent Pool Manager
 *
 * Manages a pool of concurrent AI review agents that analyze task changes
 * for security, quality, performance, documentation, and research issues.
 */

import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { databaseService } from './database.js';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('ReviewAgentPool');

/**
 * Types of reviews that can be performed
 */
export type ReviewType =
  | 'security'
  | 'quality'
  | 'performance'
  | 'documentation'
  | 'research';

/**
 * Options for starting a review agent
 */
export interface ReviewAgentOptions {
  /** Task ID being reviewed */
  taskId: string;
  /** Type of review to perform */
  reviewType: ReviewType;
  /** Path to the project directory */
  projectPath: string;
  /** Description of the task for context */
  taskDescription: string;
  /** List of changed files to focus the review on */
  changedFiles?: string[];
}

/**
 * Represents an active review agent
 */
interface ReviewAgent {
  /** Unique identifier for the agent */
  id: string;
  /** Task ID being reviewed */
  taskId: string;
  /** Type of review being performed */
  reviewType: ReviewType;
  /** Database ID of the TaskReview record */
  reviewId: string;
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
 * Review finding from an agent
 */
export interface ReviewFinding {
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Short title of the finding */
  title: string;
  /** Detailed description */
  description: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
}

/**
 * Parsed review output
 */
interface ReviewOutput {
  score: number;
  findings: ReviewFinding[];
  error?: string;
}

/**
 * Review prompts for each review type
 */
const REVIEW_PROMPTS: Record<ReviewType, string> = {
  security: `You are a security reviewer. Analyze the recent changes for:
- Injection vulnerabilities (XSS, SQL injection, command injection)
- Authentication/authorization issues
- Sensitive data exposure
- OWASP Top 10 issues
- Insecure dependencies or configurations

Output your findings wrapped in XML tags with this exact format:
<review_json>{"score": 0-100, "findings": [{"severity": "critical|high|medium|low", "title": "string", "description": "string", "file": "optional string", "line": "optional number"}]}</review_json>

IMPORTANT: Output ONLY the <review_json>...</review_json> tag with valid JSON inside. No other text.`,

  quality: `You are a code quality reviewer. Analyze the recent changes for:
- Code readability and maintainability
- SOLID principles adherence
- Error handling patterns
- Code duplication
- Naming conventions
- Function/method complexity

Output your findings wrapped in XML tags with this exact format:
<review_json>{"score": 0-100, "findings": [{"severity": "critical|high|medium|low", "title": "string", "description": "string", "file": "optional string", "line": "optional number"}]}</review_json>

IMPORTANT: Output ONLY the <review_json>...</review_json> tag with valid JSON inside. No other text.`,

  performance: `You are a performance reviewer. Analyze the recent changes for:
- Algorithm complexity issues (O(n^2) or worse)
- Memory leaks potential
- Unnecessary re-renders (React)
- Bundle size impact
- Database query efficiency
- Caching opportunities

Output your findings wrapped in XML tags with this exact format:
<review_json>{"score": 0-100, "findings": [{"severity": "critical|high|medium|low", "title": "string", "description": "string", "file": "optional string", "line": "optional number"}]}</review_json>

IMPORTANT: Output ONLY the <review_json>...</review_json> tag with valid JSON inside. No other text.`,

  documentation: `You are a documentation reviewer. Analyze the recent changes for:
- Missing JSDoc/comments for complex logic
- Outdated documentation
- API documentation completeness
- README updates needed
- Type documentation

Output your findings wrapped in XML tags with this exact format:
<review_json>{"score": 0-100, "findings": [{"severity": "critical|high|medium|low", "title": "string", "description": "string", "file": "optional string", "line": "optional number"}]}</review_json>

IMPORTANT: Output ONLY the <review_json>...</review_json> tag with valid JSON inside. No other text.`,

  research: `You are a research assistant. For each issue found in the code review:
- Use mcp__crawlforge__deep_research to find current best practices and solutions (up to January 2026)
- Search for relevant documentation, blog posts, and official recommendations
- Provide actionable suggestions with links to sources

Focus on:
- Security vulnerabilities and their recommended fixes
- Performance optimization patterns
- Modern API patterns and deprecations
- Testing best practices

For each issue, research the latest solutions and provide specific recommendations with source links.

Output your findings wrapped in XML tags with this exact format:
<review_json>{"score": 0-100, "findings": [{"severity": "critical|high|medium|low", "title": "string", "description": "string with source links where applicable", "file": "optional string", "line": "optional number"}]}</review_json>

IMPORTANT: Output ONLY the <review_json>...</review_json> tag with valid JSON inside. No other text.`,
};

/**
 * ReviewAgentPoolManager manages concurrent AI review agents.
 *
 * Features:
 * - Concurrent review execution with configurable limit
 * - Per-task review tracking
 * - Automatic result parsing and storage
 * - Graceful cancellation support
 */
class ReviewAgentPoolManager {
  /** Maximum number of concurrent review agents */
  private readonly MAX_CONCURRENT = 4;

  /** Map of active agents by agent ID */
  private activeAgents: Map<string, ReviewAgent> = new Map();

  /** Map of task IDs to their review agent IDs */
  private taskReviewMap: Map<string, Set<string>> = new Map();

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
   * Start a single review agent.
   *
   * @param options - Review agent configuration
   * @param mainWindow - BrowserWindow for IPC events
   * @returns The agent ID
   */
  async startReviewAgent(
    options: ReviewAgentOptions,
    mainWindow: BrowserWindow
  ): Promise<string> {
    this.mainWindow = mainWindow;

    const agentId = randomUUID();
    const prisma = databaseService.getClient();

    try {
      // Create or update TaskReview record with PENDING status
      const existingReview = await prisma.taskReview.findUnique({
        where: {
          taskId_reviewType: {
            taskId: options.taskId,
            reviewType: options.reviewType,
          },
        },
      });

      let reviewId: string;
      if (existingReview) {
        const updated = await prisma.taskReview.update({
          where: { id: existingReview.id },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            completedAt: null,
            score: null,
            summary: null,
            findings: '[]',
          },
        });
        reviewId = updated.id;
      } else {
        const created = await prisma.taskReview.create({
          data: {
            taskId: options.taskId,
            reviewType: options.reviewType,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });
        reviewId = created.id;
      }

      // Build the review prompt
      const prompt = this.buildReviewPrompt(options);

      // Build Claude Code arguments
      const args = this.buildClaudeArgs(prompt);

      // DEBUG: Log the full command being executed
      logger.info(
        `[${options.reviewType}] DEBUG: Spawning claude with args: ${JSON.stringify(args)}`
      );
      logger.info(`[${options.reviewType}] DEBUG: Working directory: ${options.projectPath}`);

      // Spawn Claude Code process
      const claudeProcess = spawn('claude', args, {
        cwd: options.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      logger.info(
        `Started ${options.reviewType} review agent for task ${options.taskId} (agent: ${agentId}, PID: ${String(claudeProcess.pid)})`
      );

      // Create the agent record
      const agent: ReviewAgent = {
        id: agentId,
        taskId: options.taskId,
        reviewType: options.reviewType,
        reviewId,
        process: claudeProcess,
        status: 'running',
        outputBuffer: '',
        currentMessage: `Starting ${options.reviewType} review...`,
        partialLineBuffer: '',
        spawnConfirmed: false,
      };

      // Store the agent
      this.activeAgents.set(agentId, agent);

      // Track agent for this task
      let taskAgents = this.taskReviewMap.get(options.taskId);
      if (!taskAgents) {
        taskAgents = new Set();
        this.taskReviewMap.set(options.taskId, taskAgents);
      }
      taskAgents.add(agentId);

      // IMMEDIATELY emit progress so UI shows RUNNING status
      void this.emitDetailedProgress(
        options.taskId,
        options.reviewType,
        `${options.reviewType}: Initializing review agent...`
      ).catch((err) => logger.error('Failed to emit progress:', err));

      // Handle the 'spawn' event to confirm process actually started
      claudeProcess.on('spawn', () => {
        agent.spawnConfirmed = true;
        logger.info(
          `[${options.reviewType}] DEBUG: spawn event fired - process started successfully (PID: ${String(claudeProcess.pid)})`
        );

        // Clear spawn timeout since we confirmed spawn
        if (agent.spawnTimeoutHandle) {
          clearTimeout(agent.spawnTimeoutHandle);
          agent.spawnTimeoutHandle = undefined;
        }

        // Update status to show process is running
        agent.currentMessage = `${options.reviewType}: Review agent running...`;
        void this.emitDetailedProgress(
          options.taskId,
          options.reviewType,
          agent.currentMessage
        ).catch((err) => logger.error('Failed to emit progress:', err));
      });

      // Set up spawn confirmation timeout (5 seconds)
      agent.spawnTimeoutHandle = setTimeout(() => {
        if (!agent.spawnConfirmed && agent.status === 'running') {
          logger.error(
            `[${options.reviewType}] ERROR: spawn event did not fire within 5 seconds - process may have failed to start`
          );
          agent.currentMessage = `${options.reviewType}: Failed to start (spawn timeout)`;
          void this.handleAgentError(
            agentId,
            new Error('Process spawn confirmation timeout - claude CLI may not be in PATH')
          );
        }
      }, 5000);

      // Set up no-output timeout (90 seconds)
      agent.timeoutHandle = setTimeout(() => {
        if (agent.status === 'running' && agent.outputBuffer.length === 0) {
          logger.error(
            `[${options.reviewType}] ERROR: No output received within 90 seconds - marking as failed`
          );
          agent.currentMessage = `${options.reviewType}: Timed out (no output)`;
          void this.handleAgentError(
            agentId,
            new Error('Review agent timeout - no output received within 90 seconds')
          );
          // Kill the process if it's still running
          try {
            claudeProcess.kill();
          } catch {
            // Process may already be dead
          }
        }
      }, 90000);

      // Handle 'error' event on spawn (e.g., ENOENT if claude not in PATH)
      claudeProcess.on('error', (err: Error) => {
        logger.error(`[${options.reviewType}] Process error:`, err);
        logger.error(
          `[${options.reviewType}] DEBUG: This may indicate 'claude' CLI is not in PATH or not executable`
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
        agent.currentMessage = `${options.reviewType}: Failed - ${err.message}`;
        void this.handleAgentError(agentId, err);
      });

      // Close stdin to start processing
      claudeProcess.stdin?.end();
      logger.info(`[${options.reviewType}] DEBUG: stdin closed to trigger CLI processing`);

      // Handle stdout with real-time stream-json parsing
      if (claudeProcess.stdout) {
        logger.info(`[${options.reviewType}] DEBUG: Attaching stdout data handler`);
        claudeProcess.stdout.setEncoding('utf8');

        claudeProcess.stdout.on('data', (data: string) => {
          logger.info(
            `[${options.reviewType}] DEBUG: stdout received ${String(data.length)} chars`
          );
          logger.info(
            `[${options.reviewType}] DEBUG: stdout preview: ${data.substring(0, 200).replace(/\n/g, '\\n')}`
          );

          // Reset no-output timeout since we received data
          if (agent.timeoutHandle) {
            clearTimeout(agent.timeoutHandle);
            agent.timeoutHandle = undefined;
          }

          // Set a new activity timeout - if no more data received within 120 seconds after last output,
          // consider the process as stalled and handle graceful completion
          agent.timeoutHandle = setTimeout(() => {
            if (agent.status === 'running') {
              logger.warn(
                `[${options.reviewType}] WARN: No output received for 120 seconds after last data - attempting graceful completion`
              );

              // Try to complete the review with whatever output we have
              void this.handleGracefulCompletion(agentId).catch((err) => {
                logger.error(`[${options.reviewType}] Failed graceful completion:`, err);
              });

              // Kill the process if it's still running
              try {
                claudeProcess.kill();
              } catch {
                // Process may already be dead
              }
            }
          }, 120000);

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
              const statusMessage = this.extractStatusMessage(parsed, options.reviewType);
              if (statusMessage) {
                agent.currentMessage = statusMessage;
                void this.emitDetailedProgress(options.taskId, options.reviewType, statusMessage)
                  .catch((err) => logger.error('Failed to emit progress:', err));
              }
            } catch {
              // Non-JSON or partial line, skip
            }
          }
        });

        // Log stdout end/close events
        claudeProcess.stdout.on('end', () => {
          logger.info(`[${options.reviewType}] DEBUG: stdout stream ended`);
        });
        claudeProcess.stdout.on('close', () => {
          logger.info(`[${options.reviewType}] DEBUG: stdout stream closed`);
        });
      } else {
        logger.warn(`[${options.reviewType}] DEBUG: stdout is null - no output stream available`);
      }

      // Handle stderr
      if (claudeProcess.stderr) {
        claudeProcess.stderr.setEncoding('utf8');
        claudeProcess.stderr.on('data', (data: string) => {
          logger.warn(`[${options.reviewType}] stderr: ${data}`);
        });
      }

      // Handle process exit
      claudeProcess.on('exit', (code: number | null, signal: string | null) => {
        logger.info(
          `[${options.reviewType}] DEBUG: Process exited with code ${String(code)}, signal ${String(signal)}`
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

      // Send progress event to confirm agent is running
      void this.emitProgress(options.taskId)
        .catch((err) => logger.error('Failed to emit progress:', err));

      return agentId;
    } catch (error) {
      logger.error(
        `Failed to start ${options.reviewType} review agent for task ${options.taskId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start all reviews for a task.
   *
   * @param taskId - Task ID to review
   * @param projectPath - Project directory path
   * @param taskDescription - Task description for context
   * @param mainWindow - BrowserWindow for IPC events
   * @param reviewTypes - Types of reviews to run (default: security, quality, performance)
   */
  async startAllReviews(
    taskId: string,
    projectPath: string,
    taskDescription: string,
    mainWindow: BrowserWindow,
    reviewTypes: ReviewType[] = ['security', 'quality', 'performance']
  ): Promise<void> {
    // Clear any previous review agents for this task to prevent duplication
    this.taskReviewMap.delete(taskId);

    logger.info(`Starting ${String(reviewTypes.length)} reviews for task ${taskId}`);

    // Delete any existing TaskReview records for this task that are not in the requested types
    // This ensures the UI shows only the correct number of review icons
    const prisma = databaseService.getClient();
    await prisma.taskReview.deleteMany({
      where: {
        taskId,
        reviewType: {
          notIn: reviewTypes,
        },
      },
    });

    // Update task status to AI_REVIEW
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'AI_REVIEW' },
    });

    // Emit initial progress
    void this.emitProgress(taskId)
      .catch((err) => logger.error('Failed to emit progress:', err));

    // Start agents respecting MAX_CONCURRENT
    const pending = [...reviewTypes];
    const startNextBatch = async (): Promise<void> => {
      while (
        pending.length > 0 &&
        this.getActiveAgentsCount() < this.MAX_CONCURRENT
      ) {
        const reviewType = pending.shift();
        if (reviewType) {
          await this.startReviewAgent(
            {
              taskId,
              reviewType,
              projectPath,
              taskDescription,
            },
            mainWindow
          );
        }
      }
    };

    await startNextBatch();
  }

  /**
   * Get the status of an agent.
   *
   * @param agentId - Agent ID to query
   * @returns The agent or undefined if not found
   */
  getAgentStatus(agentId: string): ReviewAgent | undefined {
    return this.activeAgents.get(agentId);
  }

  /**
   * Check if all reviews for a task are complete.
   *
   * @param taskId - Task ID to check
   * @returns True if all reviews are complete
   */
  areAllReviewsComplete(taskId: string): boolean {
    const agentIds = this.taskReviewMap.get(taskId);
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
   * Cancel all reviews for a task.
   *
   * @param taskId - Task ID to cancel reviews for
   */
  cancelReviews(taskId: string): void {
    const agentIds = this.taskReviewMap.get(taskId);
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
          logger.info(`Cancelled ${agent.reviewType} review agent ${agentId}`);
        } catch (error) {
          logger.error(`Failed to kill agent ${agentId}:`, error);
        }
      }
    }

    this.taskReviewMap.delete(taskId);
  }

  /**
   * Get all active agents for a task.
   *
   * @param taskId - Task ID to query
   * @returns Array of active agents
   */
  getActiveReviewsForTask(taskId: string): ReviewAgent[] {
    const agentIds = this.taskReviewMap.get(taskId);
    if (!agentIds) {
      return [];
    }

    const agents: ReviewAgent[] = [];
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
   * Build the review prompt with context.
   */
  private buildReviewPrompt(options: ReviewAgentOptions): string {
    const basePrompt = REVIEW_PROMPTS[options.reviewType];
    const lines: string[] = [];

    lines.push('# Code Review Task');
    lines.push('');
    lines.push(`## Task Description`);
    lines.push(options.taskDescription);
    lines.push('');

    if (options.changedFiles && options.changedFiles.length > 0) {
      lines.push('## Changed Files');
      for (const file of options.changedFiles) {
        lines.push(`- ${file}`);
      }
      lines.push('');
    }

    lines.push('## Review Instructions');
    lines.push(basePrompt);

    return lines.join('\n');
  }

  /**
   * Build Claude Code arguments for a review.
   */
  private buildClaudeArgs(prompt: string): string[] {
    return [
      '-p', // Print mode
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose', // Required when using --print with --output-format=stream-json
      '--max-turns',
      '5', // Limit turns for review
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

    const prisma = databaseService.getClient();

    if (exitCode === 0) {
      // Parse the output
      const result = this.parseReviewOutput(agent.outputBuffer);

      // Check if parsing failed (score === -1 indicates parse failure)
      if (result.score === -1) {
        // Mark as failed due to parse error
        await prisma.taskReview.update({
          where: { id: agent.reviewId },
          data: {
            status: 'FAILED',
            summary: result.error || 'Failed to parse review output',
            completedAt: new Date(),
          },
        });

        agent.status = 'failed';
        logger.warn(
          `${agent.reviewType} review failed for task ${agent.taskId} (parse error: ${result.error || 'unknown'})`
        );
      } else {
        // Update TaskReview with results
        await prisma.taskReview.update({
          where: { id: agent.reviewId },
          data: {
            status: 'COMPLETED',
            score: result.score,
            summary: `Found ${String(result.findings.length)} issue(s)`,
            findings: JSON.stringify(result.findings),
            completedAt: new Date(),
          },
        });

        agent.status = 'completed';
        logger.info(
          `${agent.reviewType} review completed for task ${agent.taskId} (score: ${String(result.score)})`
        );
      }
    } else {
      // Mark as failed
      await prisma.taskReview.update({
        where: { id: agent.reviewId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      agent.status = 'failed';
      logger.warn(
        `${agent.reviewType} review failed for task ${agent.taskId} (exit code: ${String(exitCode)})`
      );
    }

    // Emit progress event
    void this.emitProgress(agent.taskId)
      .catch((err) => logger.error('Failed to emit progress:', err));

    // Check if all reviews are complete
    if (this.areAllReviewsComplete(agent.taskId)) {
      this.emitComplete(agent.taskId);
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
      logger.warn(`[${agent.reviewType}] Agent already marked as failed, skipping duplicate error handling`);
      return;
    }

    const prisma = databaseService.getClient();

    // Mark as failed
    try {
      await prisma.taskReview.update({
        where: { id: agent.reviewId },
        data: {
          status: 'FAILED',
          summary: error.message,
          completedAt: new Date(),
        },
      });
    } catch (dbError) {
      logger.error(`[${agent.reviewType}] Failed to update database:`, dbError);
    }

    agent.status = 'failed';
    agent.currentMessage = `${agent.reviewType}: Failed - ${error.message}`;

    // Emit detailed progress with failure status so UI updates
    void this.emitDetailedProgress(
      agent.taskId,
      agent.reviewType,
      agent.currentMessage
    ).catch((err) => logger.error('Failed to emit progress:', err));

    // Also emit general progress
    void this.emitProgress(agent.taskId)
      .catch((err) => logger.error('Failed to emit progress:', err));

    // Check if all reviews are complete (including failures)
    if (this.areAllReviewsComplete(agent.taskId)) {
      this.emitComplete(agent.taskId);
    }
  }

  /**
   * Handle graceful completion when process is stalled but has output.
   * Attempts to parse whatever output we have and complete the review.
   */
  private async handleGracefulCompletion(agentId: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Prevent double-handling if already completed or failed
    if (agent.status !== 'running') {
      logger.warn(`[${agent.reviewType}] Agent already ${agent.status}, skipping graceful completion`);
      return;
    }

    const prisma = databaseService.getClient();

    // Include any remaining partial line in the output buffer
    const fullOutput = agent.outputBuffer + agent.partialLineBuffer;

    logger.info(`[${agent.reviewType}] Attempting graceful completion with ${String(fullOutput.length)} chars of output`);

    // Try to parse the output
    const result = this.parseReviewOutput(fullOutput);

    if (result.score >= 0) {
      // Successfully parsed - mark as completed
      await prisma.taskReview.update({
        where: { id: agent.reviewId },
        data: {
          status: 'COMPLETED',
          score: result.score,
          summary: `Found ${String(result.findings.length)} issue(s) (graceful completion)`,
          findings: JSON.stringify(result.findings),
          completedAt: new Date(),
        },
      });

      agent.status = 'completed';
      logger.info(
        `${agent.reviewType} review gracefully completed for task ${agent.taskId} (score: ${String(result.score)})`
      );
    } else {
      // Could not parse - mark as failed with informative message
      const summary = fullOutput.length > 0
        ? `Review stalled after receiving output (${String(fullOutput.length)} chars) - parsing failed`
        : 'Review stalled without producing parseable output';

      await prisma.taskReview.update({
        where: { id: agent.reviewId },
        data: {
          status: 'FAILED',
          summary,
          completedAt: new Date(),
        },
      });

      agent.status = 'failed';
      logger.warn(
        `${agent.reviewType} review failed for task ${agent.taskId} (graceful completion - parse failure)`
      );
    }

    agent.currentMessage = agent.status === 'completed'
      ? `${agent.reviewType}: Completed`
      : `${agent.reviewType}: Failed (stalled)`;

    // Emit progress update
    void this.emitDetailedProgress(
      agent.taskId,
      agent.reviewType,
      agent.currentMessage
    ).catch((err) => logger.error('Failed to emit progress:', err));

    void this.emitProgress(agent.taskId)
      .catch((err) => logger.error('Failed to emit progress:', err));

    // Check if all reviews are complete
    if (this.areAllReviewsComplete(agent.taskId)) {
      this.emitComplete(agent.taskId);
    }
  }

  /**
   * Extract JSON with balanced braces from text starting at a given position.
   * Handles nested objects and arrays properly.
   *
   * @param text - The text to extract JSON from
   * @param startIndex - The index of the opening brace
   * @returns The extracted JSON string or null if braces are unbalanced
   */
  private extractBalancedJson(text: string, startIndex: number): string | null {
    if (text[startIndex] !== '{') {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }

    return null; // Unbalanced braces
  }

  /**
   * Find and extract JSON containing a "score" field from text.
   * Uses balanced brace matching to handle nested structures.
   *
   * @param text - The text to search for JSON
   * @returns Parsed ReviewOutput or null if not found
   */
  private extractScoreJson(text: string): ReviewOutput | null {
    // Find all potential JSON start positions (opening braces)
    let searchStart = 0;
    while (searchStart < text.length) {
      const braceIndex = text.indexOf('{', searchStart);
      if (braceIndex === -1) {
        break;
      }

      const jsonStr = this.extractBalancedJson(text, braceIndex);
      if (jsonStr && jsonStr.includes('"score"')) {
        try {
          const parsed = JSON.parse(jsonStr) as ReviewOutput;
          if (typeof parsed.score === 'number') {
            return {
              score: Math.max(0, Math.min(100, parsed.score)),
              findings: Array.isArray(parsed.findings) ? parsed.findings : [],
            };
          }
        } catch {
          // This JSON didn't parse, continue searching
        }
      }

      searchStart = braceIndex + 1;
    }

    return null;
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
   * Handles both "type": "assistant" messages with content arrays
   * and "type": "result" events.
   *
   * @param output - The raw NDJSON output from Claude's stream-json format
   * @returns Concatenated text content from all messages
   */
  private extractTextFromStreamJson(output: string): string {
    const textParts: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;

        // Handle "type": "assistant" messages with content array
        if (parsed['type'] === 'assistant' && parsed['message']) {
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
        if (parsed['type'] === 'result' && typeof parsed['result'] === 'string') {
          textParts.push(parsed['result']);
        }
      } catch {
        // Non-JSON line, skip
      }
    }

    return textParts.join('\n');
  }

  /**
   * Parse review output from Claude Code.
   * Handles stream-json NDJSON format where output is wrapped in event structures.
   */
  private parseReviewOutput(output: string): ReviewOutput {
    try {
      // Step 1: Extract all text content from stream-json NDJSON format
      const concatenatedText = this.extractTextFromStreamJson(output);

      // Step 2: Look for <review_json>...</review_json> tags in concatenated text
      const xmlJsonContent = this.extractFromXmlTags(concatenatedText, 'review_json');
      if (xmlJsonContent) {
        try {
          const parsed = JSON.parse(xmlJsonContent) as ReviewOutput;
          if (typeof parsed.score === 'number') {
            const result = {
              score: Math.max(0, Math.min(100, parsed.score)),
              findings: Array.isArray(parsed.findings) ? parsed.findings : [],
            };
            logger.info(`Parsed review score from XML tags: ${String(result.score)} with ${String(result.findings.length)} findings`);
            return result;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON from XML tags:', parseError);
        }
      }

      // Step 3: Also check raw output for XML tags (in case format differs)
      const rawXmlContent = this.extractFromXmlTags(output, 'review_json');
      if (rawXmlContent) {
        try {
          const parsed = JSON.parse(rawXmlContent) as ReviewOutput;
          if (typeof parsed.score === 'number') {
            const result = {
              score: Math.max(0, Math.min(100, parsed.score)),
              findings: Array.isArray(parsed.findings) ? parsed.findings : [],
            };
            logger.info(`Parsed review score from raw XML tags: ${String(result.score)} with ${String(result.findings.length)} findings`);
            return result;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON from raw XML tags:', parseError);
        }
      }

      // Step 4: Fall back to balanced brace extraction from concatenated text
      if (concatenatedText.includes('"score"')) {
        const result = this.extractScoreJson(concatenatedText);
        if (result) {
          logger.info(`Parsed review score from concatenated text: ${String(result.score)} with ${String(result.findings.length)} findings`);
          return result;
        }
      }

      // Step 5: Try to find JSON in raw output lines (legacy approach)
      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.includes('"score"')) {
          const result = this.extractScoreJson(trimmed);
          if (result) {
            logger.info(`Parsed review score from raw line: ${String(result.score)} with ${String(result.findings.length)} findings`);
            return result;
          }
        }
      }

      // Parsing failed - return error indicator instead of default score
      logger.error('Failed to parse review output - no valid JSON found');
      logger.error(`Output buffer length: ${String(output.length)} chars`);
      logger.error(`Concatenated text length: ${String(concatenatedText.length)} chars`);
      logger.error(`Output buffer preview (first 500 chars): ${output.substring(0, 500).replace(/\n/g, '\\n')}`);
      logger.error(`Output buffer preview (last 500 chars): ${output.substring(Math.max(0, output.length - 500)).replace(/\n/g, '\\n')}`);
      logger.error(`Concatenated text preview: ${concatenatedText.substring(0, 500).replace(/\n/g, '\\n')}`);

      return { score: -1, findings: [], error: 'Failed to parse review output' };
    } catch (error) {
      logger.error('Error parsing review output:', error);
      logger.error(`Output buffer on error (first 500 chars): ${output.substring(0, 500).replace(/\n/g, '\\n')}`);
      return { score: -1, findings: [], error: `Parse error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Extract a human-readable status message from stream-json parsed data.
   */
  private extractStatusMessage(parsed: unknown, reviewType: ReviewType): string | null {
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
            return this.formatToolMessage(toolName, input, reviewType);
          }
          if (block['type'] === 'thinking') {
            return `${reviewType}: Analyzing...`;
          }
          if (block['type'] === 'text') {
            const text = block['text'] as string;
            if (text && text.length > 0) {
              return `${reviewType}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`;
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
        return this.formatToolMessage(toolName, {}, reviewType);
      }
    }

    // Handle result events - this means Claude has finished and is returning the final result
    if (data['type'] === 'result') {
      return `${reviewType}: Finalizing review...`;
    }

    return null;
  }

  /**
   * Format a tool usage message for display.
   */
  private formatToolMessage(
    toolName: string,
    input: Record<string, unknown>,
    reviewType: ReviewType
  ): string {
    const prefix = `${reviewType}:`;
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
      default:
        return `${prefix} Using ${toolName}...`;
    }
  }

  /**
   * Calculate the overall review workflow status based on agent states.
   * @param agents - Array of review agents for a task
   * @returns Overall status: 'pending' | 'in_progress' | 'completed' | 'failed'
   */
  private calculateOverallStatus(
    agents: ReviewAgent[]
  ): 'pending' | 'in_progress' | 'completed' | 'failed' {
    if (agents.length === 0) {
      return 'pending';
    }

    const hasRunning = agents.some((a) => a.status === 'running');
    const hasFailed = agents.some((a) => a.status === 'failed');
    const allCompleted = agents.every((a) => a.status === 'completed');

    if (hasRunning) {
      return 'in_progress';
    }
    if (allCompleted) {
      return 'completed';
    }
    if (hasFailed) {
      return 'failed';
    }
    return 'in_progress';
  }

  /**
   * Map internal agent status to ReviewStatus type expected by frontend.
   * @param status - Internal agent status ('running' | 'completed' | 'failed')
   * @returns ReviewStatus ('PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED')
   */
  private mapAgentStatusToReviewStatus(
    status: 'running' | 'completed' | 'failed'
  ): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
    switch (status) {
      case 'running':
        return 'RUNNING';
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  /**
   * Build the reviews array matching ReviewProgressResponse interface.
   * Fetches additional data from database for completed reviews.
   * @param agents - Array of review agents for a task
   * @returns Promise resolving to reviews array for ReviewProgressResponse
   */
  private async buildReviewsArray(
    agents: ReviewAgent[]
  ): Promise<
    Array<{
      reviewType: ReviewType;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      score?: number;
      summary?: string;
      findingsCount: number;
    }>
  > {
    const prisma = databaseService.getClient();
    const reviews: Array<{
      reviewType: ReviewType;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      score?: number;
      summary?: string;
      findingsCount: number;
    }> = [];

    for (const agent of agents) {
      let score: number | null = null;
      let summary: string | null = null;
      let findingsCount = 0;

      // For completed or failed reviews, fetch data from database
      if (agent.status === 'completed' || agent.status === 'failed') {
        try {
          const dbReview = await prisma.taskReview.findUnique({
            where: { id: agent.reviewId },
          });
          if (dbReview) {
            score = dbReview.score;
            summary = dbReview.summary;
            const findings = JSON.parse(dbReview.findings || '[]') as unknown[];
            findingsCount = findings.length;
          }
        } catch {
          // If we can't fetch, continue with defaults
        }
      }

      // Build review object, only including optional properties if they have values
      const reviewItem: {
        reviewType: ReviewType;
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        score?: number;
        summary?: string;
        findingsCount: number;
      } = {
        reviewType: agent.reviewType,
        status: this.mapAgentStatusToReviewStatus(agent.status),
        findingsCount,
      };

      if (score !== null) {
        reviewItem.score = score;
      }
      if (summary !== null) {
        reviewItem.summary = summary;
      }

      reviews.push(reviewItem);
    }

    return reviews;
  }

  /**
   * Calculate overall score from completed reviews.
   * @param agents - Array of review agents for a task
   * @returns Promise resolving to average score or undefined if no scores available
   */
  private async calculateOverallScore(agents: ReviewAgent[]): Promise<number | undefined> {
    const prisma = databaseService.getClient();
    const scores: number[] = [];

    for (const agent of agents) {
      if (agent.status === 'completed') {
        try {
          const dbReview = await prisma.taskReview.findUnique({
            where: { id: agent.reviewId },
          });
          if (dbReview?.score != null) {
            scores.push(dbReview.score);
          }
        } catch {
          // Continue if fetch fails
        }
      }
    }

    if (scores.length === 0) {
      return undefined;
    }

    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }

  /**
   * Emit detailed progress event with current activity to renderer.
   * Matches ReviewProgressResponse interface from src/types/ipc.ts
   */
  private async emitDetailedProgress(
    taskId: string,
    reviewType: ReviewType,
    message: string
  ): Promise<void> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const agents = this.getActiveReviewsForTask(taskId);
      const status = this.calculateOverallStatus(agents);
      const reviews = await this.buildReviewsArray(agents);
      const overallScore = await this.calculateOverallScore(agents);

      this.mainWindow.webContents.send(`review:progress:${taskId}`, {
        taskId,
        status,
        reviews,
        overallScore,
        currentActivity: {
          reviewType,
          message,
          timestamp: Date.now(),
        },
      });
    }
  }

  /**
   * Emit progress event to renderer.
   * Matches ReviewProgressResponse interface from src/types/ipc.ts
   */
  private async emitProgress(taskId: string): Promise<void> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const agents = this.getActiveReviewsForTask(taskId);
      const status = this.calculateOverallStatus(agents);
      const reviews = await this.buildReviewsArray(agents);
      const overallScore = await this.calculateOverallScore(agents);

      this.mainWindow.webContents.send(`review:progress:${taskId}`, {
        taskId,
        status,
        reviews,
        overallScore,
      });
    }
  }

  /**
   * Emit completion event to renderer.
   */
  private emitComplete(taskId: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`review:complete:${taskId}`, { taskId });
    }
  }
}

// Export singleton instance
export const reviewAgentPool = new ReviewAgentPoolManager();
