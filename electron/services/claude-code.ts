/**
 * Claude Code Service
 *
 * Manages Claude Code CLI integration for task automation.
 * Handles spawning Claude Code processes, session management, and terminal integration.
 */

import { terminalManager } from './terminal.js';
import { databaseService } from './database.js';
import type { BrowserWindow } from 'electron';

// ============================================================================
// Stream JSON Parser for Claude Code Output
// ============================================================================

/**
 * Types for Claude Code stream-json output format
 *
 * The actual format from Claude Code is:
 * - Top-level type: "system", "assistant", "user", "result"
 * - For assistant messages with tools: message.content[].type = "tool_use"
 * - For tool results: message.content[].type = "tool_result"
 */
interface StreamJsonMessage {
  type: string;
  subtype?: string;
  content?: string;
  // For assistant/user message types
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: string;
      is_error?: boolean;
    }>;
  };
  // Legacy fields (kept for compatibility)
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  result?: unknown;
  error?: string;
}

/**
 * Status message sent to the renderer for clean display
 */
export interface ClaudeStatusMessage {
  /** Type of status message */
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'system';
  /** Human-readable status message */
  message: string;
  /** Optional details */
  details?: string;
  /** Tool name if applicable */
  tool?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Parses Claude Code stream-json output and generates human-readable status messages
 */
class StreamJsonParser {
  private _lineBuffer = '';

  /**
   * System subtypes that should be filtered out (internal/non-user-facing)
   */
  private static readonly FILTERED_SYSTEM_SUBTYPES: Set<string> = new Set([
    'hook_setup',
    'hook_output',
    'init',
    'statusline-setup',
    'statusline',
  ]);

  /**
   * Patterns to filter in system subtypes (partial matches)
   */
  private static readonly FILTERED_SUBTYPE_PATTERNS: string[] = [
    'hook',
    'setup',
    'init',
  ];

  /**
   * Tool display names with simple verbs (no details/file paths)
   */
  private static readonly TOOL_DISPLAY: Record<string, string> = {
    Read: 'Reading files...',
    Write: 'Writing files...',
    Edit: 'Editing code...',
    Bash: 'Running command...',
    Glob: 'Searching files...',
    Grep: 'Searching code...',
    WebFetch: 'Fetching web content...',
    WebSearch: 'Searching the web...',
    TodoWrite: 'Updating tasks...',
    Skill: 'Running skill...',
    NotebookEdit: 'Editing notebook...',
    Task: 'Running sub-agent...',
  };

  /**
   * Parse incoming data chunk and extract status messages
   *
   * @param chunk - Raw data chunk from terminal
   * @returns Array of parsed status messages
   */
  parse(chunk: string): ClaudeStatusMessage[] {
    const messages: ClaudeStatusMessage[] = [];

    // Add chunk to line buffer
    this._lineBuffer += chunk;

    // Debug: Log chunk receipt (abbreviated for large chunks)
    const chunkPreview = chunk.length > 200 ? `${chunk.substring(0, 200)}... (${String(chunk.length)} bytes)` : chunk;
    console.log(`[StreamJsonParser] Received chunk: ${chunkPreview.replace(/\n/g, '\\n')}`);

    // Process complete lines (ending with newline)
    const lines = this._lineBuffer.split('\n');
    // Keep the last incomplete line in buffer
    this._lineBuffer = lines.pop() || '';

    console.log(`[StreamJsonParser] Processing ${String(lines.length)} complete lines, buffer has ${String(this._lineBuffer.length)} bytes remaining`);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(trimmed) as StreamJsonMessage;
        console.log(`[StreamJsonParser] Parsed JSON with type: ${parsed.type}`);
        const statusMessage = this.processMessage(parsed);
        if (statusMessage) {
          console.log(`[StreamJsonParser] Generated status message: ${statusMessage.message}`);
          messages.push(statusMessage);
        }
      } catch {
        // Not valid JSON - could be regular terminal output
        // Log for debugging (abbreviated)
        const linePreview = trimmed.length > 100 ? `${trimmed.substring(0, 100)}...` : trimmed;
        console.log(`[StreamJsonParser] Non-JSON line (skipped): ${linePreview}`);
      }
    }

    console.log(`[StreamJsonParser] Returning ${String(messages.length)} status messages`);
    return messages;
  }

  /**
   * Check if a system subtype should be filtered out
   *
   * @param subtype - The subtype to check
   * @returns True if the subtype should be filtered
   */
  private isFilteredSubtype(subtype: string | undefined): boolean {
    if (!subtype) return false;

    // Check exact matches
    if (StreamJsonParser.FILTERED_SYSTEM_SUBTYPES.has(subtype)) {
      return true;
    }

    // Check partial matches (contains hook, setup, or init)
    const lowerSubtype = subtype.toLowerCase();
    return StreamJsonParser.FILTERED_SUBTYPE_PATTERNS.some(pattern =>
      lowerSubtype.includes(pattern)
    );
  }

  /**
   * Check if content looks like internal JSON (starts with {)
   *
   * @param content - The content to check
   * @returns True if content looks like JSON
   */
  private isJsonContent(content: string | undefined): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  /**
   * Process a parsed stream-json message into a status message
   *
   * @param msg - Parsed JSON message
   * @returns Status message or null if not displayable
   */
  private processMessage(msg: StreamJsonMessage): ClaudeStatusMessage | null {
    const timestamp = Date.now();

    // Debug logging to trace what's being processed
    console.log(`[StreamJsonParser] Processing message type: ${msg.type}, subtype: ${msg.subtype || 'none'}`);

    switch (msg.type) {
      case 'assistant':
        // Check for tool_use inside the message content
        if (msg.message?.content) {
          for (const item of msg.message.content) {
            if (item.type === 'tool_use' && item.name) {
              // Found a tool use - generate status message
              const statusMessage = StreamJsonParser.TOOL_DISPLAY[item.name] || `Using ${item.name}...`;
              console.log(`[StreamJsonParser] Tool use detected: ${item.name} -> "${statusMessage}"`);
              return {
                type: 'tool_start',
                message: statusMessage,
                tool: item.name,
                timestamp,
              };
            }
            // Check for thinking content
            if (item.type === 'text' && item.text) {
              // Text responses - we could show "Responding..." but skip for now
              // to avoid noise
            }
          }
        }
        // Claude is responding with text (legacy format check)
        if (msg.subtype === 'thinking' && msg.content) {
          return {
            type: 'thinking',
            message: 'Thinking...',
            timestamp,
          };
        }
        // Regular text response - skip status for normal text flow
        return null;

      case 'user':
        // Check for tool_result inside the message content
        if (msg.message?.content) {
          for (const item of msg.message.content) {
            if (item.type === 'tool_result') {
              // Tool completed - only show errors
              if (item.is_error) {
                console.log(`[StreamJsonParser] Tool error detected`);
                return {
                  type: 'error',
                  message: `Tool error: ${item.content || 'Unknown error'}`,
                  timestamp,
                };
              }
              // Success - no status message needed, next tool_use will show progress
              console.log(`[StreamJsonParser] Tool result (success) - skipping status`);
            }
          }
        }
        return null;

      case 'tool_use':
        // Legacy format (kept for compatibility)
        return this.processToolUse(msg, timestamp);

      case 'tool_result':
        // Legacy format (kept for compatibility)
        return this.processToolResult(msg, timestamp);

      case 'error':
        return {
          type: 'error',
          message: `Error: ${msg.error || msg.content || 'Unknown error'}`,
          timestamp,
        };

      case 'result':
        // Final result message - show completion status
        if (msg.subtype === 'success') {
          console.log(`[StreamJsonParser] Result success detected`);
          return {
            type: 'system',
            message: 'Task completed',
            timestamp,
          };
        }
        return null;

      case 'system':
        // Filter out internal system messages by subtype
        if (this.isFilteredSubtype(msg.subtype)) {
          console.log(`[StreamJsonParser] Filtered system subtype: ${msg.subtype}`);
          return null;
        }

        // Filter out JSON-like content (internal data)
        if (this.isJsonContent(msg.content)) {
          return null;
        }

        // Only show meaningful user-facing system messages
        if (msg.content) {
          return {
            type: 'system',
            message: msg.content,
            timestamp,
          };
        }
        return null;

      default:
        console.log(`[StreamJsonParser] Unknown message type: ${msg.type}`);
        return null;
    }
  }

  /**
   * Process a tool_use message into a simple status message
   *
   * @param msg - Tool use message
   * @param timestamp - Message timestamp
   * @returns Status message
   */
  private processToolUse(msg: StreamJsonMessage, timestamp: number): ClaudeStatusMessage | null {
    if (!msg.name) return null;

    // Get simple status message for the tool (no file paths or details)
    const statusMessage = StreamJsonParser.TOOL_DISPLAY[msg.name] || `Using ${msg.name}...`;

    return {
      type: 'tool_start',
      message: statusMessage,
      tool: msg.name,
      timestamp,
    };
  }

  /**
   * Process a tool_result message
   *
   * @param msg - Tool result message
   * @param timestamp - Message timestamp
   * @returns Status message or null
   */
  private processToolResult(msg: StreamJsonMessage, timestamp: number): ClaudeStatusMessage | null {
    // Only show errors in tool results, success is implicit
    if (msg.error) {
      return {
        type: 'error',
        message: `Tool error: ${msg.error}`,
        timestamp,
      };
    }

    // For successful results, we don't need to show a status
    // The next tool_use or text response will indicate progress
    return null;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this._lineBuffer = '';
  }
}

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
  /** Skip permission prompts for programmatic execution (default: true) */
  skipPermissions?: boolean | undefined;
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

      // Create a parser for this terminal session
      const parser = new StreamJsonParser();

      // Spawn terminal for Claude Code
      terminalManager.spawn(terminalId, `Claude Code - ${options.taskTitle}`, {
        cwd: options.projectPath,
        onData: (data: string) => {
          // Debug: log received data
          console.log(`[ClaudeCodeService] onData received ${String(data.length)} bytes`);

          // Stream raw output to renderer for the terminal display
          mainWindow.webContents.send(`terminal:output:${terminalId}`, data);

          // Parse stream-json output and send clean status updates
          const statusMessages = parser.parse(data);
          console.log(`[ClaudeCodeService] Parser returned ${String(statusMessages.length)} status messages`);
          for (const status of statusMessages) {
            console.log(`[ClaudeCodeService] Sending status to renderer: ${status.message}`);
            mainWindow.webContents.send(`terminal:status:${terminalId}`, status);
          }
        },
        onExit: (code: number) => {
          // Debug: log exit event
          console.log(`[ClaudeCodeService] onExit called with exit code: ${String(code)}`);

          // Send completion status message
          const completionStatus: ClaudeStatusMessage = {
            type: code === 0 ? 'system' : 'error',
            message: code === 0 ? '✅ Task completed successfully' : `❌ Task failed with exit code ${String(code)}`,
            timestamp: Date.now(),
          };
          mainWindow.webContents.send(`terminal:status:${terminalId}`, completionStatus);

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

      // Send initial status message
      const startStatus: ClaudeStatusMessage = {
        type: 'system',
        message: `🚀 Starting: ${options.taskTitle}`,
        timestamp: Date.now(),
      };
      mainWindow.webContents.send(`terminal:status:${terminalId}`, startStatus);

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
      '--dangerously-skip-permissions', // Skip permission prompts for programmatic execution
      '--output-format stream-json', // Streaming output
      '--verbose', // Required for stream-json
      `--resume ${this.escapeShellArgument(options.sessionId)}`, // Resume with session ID
    ];

    // If a prompt is provided, include it as an argument
    if (options.prompt) {
      const escapedPrompt = this.escapeShellArgument(options.prompt);
      commandParts.push(escapedPrompt);
    }

    const command = commandParts.join(' ');

    // Create a parser for this terminal session
    const parser = new StreamJsonParser();

    // Spawn terminal for Claude Code
    terminalManager.spawn(terminalId, `Claude Code (Resumed) - ${options.taskId}`, {
      cwd: options.projectPath,
      onData: (data: string) => {
        // Stream raw output to renderer for the terminal display
        mainWindow.webContents.send(`terminal:output:${terminalId}`, data);

        // Parse stream-json output and send clean status updates
        const statusMessages = parser.parse(data);
        for (const status of statusMessages) {
          mainWindow.webContents.send(`terminal:status:${terminalId}`, status);
        }
      },
      onExit: (code: number) => {
        // Send completion status message
        const completionStatus: ClaudeStatusMessage = {
          type: code === 0 ? 'system' : 'error',
          message: code === 0 ? '✅ Task completed successfully' : `❌ Task failed with exit code ${String(code)}`,
          timestamp: Date.now(),
        };
        mainWindow.webContents.send(`terminal:status:${terminalId}`, completionStatus);

        // Update task status based on exit code
        void this.handleTaskExit(options.taskId, code, mainWindow);

        // Notify renderer of process exit
        mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
      },
    });

    // Send simple resume banner
    const banner = [
      '\r\n',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n',
      '🔄 Resuming Claude Code Session\r\n',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n',
      '\r\n',
    ].join('');
    mainWindow.webContents.send(`terminal:output:${terminalId}`, banner);

    // Send initial status message
    const startStatus: ClaudeStatusMessage = {
      type: 'system',
      message: '🔄 Resuming session...',
      timestamp: Date.now(),
    };
    mainWindow.webContents.send(`terminal:status:${terminalId}`, startStatus);

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
   * Build a simplified startup banner to display before executing Claude Code command.
   * Shows just the task title and a simple starting message.
   *
   * @param _command - The Claude CLI command (unused in simplified banner)
   * @param options - Claude Code options containing context
   * @returns Formatted banner string with terminal line endings
   */
  private buildStartupBanner(_command: string, options: ClaudeCodeOptions): string {
    const banner: string[] = [];

    // Simple, clean header
    banner.push('\r\n');
    banner.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n');
    banner.push(`🤖 Task: ${options.taskTitle}\r\n`);
    banner.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n');
    banner.push('\r\n');
    banner.push('🚀 Starting Claude Code...\r\n');
    banner.push('\r\n');

    return banner.join('');
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

    // Skip permission prompts for programmatic execution (default: true)
    // This is standard practice for programmatic Claude Code execution
    // Requires user to have accepted terms once by running `claude --dangerously-skip-permissions` manually
    if (options.skipPermissions !== false) {
      parts.push('--dangerously-skip-permissions');
    }

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
