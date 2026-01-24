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

const logger = createIPCLogger('FixAgentPool');

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
}

/**
 * Current activity information for a fix agent
 */
export interface FixActivity {
  message: string;
  timestamp: number;
}

/**
 * Fix prompts for each fix type
 */
const FIX_PROMPTS: Record<FixType, string> = {
  security: `You are a security fix agent. Your task is to fix security vulnerabilities found during code review.

## Step 1: Research Best Practices
First, use mcp__crawlforge__deep_research to find current best practices (2024-2026) for fixing each security issue:
- Search for OWASP recommendations for the specific vulnerability types
- Look for security advisories and official fix patterns
- Find examples of proper secure coding patterns

## Step 2: Analyze the Code
Read the affected files to understand the current implementation and context.

## Step 3: Apply Fixes
Apply the fixes following the researched best practices:
- Fix injection vulnerabilities (XSS, SQL injection, command injection)
- Fix authentication/authorization issues
- Fix sensitive data exposure
- Apply proper input validation and output encoding
- Update insecure configurations

## Step 4: Verify
If possible, run relevant security-related tests to verify the fixes.

## Output Format
After completing the fixes, output your results in the following XML format:
<fix_json>{"success": true, "filesModified": ["path/to/file1.ts", "path/to/file2.ts"], "summary": "Fixed XSS vulnerability by adding proper output encoding, updated SQL queries to use parameterized statements", "researchSources": ["https://owasp.org/...", "https://cheatsheetseries.owasp.org/..."]}</fix_json>

If the fix fails, output:
<fix_json>{"success": false, "filesModified": [], "summary": "Failed to apply fix: reason", "researchSources": []}</fix_json>

IMPORTANT: Output ONLY the <fix_json>...</fix_json> tag with valid JSON inside at the end. No other text after the tag.`,

  quality: `You are a code quality fix agent. Your task is to improve code quality based on review findings.

## Step 1: Research Best Practices
First, use mcp__crawlforge__deep_research to find current best practices (2024-2026) for the quality issues:
- Search for modern TypeScript/JavaScript patterns and conventions
- Look for official style guides (e.g., Airbnb, Google)
- Find examples of clean code patterns and SOLID principles

## Step 2: Analyze the Code
Read the affected files to understand the current implementation and context.

## Step 3: Apply Fixes
Apply the fixes following the researched best practices:
- Improve code readability and maintainability
- Apply SOLID principles where appropriate
- Improve error handling patterns
- Reduce code duplication (DRY principle)
- Fix naming conventions
- Reduce function/method complexity

## Step 4: Verify
If possible, run linting and type checking to verify the fixes don't break anything.

## Output Format
After completing the fixes, output your results in the following XML format:
<fix_json>{"success": true, "filesModified": ["path/to/file1.ts", "path/to/file2.ts"], "summary": "Refactored complex function into smaller units, improved error handling with proper try-catch blocks, applied consistent naming conventions", "researchSources": ["https://typescript-eslint.io/...", "https://refactoring.guru/..."]}</fix_json>

If the fix fails, output:
<fix_json>{"success": false, "filesModified": [], "summary": "Failed to apply fix: reason", "researchSources": []}</fix_json>

IMPORTANT: Output ONLY the <fix_json>...</fix_json> tag with valid JSON inside at the end. No other text after the tag.`,
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
  private readonly MAX_CONCURRENT = 2;

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

    const fixTypes: FixType[] = ['security', 'quality'];

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
   * Build the fix prompt with findings context.
   */
  private buildFixPrompt(options: FixAgentOptions): string {
    const basePrompt = FIX_PROMPTS[options.fixType];
    const lines: string[] = [];

    lines.push('# Fix Task');
    lines.push('');
    lines.push(`## Fix Type: ${options.fixType.toUpperCase()}`);
    lines.push('');
    lines.push('## Findings to Fix');
    lines.push('');

    for (let i = 0; i < options.findings.length; i++) {
      const finding = options.findings[i]!;
      lines.push(`### Finding ${String(i + 1)}: ${finding.title}`);
      lines.push(`- **Severity:** ${finding.severity}`);
      lines.push(`- **Description:** ${finding.description}`);
      if (finding.file) {
        lines.push(`- **File:** ${finding.file}`);
      }
      if (finding.line) {
        lines.push(`- **Line:** ${String(finding.line)}`);
      }
      lines.push('');
    }

    lines.push('## Instructions');
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
      '15', // More turns for fixes since they include research
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
      const result = this.parseFixOutput(agent.outputBuffer);

      if (result.success) {
        // Update TaskFix with results
        await prisma.taskFix.update({
          where: { id: agent.fixId },
          data: {
            status: 'COMPLETED',
            summary: result.summary,
            patch: result.filesModified.join(', '),
            researchNotes: result.researchSources.join('\n'),
            completedAt: new Date(),
          },
        });

        agent.status = 'completed';
        logger.info(
          `${agent.fixType} fix completed for task ${agent.taskId} (files modified: ${String(result.filesModified.length)})`
        );
      } else {
        // Mark as failed due to fix failure
        await prisma.taskFix.update({
          where: { id: agent.fixId },
          data: {
            status: 'FAILED',
            summary: result.error || result.summary || 'Fix failed',
            completedAt: new Date(),
          },
        });

        agent.status = 'failed';
        logger.warn(
          `${agent.fixType} fix failed for task ${agent.taskId}: ${result.error || result.summary || 'Unknown error'}`
        );
      }
    } else {
      // Mark as failed
      await prisma.taskFix.update({
        where: { id: agent.fixId },
        data: {
          status: 'FAILED',
          summary: `Process exited with code ${String(exitCode)}`,
          completedAt: new Date(),
        },
      });

      agent.status = 'failed';
      logger.warn(
        `${agent.fixType} fix failed for task ${agent.taskId} (exit code: ${String(exitCode)})`
      );
    }

    // Emit progress event
    this.emitProgress(
      agent.taskId,
      agent.fixType,
      agent.status === 'completed'
        ? `${agent.fixType}: Fix completed`
        : `${agent.fixType}: Fix failed`
    );

    // Check if all fixes are complete
    if (this.areAllFixesComplete(agent.taskId)) {
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
    this.emitProgress(agent.taskId, agent.fixType, agent.currentMessage);

    // Check if all fixes are complete (including failures)
    if (this.areAllFixesComplete(agent.taskId)) {
      this.emitComplete(agent.taskId);
    }
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
  extractTextFromStreamJson(output: string): string {
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
      const concatenatedText = this.extractTextFromStreamJson(output);

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
            };
            if (!result.success && parsed.error) {
              result.error = parsed.error;
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
            };
            if (!result.success && parsed.error) {
              result.error = parsed.error;
            }
            logger.info(`Parsed fix output from raw XML tags: success=${String(result.success)}, files=${String(result.filesModified.length)}`);
            return result;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON from raw XML tags:', parseError);
        }
      }

      // Parsing failed
      logger.error('Failed to parse fix output - no valid JSON found');
      logger.error(`Output buffer length: ${String(output.length)} chars`);
      logger.error(`Concatenated text length: ${String(concatenatedText.length)} chars`);
      logger.error(`Output buffer preview (first 500 chars): ${output.substring(0, 500).replace(/\n/g, '\\n')}`);

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
   * Sends to fix:progress:{taskId}:{fixType} channel
   */
  emitProgress(taskId: string, fixType: FixType, message: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:progress:${taskId}:${fixType}`, {
        taskId,
        fixType,
        message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Emit completion event to renderer.
   */
  private emitComplete(taskId: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:complete:${taskId}`, { taskId });
    }
  }
}

// Export singleton instance
export const fixAgentPool = new FixAgentPoolManager();
