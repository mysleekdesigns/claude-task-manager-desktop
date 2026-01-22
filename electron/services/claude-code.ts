/**
 * Claude Code Service
 *
 * Manages Claude Code CLI integration for task automation.
 * Handles spawning Claude Code processes, session management, and terminal integration.
 */

import { terminalManager } from './terminal.js';
import { databaseService } from './database.js';
import { claudeHooksService } from './claude-hooks.js';
import { trayService } from './tray.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type { BrowserWindow } from 'electron';

const logger = createIPCLogger('ClaudeCode');

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
              // Found a tool use - generate contextual status message
              const contextualMessage = this.getContextualToolMessage(item.name, item.input);
              console.log(`[StreamJsonParser] Tool use detected: ${item.name} -> "${contextualMessage}"`);
              return {
                type: 'tool_start',
                message: contextualMessage,
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
   * Process a tool_use message into a contextual status message
   *
   * @param msg - Tool use message
   * @param timestamp - Message timestamp
   * @returns Status message
   */
  private processToolUse(msg: StreamJsonMessage, timestamp: number): ClaudeStatusMessage | null {
    if (!msg.name) return null;

    // Get contextual status message for the tool using input parameters
    const contextualMessage = this.getContextualToolMessage(msg.name, msg.input);

    return {
      type: 'tool_start',
      message: contextualMessage,
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
   * Generate contextual status message based on tool name and input
   *
   * @param toolName - Name of the tool being used
   * @param input - Tool input parameters
   * @returns Human-readable status message
   */
  private getContextualToolMessage(toolName: string, input?: Record<string, unknown>): string {
    if (!input) {
      return StreamJsonParser.TOOL_DISPLAY[toolName] || `Using ${toolName}...`;
    }

    switch (toolName) {
      case 'Bash': {
        // Prefer Claude's description if available
        const description = input['description'];
        if (description && typeof description === 'string') {
          return description;
        }
        return this.parseBashCommand(input['command'] as string | undefined);
      }

      case 'Read': {
        const readPath = input['file_path'] as string | undefined;
        const fileName = readPath?.split('/').pop() || 'file';
        return `Reading ${fileName}`;
      }

      case 'Write': {
        const writePath = input['file_path'] as string | undefined;
        const writeFileName = writePath?.split('/').pop() || 'file';
        return `Writing ${writeFileName}`;
      }

      case 'Edit': {
        const editPath = input['file_path'] as string | undefined;
        const editFileName = editPath?.split('/').pop() || 'file';
        return `Editing ${editFileName}`;
      }

      case 'Glob': {
        const pattern = input['pattern'] as string | undefined;
        return `Searching for ${pattern || 'files'}`;
      }

      case 'Grep': {
        const pattern = input['pattern'] as string | undefined;
        return `Searching for "${pattern || 'pattern'}"`;
      }

      case 'Task': {
        const taskDescription = input['description'] as string | undefined;
        if (taskDescription) {
          return taskDescription;
        }
        return 'Running sub-task...';
      }

      case 'TodoWrite': {
        return 'Updating task list...';
      }

      default:
        return StreamJsonParser.TOOL_DISPLAY[toolName] || `Using ${toolName}...`;
    }
  }

  /**
   * Parse Bash command to extract meaningful action description
   *
   * @param command - The bash command to parse
   * @returns Human-readable description of the command
   */
  private parseBashCommand(command: string | undefined): string {
    if (!command) return 'Running command...';

    // Package installation patterns - npm
    const npmInstall = command.match(/npm\s+(?:install|i|add)\s+(?:-[^\s]+\s+)*([\w@\/-]+)/);
    if (npmInstall?.[1]) return `Installing ${npmInstall[1]}`;

    // Package installation patterns - pnpm
    const pnpmAdd = command.match(/pnpm\s+(?:add|install|i)\s+(?:-[^\s]+\s+)*([\w@\/-]+)/);
    if (pnpmAdd?.[1]) return `Installing ${pnpmAdd[1]}`;

    // Package installation patterns - yarn
    const yarnAdd = command.match(/yarn\s+add\s+(?:-[^\s]+\s+)*([\w@\/-]+)/);
    if (yarnAdd?.[1]) return `Installing ${yarnAdd[1]}`;

    // Package installation patterns - bun
    const bunAdd = command.match(/bun\s+(?:add|install|i)\s+(?:-[^\s]+\s+)*([\w@\/-]+)/);
    if (bunAdd?.[1]) return `Installing ${bunAdd[1]}`;

    // shadcn/ui component installation
    const shadcn = command.match(/(?:npx\s+)?shadcn(?:@[\w.-]+)?(?:\s+ui)?\s+add\s+([\w\s-]+)/i);
    if (shadcn?.[1]) {
      const components = shadcn[1].trim();
      return `Adding shadcn ${components} component${components.includes(' ') ? 's' : ''}`;
    }

    // npx create commands
    const npxCreate = command.match(/npx\s+create-([\w-]+)/);
    if (npxCreate?.[1]) return `Creating ${npxCreate[1]} project`;

    // General npx commands
    const npx = command.match(/npx\s+([\w@\/-]+)/);
    if (npx?.[1]) return `Running ${npx[1]}`;

    // Git operations
    if (command.match(/git\s+clone/)) return 'Cloning repository';
    if (command.match(/git\s+pull/)) return 'Pulling changes';
    if (command.match(/git\s+push/)) return 'Pushing changes';
    if (command.match(/git\s+commit/)) return 'Committing changes';
    if (command.match(/git\s+checkout/)) return 'Switching branch';
    if (command.match(/git\s+merge/)) return 'Merging branches';
    if (command.match(/git\s+stash/)) return 'Stashing changes';
    if (command.match(/git\s+fetch/)) return 'Fetching from remote';

    // Build/dev commands
    if (command.match(/npm\s+run\s+build/)) return 'Building project';
    if (command.match(/npm\s+run\s+dev/)) return 'Starting dev server';
    if (command.match(/npm\s+run\s+start/)) return 'Starting application';
    if (command.match(/npm\s+(?:test|run\s+test)/)) return 'Running tests';
    if (command.match(/npm\s+run\s+lint/)) return 'Linting code';
    if (command.match(/pnpm\s+(?:build|run\s+build)/)) return 'Building project';
    if (command.match(/pnpm\s+(?:dev|run\s+dev)/)) return 'Starting dev server';
    if (command.match(/yarn\s+(?:build|run\s+build)/)) return 'Building project';
    if (command.match(/yarn\s+(?:dev|run\s+dev)/)) return 'Starting dev server';

    // Prisma commands
    if (command.match(/prisma\s+migrate/)) return 'Running database migration';
    if (command.match(/prisma\s+generate/)) return 'Generating Prisma client';
    if (command.match(/prisma\s+db\s+push/)) return 'Pushing database schema';
    if (command.match(/prisma\s+studio/)) return 'Opening Prisma Studio';

    // Directory operations
    const mkdir = command.match(/mkdir\s+(?:-[^\s]+\s+)*([^\s]+)/);
    if (mkdir?.[1]) {
      const dirName = mkdir[1].split('/').pop() || 'directory';
      return `Creating ${dirName} directory`;
    }

    // Remove operations
    const rm = command.match(/rm\s+(?:-[^\s]+\s+)*([^\s]+)/);
    if (rm?.[1]) {
      const target = rm[1].split('/').pop() || 'files';
      return `Removing ${target}`;
    }

    // Copy operations
    if (command.match(/cp\s+/)) return 'Copying files';

    // Move operations
    if (command.match(/mv\s+/)) return 'Moving files';

    // TypeScript check
    if (command.match(/tsc|typescript/)) return 'Type checking';

    // ESLint
    if (command.match(/eslint/)) return 'Linting code';

    // Prettier
    if (command.match(/prettier/)) return 'Formatting code';

    // Docker
    if (command.match(/docker\s+build/)) return 'Building Docker image';
    if (command.match(/docker\s+run/)) return 'Running Docker container';
    if (command.match(/docker-compose\s+up/)) return 'Starting Docker services';

    // Default: show abbreviated command
    const shortCommand = command.length > 40 ? command.substring(0, 40) + '...' : command;
    return `Running: ${shortCommand}`;
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
  /** Phase number if this task is scoped to a specific PRD phase */
  prdPhaseNumber?: number | undefined;
  /** Phase name for display */
  prdPhaseName?: string | undefined;
  /** Scoped PRD content (only this phase's requirements) */
  scopedPrdContent?: string | undefined;
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
   * Track tasks that are currently being paused.
   * Used to prevent sending failure messages when a task is intentionally paused.
   */
  private pausingTasks: Set<string> = new Set();

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

      // Generate hooks config for phase-scoped tasks
      let hooksConfigPath: string | undefined;
      if (options.prdPhaseNumber !== undefined && options.prdPhaseName) {
        console.log(`[ClaudeCodeService] Generating hooks config for Phase ${String(options.prdPhaseNumber)}: ${options.prdPhaseName}`);
        hooksConfigPath = await claudeHooksService.generatePhaseHooksConfig(
          options.prdPhaseNumber,
          options.prdPhaseName,
          options.projectPath
        );
        console.log(`[ClaudeCodeService] Hooks config generated at: ${hooksConfigPath}`);
      }

      // Create a parser for this terminal session
      const parser = new StreamJsonParser();

      // Define the onData callback
      const onDataCallback = (data: string): void => {
          // Debug: log received data
          console.log(`[ClaudeCodeService] onData received ${String(data.length)} bytes`);

          // Check if window exists before sending events
          if (!mainWindow || mainWindow.isDestroyed()) {
            console.log(`[ClaudeCodeService] Window destroyed, skipping data send`);
            return;
          }

          // Stream raw output to renderer for the terminal display
          mainWindow.webContents.send(`terminal:output:${terminalId}`, data);

          // Parse stream-json output and send clean status updates
          const statusMessages = parser.parse(data);
          console.log(`[ClaudeCodeService] Parser returned ${String(statusMessages.length)} status messages`);
          for (const status of statusMessages) {
            console.log(`[ClaudeCodeService] Sending status to renderer: ${status.message}`);
            // Cache the status before sending to renderer
            lastStatusCache.set(terminalId, status);
            mainWindow.webContents.send(`terminal:status:${terminalId}`, status);
          }
      };

      // Define the onExit callback
      const onExitCallback = (code: number): void => {
          // Debug: log exit event
          console.log(`[ClaudeCodeService] onExit called with exit code: ${String(code)}`);

          // Check if window exists before sending events
          const windowValid = mainWindow && !mainWindow.isDestroyed();

          // Check if this task is being paused - if so, don't send failure message
          const isPausing = this.pausingTasks.has(options.taskId);
          if (isPausing) {
            console.log(`[ClaudeCodeService] Task ${options.taskId} is being paused, skipping failure message`);
            // Send a paused status instead of failure
            const pausedStatus: ClaudeStatusMessage = {
              type: 'system',
              message: '⏸️ Task paused',
              timestamp: Date.now(),
            };
            lastStatusCache.set(terminalId, pausedStatus);
            if (windowValid) {
              mainWindow.webContents.send(`terminal:status:${terminalId}`, pausedStatus);
            }
            // Clear the pausing flag
            this.pausingTasks.delete(options.taskId);
          } else {
            // Send completion status message only if not pausing
            const completionStatus: ClaudeStatusMessage = {
              type: code === 0 ? 'system' : 'error',
              message: code === 0 ? '✅ Task completed successfully' : `❌ Task failed with exit code ${String(code)}`,
              timestamp: Date.now(),
            };
            // Cache the status before sending to renderer
            lastStatusCache.set(terminalId, completionStatus);
            if (windowValid) {
              mainWindow.webContents.send(`terminal:status:${terminalId}`, completionStatus);
            }
          }

          // Update task status based on exit code
          void this.handleTaskExit(options.taskId, code, mainWindow);

          // Notify renderer of process exit
          if (windowValid) {
            mainWindow.webContents.send(`terminal:exit:${terminalId}`, code);
          }

          // Clear status cache when terminal exits
          lastStatusCache.delete(terminalId);
      };

      // Spawn terminal for Claude Code with conditional env
      if (hooksConfigPath) {
        // With hooks config environment variable
        terminalManager.spawn(terminalId, `Claude Code - ${options.taskTitle}`, {
          cwd: options.projectPath,
          env: { CLAUDE_CODE_HOOKS_FILE: hooksConfigPath },
          onData: onDataCallback,
          onExit: onExitCallback,
        });
      } else {
        // Without hooks config
        terminalManager.spawn(terminalId, `Claude Code - ${options.taskTitle}`, {
          cwd: options.projectPath,
          onData: onDataCallback,
          onExit: onExitCallback,
        });
      }

      // Display startup banner BEFORE executing the command
      // Send banner directly to renderer via IPC instead of writing to terminal stdin
      // Writing to stdin causes the shell to try to execute the banner as commands
      const banner = this.buildStartupBanner(command, options);
      console.log(`[ClaudeCodeService] Sending startup banner via IPC`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:output:${terminalId}`, banner);
      }

      // Send initial status message
      const startStatus: ClaudeStatusMessage = {
        type: 'system',
        message: `🚀 Starting: ${options.taskTitle}`,
        timestamp: Date.now(),
      };
      // Cache the status before sending to renderer
      lastStatusCache.set(terminalId, startStatus);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:status:${terminalId}`, startStatus);
      }

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
   * Resume an existing Claude Code session by sending SIGCONT to the paused terminal.
   * This continues a process that was previously suspended with SIGSTOP.
   *
   * @param taskId - Task ID to resume
   * @param mainWindow - Main BrowserWindow for output streaming
   * @returns True if resume was successful, false otherwise
   */
  resumeTask(taskId: string, mainWindow: BrowserWindow): boolean {
    const terminalId = `claude-${taskId}`;

    if (!terminalManager.has(terminalId)) {
      console.error(`[ClaudeCodeService] Terminal ${terminalId} not found for resume`);
      return false;
    }

    // Clear the pausing flag since we're resuming
    this.clearPausingFlag(taskId);

    // Use terminalManager.resumeTerminal() which sends SIGCONT
    const success = terminalManager.resumeTerminal(terminalId);

    if (success) {
      // Check if window exists before sending events
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send resume status message to renderer
        const resumeStatus: ClaudeStatusMessage = {
          type: 'system',
          message: 'Resuming Claude Code...',
          timestamp: Date.now(),
        };
        lastStatusCache.set(terminalId, resumeStatus);
        mainWindow.webContents.send(`terminal:status:${terminalId}`, resumeStatus);

        // Send banner to terminal output
        const banner = [
          '\r\n',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n',
          '▶ Resumed Claude Code Session\r\n',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n',
          '\r\n',
        ].join('');
        mainWindow.webContents.send(`terminal:output:${terminalId}`, banner);
      }

      console.log(`[ClaudeCodeService] Resumed task ${taskId} via SIGCONT`);
    }

    return success;
  }

  /**
   * Pause a Claude Code task using SIGSTOP.
   * Suspends the terminal process without terminating it, allowing it to be resumed later.
   *
   * @param taskId - Task ID to pause
   * @returns True if pause was successful, false otherwise
   */
  pauseTask(taskId: string): boolean {
    const terminalId = `claude-${taskId}`;

    if (!terminalManager.has(terminalId)) {
      console.error(`[ClaudeCodeService] Claude Code terminal for task ${taskId} not found`);
      return false;
    }

    // Mark this task as being paused BEFORE sending SIGSTOP
    // This prevents the onExit handler from sending a failure message if the process exits
    this.pausingTasks.add(taskId);
    console.log(`[ClaudeCodeService] Marked task ${taskId} as pausing`);

    try {
      const success = terminalManager.pauseTerminal(terminalId);
      if (success) {
        console.log(`[ClaudeCodeService] Paused terminal ${terminalId} with SIGSTOP`);
      } else {
        console.error(`[ClaudeCodeService] Failed to pause terminal ${terminalId}`);
        // Clean up the pausing flag on failure
        this.pausingTasks.delete(taskId);
      }
      return success;
    } catch (error) {
      console.error(`[ClaudeCodeService] Error pausing task ${taskId}:`, error);
      // Clean up the pausing flag on error
      this.pausingTasks.delete(taskId);
      return false;
    }
  }

  /**
   * Check if a task is currently being paused.
   *
   * @param taskId - Task ID to check
   * @returns True if the task is being paused
   */
  isTaskPausing(taskId: string): boolean {
    return this.pausingTasks.has(taskId);
  }

  /**
   * Clear the pausing flag for a task.
   *
   * @param taskId - Task ID to clear
   */
  clearPausingFlag(taskId: string): void {
    this.pausingTasks.delete(taskId);
    console.log(`[ClaudeCodeService] Cleared pausing flag for task ${taskId}`);
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
   * If scopedPrdContent is provided, generates a phase-scoped prompt with
   * explicit boundary instructions to keep Claude focused on a single phase.
   *
   * @param options - Claude Code options
   * @returns Formatted task prompt
   */
  private buildTaskPrompt(options: ClaudeCodeOptions): string {
    const lines: string[] = [];

    // Task title
    lines.push(`# Task: ${options.taskTitle}`);
    lines.push('');

    // Check if this is a phase-scoped task
    if (options.scopedPrdContent && options.prdPhaseNumber !== undefined) {
      // Phase-scoped prompt with explicit boundaries
      const phaseName = options.prdPhaseName || `Phase ${options.prdPhaseNumber}`;
      const nextPhase = options.prdPhaseNumber + 1;

      lines.push('## Phase Scope');
      lines.push(`**CRITICAL: This task is scoped to Phase ${options.prdPhaseNumber}: ${phaseName} ONLY.**`);
      lines.push('');
      lines.push('You must:');
      lines.push(`- ONLY work on the requirements listed below for Phase ${options.prdPhaseNumber}`);
      lines.push(`- STOP immediately when Phase ${options.prdPhaseNumber} is complete`);
      lines.push('- DO NOT proceed to any other phases');
      lines.push('- DO NOT implement features from other phases');
      lines.push('');

      lines.push(`## Phase ${options.prdPhaseNumber} Requirements`);
      lines.push('');
      lines.push(options.scopedPrdContent);
      lines.push('');

      // Context section
      lines.push('## Context');
      lines.push('');
      lines.push('This task is being tracked in the Claude Tasks Desktop application.');
      lines.push(`Task ID: ${options.taskId}`);
      lines.push(`Session ID: ${options.sessionId}`);
      lines.push('');

      // Phase-specific instructions
      lines.push('## Instructions');
      lines.push('');
      lines.push(`1. Implement ONLY the requirements for Phase ${options.prdPhaseNumber} above`);
      lines.push(`2. When Phase ${options.prdPhaseNumber} is complete, STOP and provide a summary`);
      lines.push(`3. Do NOT proceed to Phase ${nextPhase} or any other phases`);
    } else {
      // Standard prompt (existing behavior)
      if (options.taskDescription) {
        lines.push('## Requirements');
        lines.push('');
        lines.push(options.taskDescription);
        lines.push('');
      }

      // Additional context
      lines.push('## Context');
      lines.push('');
      lines.push('This task is being tracked in the Claude Tasks Desktop application.');
      lines.push(`Task ID: ${options.taskId}`);
      lines.push(`Session ID: ${options.sessionId}`);
      lines.push('');

      // Instructions
      lines.push('## Instructions');
      lines.push('');
      lines.push('Please implement the requirements above following best practices.');
      lines.push('When complete, provide a summary of the changes made.');
    }

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
    // Skip database operations during app quit to prevent blocking shutdown
    if (trayService.getIsQuitting()) {
      logger.info('Skipping task exit handling during app quit');
      return;
    }

    try {
      const prisma = databaseService.getClient();

      // Get current task status and project path for hooks cleanup
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          claudeStatus: true,
          prdPhaseNumber: true,
          project: {
            select: { targetPath: true },
          },
        },
      });

      // Clean up hooks config if this was a phase-scoped task
      if (task?.prdPhaseNumber !== null && task?.project?.targetPath) {
        console.log(`[ClaudeCodeService] Cleaning up hooks config for phase-scoped task ${taskId}`);
        try {
          await claudeHooksService.cleanupHooksConfig(task.project.targetPath);
        } catch (cleanupError) {
          // Log but don't fail the exit handling
          console.error(`[ClaudeCodeService] Failed to cleanup hooks config:`, cleanupError);
        }
      }

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

      // Send completion event to renderer (check if window exists)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`claude:${claudeStatus.toLowerCase()}:${taskId}`, {
          taskId,
          exitCode,
          status: claudeStatus,
        });
      }

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

// ============================================================================
// Status Cache for Last Status per Terminal
// ============================================================================

/**
 * Cache of the last status message per terminal.
 * Used to restore status when the renderer reconnects or re-renders.
 */
const lastStatusCache = new Map<string, ClaudeStatusMessage>();

/**
 * Get the cached last status for a terminal.
 *
 * @param terminalId - The terminal ID
 * @returns The cached status message or null if not found
 */
export function getLastStatus(terminalId: string): ClaudeStatusMessage | null {
  return lastStatusCache.get(terminalId) || null;
}

/**
 * Set/update the cached status for a terminal.
 *
 * @param terminalId - The terminal ID
 * @param status - The status message to cache
 */
export function setLastStatus(terminalId: string, status: ClaudeStatusMessage): void {
  lastStatusCache.set(terminalId, status);
}

/**
 * Clear the cached status for a terminal.
 * Should be called when the terminal is destroyed.
 *
 * @param terminalId - The terminal ID
 */
export function clearLastStatus(terminalId: string): void {
  lastStatusCache.delete(terminalId);
}
