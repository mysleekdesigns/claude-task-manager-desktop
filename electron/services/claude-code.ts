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
      // Build the task prompt FIRST
      const taskPrompt = this.buildTaskPrompt(options);
      console.log(`[ClaudeCodeService] Built task prompt (${String(taskPrompt.length)} chars)`);
      console.log(`[ClaudeCodeService] Task prompt preview: ${taskPrompt.substring(0, 200)}...`);

      // Build the Claude Code command with the prompt included as an argument
      const command = this.buildClaudeCommand(options, taskPrompt);
      console.log(`[ClaudeCodeService] Built command with embedded prompt`);
      console.log(`[ClaudeCodeService] Full command: ${command}`);

      // Spawn terminal for Claude Code
      terminalManager.spawn(terminalId, `Claude Code - ${options.taskTitle}`, {
        cwd: options.projectPath,
        onData: (data: string) => {
          // Debug: log received data
          const preview = data.length > 100 ? data.substring(0, 100) + '...' : data;
          console.log(`[ClaudeCodeService] onData received ${String(data.length)} bytes, preview: ${JSON.stringify(preview)}`);

          // Stream output to renderer
          mainWindow.webContents.send(`terminal:output:${terminalId}`, data);
        },
        onExit: (code: number) => {
          // Debug: log exit event
          console.log(`[ClaudeCodeService] onExit called with exit code: ${String(code)}`);

          // Update task status based on exit code
          void this.handleTaskExit(options.taskId, code, mainWindow);

          // Notify renderer of process exit
          mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
        },
      });

      // Display startup banner BEFORE executing the command
      // Send banner directly to renderer via IPC instead of writing to terminal stdin
      // Writing to stdin causes the shell to try to execute the banner as commands
      const banner = this.buildStartupBanner(command, options);
      console.log(`[ClaudeCodeService] Sending startup banner via IPC`);
      mainWindow.webContents.send(`terminal:output:${terminalId}`, banner);

      // Disable shell echo to prevent command duplication in output
      // Split into two writes with delay to avoid race condition
      console.log(`[ClaudeCodeService] Disabling echo before command execution`);
      terminalManager.write(terminalId, `stty -echo 2>/dev/null\n`);

      // Delay to ensure echo is disabled before command runs (100ms buffer for slower systems)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then write the complete Claude Code command (with prompt included)
      console.log(`[ClaudeCodeService] Executing command with embedded prompt`);
      terminalManager.write(terminalId, `${command}\n`);

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
      console.error(`[ClaudeCodeService] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

      // Clean up terminal if it was created
      if (terminalManager.has(terminalId)) {
        try {
          terminalManager.kill(terminalId);
          console.log(`[ClaudeCodeService] Cleaned up terminal ${terminalId} after error`);
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

    // Build the resume command with proper flags
    const commandParts = [
      'claude',
      '-p', // Print mode (non-interactive)
      '--output-format stream-json', // Streaming output
      `--resume ${this.escapeShellArgument(options.sessionId)}`, // Resume with session ID
    ];

    // If a prompt is provided, include it as an argument
    if (options.prompt) {
      const escapedPrompt = this.escapeShellArgument(options.prompt);
      commandParts.push(escapedPrompt);
    }

    const command = commandParts.join(' ');

    // Spawn terminal for Claude Code
    terminalManager.spawn(terminalId, `Claude Code (Resumed) - ${options.taskId}`, {
      cwd: options.projectPath,
      onData: (data: string) => {
        // Stream output to renderer
        mainWindow.webContents.send(`terminal:output:${terminalId}`, data);
      },
      onExit: (code: number) => {
        // Update task status based on exit code
        void this.handleTaskExit(options.taskId, code, mainWindow);

        // Notify renderer of process exit
        mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
      },
    });

    // Disable shell echo to prevent command duplication in output
    console.log(`[ClaudeCodeService] Disabling echo before resume command`);
    terminalManager.write(terminalId, `stty -echo 2>/dev/null\n`);

    // Delay to ensure echo is disabled before command runs (100ms buffer for slower systems)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Write the complete resume command (with prompt if provided)
    console.log(`[ClaudeCodeService] Resuming with command: ${command}`);
    terminalManager.write(terminalId, `${command}\n`);

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
   * Build a startup banner to display before executing Claude Code command.
   * Shows the exact command, project path, and session ID clearly to the user.
   *
   * @param command - The Claude CLI command that will be executed
   * @param options - Claude Code options containing context
   * @returns Formatted banner string with terminal line endings
   */
  private buildStartupBanner(command: string, options: ClaudeCodeOptions): string {
    const banner: string[] = [];

    // Top border
    banner.push('╔════════════════════════════════════════════════════════════════════╗\r\n');

    // Title
    banner.push('║ Starting Claude Code                                                ║\r\n');

    // Separator
    banner.push('╠════════════════════════════════════════════════════════════════════╣\r\n');

    // Command (may need multiple lines if long)
    const commandLines = this.wrapText(`Command: ${command}`, 66);
    commandLines.forEach(line => {
      banner.push(`║ ${line.padEnd(66, ' ')} ║\r\n`);
    });

    // Project path
    const pathLines = this.wrapText(`Path: ${options.projectPath}`, 66);
    pathLines.forEach(line => {
      banner.push(`║ ${line.padEnd(66, ' ')} ║\r\n`);
    });

    // Session ID
    banner.push(`║ Session: ${options.sessionId.padEnd(56, ' ')} ║\r\n`);

    // Task ID
    banner.push(`║ Task ID: ${options.taskId.padEnd(56, ' ')} ║\r\n`);

    // Bottom border
    banner.push('╚════════════════════════════════════════════════════════════════════╝\r\n');

    // Add spacing
    banner.push('\r\n');

    return banner.join('');
  }

  /**
   * Wrap text to fit within a specified width, breaking at word boundaries.
   *
   * @param text - Text to wrap
   * @param maxWidth - Maximum width per line
   * @returns Array of wrapped lines
   */
  private wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) {
      return [text];
    }

    const lines: string[] = [];
    let currentLine = '';

    const words = text.split(' ');
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine.length > 0 ? ' ' : '') + word;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Build the Claude Code CLI command from options.
   *
   * @param options - Claude Code options
   * @param taskPrompt - The task prompt to include as a command argument
   * @returns Complete Claude CLI command
   */
  private buildClaudeCommand(options: ClaudeCodeOptions, taskPrompt: string): string {
    const parts = ['claude'];

    // Print mode (non-interactive) for programmatic use
    parts.push('-p');

    // Streaming JSON output format (requires --verbose)
    parts.push('--output-format stream-json');
    parts.push('--verbose');

    // Max turns
    if (options.maxTurns !== undefined) {
      parts.push(`--max-turns ${String(options.maxTurns)}`);
    }

    // Max budget
    if (options.maxBudget !== undefined) {
      parts.push(`--max-budget ${String(options.maxBudget)}`);
    }

    // Allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      parts.push(`--allowed-tools ${options.allowedTools.join(',')}`);
    }

    // Custom system prompt
    if (options.appendSystemPrompt) {
      // Escape the system prompt using proper shell escaping
      const escapedPrompt = this.escapeShellArgument(options.appendSystemPrompt);
      parts.push(`--append-system-prompt ${escapedPrompt}`);
    }

    // Add the task prompt as the final argument
    // Escape the prompt properly for shell execution
    if (taskPrompt) {
      const escapedPrompt = this.escapeShellArgument(taskPrompt);
      parts.push(escapedPrompt);
    }

    return parts.join(' ');
  }

  /**
   * Escape a string for use as a shell argument using POSIX $'...' quoting.
   * This handles quotes, newlines, and special characters correctly.
   *
   * @param str - String to escape
   * @returns Properly escaped string for shell
   */
  private escapeShellArgument(str: string): string {
    // Use $'...' POSIX quoting which properly handles escape sequences
    // Within $'...', we need to escape:
    // - Backslashes as \\ (must be first to avoid double-escaping)
    // - Single quotes as \'
    // - Newlines as \n (literal newlines would be interpreted as command separators)
    // - Carriage returns as \r
    // - Tabs as \t

    // Escape backslashes first (to avoid double-escaping subsequent replacements)
    let escaped = str.replace(/\\/g, '\\\\');

    // Escape single quotes
    escaped = escaped.replace(/'/g, "\\'");

    // Convert literal newlines to \n escape sequences
    // This is critical - literal newlines in $'...' break the command into multiple lines
    escaped = escaped.replace(/\n/g, '\\n');

    // Also escape carriage returns and tabs for completeness
    escaped = escaped.replace(/\r/g, '\\r');
    escaped = escaped.replace(/\t/g, '\\t');

    // Return with $'...' wrapper
    return `$'${escaped}'`;
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
          `[ClaudeCodeService] Task ${taskId} is PAUSED, not updating status on exit (exit code: ${String(exitCode)})`
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
          message: `Claude Code ${claudeStatus.toLowerCase()} with exit code ${String(exitCode)}`,
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
        `[ClaudeCodeService] Task ${taskId} completed with status ${claudeStatus} (exit code: ${String(exitCode)})`
      );
    } catch (error) {
      console.error(
        `[ClaudeCodeService] Error handling task exit for ${taskId}:`,
        error
      );
    }
  }

}

// Export singleton instance
export const claudeCodeService = new ClaudeCodeService();
