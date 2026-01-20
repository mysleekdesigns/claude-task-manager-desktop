/**
 * Claude Code Service
 *
 * Manages Claude Code CLI integration for task automation.
 * Handles spawning Claude Code processes, session management, and terminal integration.
 */

import { terminalManager } from './terminal.js';
import { databaseService } from './database.js';
import type { BrowserWindow } from 'electron';

/**
 * Options for starting a Claude Code task
 */
export interface ClaudeCodeOptions {
  /** Task ID for tracking */
  taskId: string;
  /** Task title for context */
  taskTitle: string;
  /** Task description with requirements */
  taskDescription: string;
  /** Project directory path */
  projectPath: string;
  /** Claude Code session ID */
  sessionId: string;
  /** Optional worktree ID if task runs in a worktree */
  worktreeId?: string | undefined;
  /** Maximum number of turns (default: unlimited) */
  maxTurns?: number | undefined;
  /** Maximum budget in USD (default: unlimited) */
  maxBudget?: number | undefined;
  /** Allowed tools for Claude (default: all) */
  allowedTools?: string[] | undefined;
  /** Custom system prompt to append */
  appendSystemPrompt?: string | undefined;
}

/**
 * Options for resuming a Claude Code task
 */
export interface ResumeTaskOptions {
  /** Task ID to resume */
  taskId: string;
  /** Session ID to resume */
  sessionId: string;
  /** Project path */
  projectPath: string;
  /** Optional prompt to send after resuming */
  prompt?: string | undefined;
}

/**
 * Result from starting a Claude Code task
 */
export interface ClaudeCodeStartResult {
  /** Terminal ID for the Claude process */
  terminalId: string;
  /** Session ID for the Claude session */
  sessionId: string;
}

/**
 * Result from resuming a Claude Code task
 */
export interface ClaudeCodeResumeResult {
  /** Terminal ID for the Claude process */
  terminalId: string;
}

/**
 * ClaudeCodeService manages Claude Code CLI processes for task automation.
 *
 * Features:
 * - Start Claude Code with task context
 * - Resume existing Claude sessions
 * - Pause/stop Claude sessions gracefully
 * - Build task prompts with requirements
 * - Configure Claude CLI options
 */
class ClaudeCodeService {
  /**
   * Start a new Claude Code task.
   *
   * @param options - Claude Code configuration options
   * @param mainWindow - Main BrowserWindow for output streaming
   * @returns Terminal ID and session ID
   */
  async startTask(
    options: ClaudeCodeOptions,
    mainWindow: BrowserWindow
  ): Promise<ClaudeCodeStartResult> {
    const terminalId = `claude-${options.taskId}`;

    try {
      // Build the Claude Code command
      const command = this.buildClaudeCommand(options);

      // Build the task prompt
      const taskPrompt = this.buildTaskPrompt(options);

      // Spawn terminal for Claude Code
      terminalManager.spawn(terminalId, `Claude Code - ${options.taskTitle}`, {
        cwd: options.projectPath,
        onData: (data: string) => {
          // Stream output to renderer
          mainWindow.webContents.send(`terminal:output:${terminalId}`, data);
        },
        onExit: async (code: number) => {
          // Update task status based on exit code
          await this.handleTaskExit(options.taskId, code, mainWindow);

          // Notify renderer of process exit
          mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
        },
      });

      // Write the Claude Code command to start the task
      terminalManager.write(terminalId, `${command}\n`);

      // Wait a moment for Claude to initialize
      await this.sleep(1000);

      // Send the task prompt
      if (taskPrompt) {
        terminalManager.write(terminalId, `${taskPrompt}\n`);
      }

      console.log(
        `[ClaudeCodeService] Successfully started Claude Code for task ${options.taskId} (terminal: ${terminalId})`
      );

      return {
        terminalId,
        sessionId: options.sessionId,
      };
    } catch (error) {
      console.error(
        `[ClaudeCodeService] Failed to start Claude Code for task ${options.taskId}:`,
        error
      );

      // Clean up terminal if it was created
      if (terminalManager.has(terminalId)) {
        try {
          terminalManager.kill(terminalId);
        } catch (killError) {
          console.error(
            `[ClaudeCodeService] Failed to clean up terminal ${terminalId}:`,
            killError
          );
        }
      }

      throw new Error(
        `Failed to start Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resume an existing Claude Code session.
   *
   * @param options - Resume task options
   * @param mainWindow - Main BrowserWindow for output streaming
   * @returns Terminal ID
   */
  async resumeTask(
    options: ResumeTaskOptions,
    mainWindow: BrowserWindow
  ): Promise<ClaudeCodeResumeResult> {
    const terminalId = `claude-${options.taskId}`;

    // Build the resume command
    const command = `claude --resume --session-id "${options.sessionId}" --verbose`;

    // Spawn terminal for Claude Code
    terminalManager.spawn(terminalId, `Claude Code (Resumed) - ${options.taskId}`, {
      cwd: options.projectPath,
      onData: (data: string) => {
        // Stream output to renderer
        mainWindow.webContents.send(`terminal:output:${terminalId}`, data);
      },
      onExit: async (code: number) => {
        // Update task status based on exit code
        await this.handleTaskExit(options.taskId, code, mainWindow);

        // Notify renderer of process exit
        mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
      },
    });

    // Write the resume command
    terminalManager.write(terminalId, `${command}\n`);

    // Wait a moment for Claude to initialize
    await this.sleep(1000);

    // Send additional prompt if provided
    if (options.prompt) {
      terminalManager.write(terminalId, `${options.prompt}\n`);
    }

    return {
      terminalId,
    };
  }

  /**
   * Pause a Claude Code task (graceful stop).
   * Sends Ctrl+C to the terminal to stop Claude gracefully, then kills the terminal.
   *
   * @param taskId - Task ID to pause
   */
  pauseTask(taskId: string): void {
    const terminalId = `claude-${taskId}`;

    if (!terminalManager.has(terminalId)) {
      throw new Error(`Claude Code terminal for task ${taskId} not found`);
    }

    try {
      // Send Ctrl+C to gracefully stop Claude
      terminalManager.write(terminalId, '\x03');

      // Wait briefly for graceful shutdown before killing the terminal
      setTimeout(() => {
        if (terminalManager.has(terminalId)) {
          terminalManager.kill(terminalId);
          console.log(`[ClaudeCodeService] Killed terminal ${terminalId} after pause`);
        }
      }, 500);
    } catch (error) {
      console.error(`[ClaudeCodeService] Error pausing task ${taskId}:`, error);
      // Try to kill the terminal anyway
      if (terminalManager.has(terminalId)) {
        terminalManager.kill(terminalId);
      }
      throw error;
    }
  }

  /**
   * Build the Claude Code CLI command from options.
   *
   * @param options - Claude Code options
   * @returns Complete Claude CLI command
   */
  private buildClaudeCommand(options: ClaudeCodeOptions): string {
    const parts = ['claude'];

    // Session tracking
    parts.push(`--session-id "${options.sessionId}"`);

    // Verbose logging
    parts.push('--verbose');

    // Max turns
    if (options.maxTurns !== undefined) {
      parts.push(`--max-turns ${options.maxTurns}`);
    }

    // Max budget
    if (options.maxBudget !== undefined) {
      parts.push(`--max-budget ${options.maxBudget}`);
    }

    // Allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      parts.push(`--allowed-tools ${options.allowedTools.join(',')}`);
    }

    // Custom system prompt
    if (options.appendSystemPrompt) {
      // Escape quotes in the system prompt
      const escapedPrompt = options.appendSystemPrompt.replace(/"/g, '\\"');
      parts.push(`--append-system-prompt "${escapedPrompt}"`);
    }

    return parts.join(' ');
  }

  /**
   * Build the task prompt from task details.
   *
   * @param options - Claude Code options
   * @returns Formatted task prompt
   */
  private buildTaskPrompt(options: ClaudeCodeOptions): string {
    const lines: string[] = [];

    // Task title
    lines.push(`# Task: ${options.taskTitle}`);
    lines.push('');

    // Task description
    if (options.taskDescription) {
      lines.push('## Requirements');
      lines.push('');
      lines.push(options.taskDescription);
      lines.push('');
    }

    // Additional context
    lines.push('## Context');
    lines.push('');
    lines.push(`This task is being tracked in the Claude Tasks Desktop application.`);
    lines.push(`Task ID: ${options.taskId}`);
    lines.push(`Session ID: ${options.sessionId}`);
    lines.push('');

    // Instructions
    lines.push('## Instructions');
    lines.push('');
    lines.push('Please implement the requirements above following best practices.');
    lines.push('When complete, provide a summary of the changes made.');

    return lines.join('\n');
  }

  /**
   * Handle terminal exit event for a Claude Code task.
   * Updates task status and sends completion event to renderer.
   *
   * @param taskId - Task ID
   * @param exitCode - Process exit code
   * @param mainWindow - Main BrowserWindow for events
   */
  private async handleTaskExit(
    taskId: string,
    exitCode: number,
    mainWindow: BrowserWindow
  ): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Get current task status
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { claudeStatus: true },
      });

      // If task is already PAUSED, don't overwrite the status
      // This happens when the terminal is killed after pausing
      if (task?.claudeStatus === 'PAUSED') {
        console.log(
          `[ClaudeCodeService] Task ${taskId} is PAUSED, not updating status on exit (exit code: ${exitCode})`
        );

        // Still clear the terminal ID since the process has exited
        await prisma.task.update({
          where: { id: taskId },
          data: {
            claudeTerminalId: null,
          },
        });

        return;
      }

      // Determine the final status based on exit code
      // Exit code 0 = success, non-zero = failure
      const claudeStatus = exitCode === 0 ? 'COMPLETED' : 'FAILED';

      // Update task with completion status and clear terminal ID
      await prisma.task.update({
        where: { id: taskId },
        data: {
          claudeStatus,
          claudeTerminalId: null,
          claudeCompletedAt: new Date(),
        },
      });

      // Add a log entry
      await prisma.taskLog.create({
        data: {
          taskId,
          type: exitCode === 0 ? 'success' : 'error',
          message: `Claude Code ${claudeStatus.toLowerCase()} with exit code ${exitCode}`,
          metadata: JSON.stringify({ exitCode }),
        },
      });

      // Send completion event to renderer
      mainWindow.webContents.send(`claude:${claudeStatus.toLowerCase()}:${taskId}`, {
        taskId,
        exitCode,
        status: claudeStatus,
      });

      console.log(
        `[ClaudeCodeService] Task ${taskId} completed with status ${claudeStatus} (exit code: ${exitCode})`
      );
    } catch (error) {
      console.error(
        `[ClaudeCodeService] Error handling task exit for ${taskId}:`,
        error
      );
    }
  }

  /**
   * Sleep utility for waiting.
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const claudeCodeService = new ClaudeCodeService();
