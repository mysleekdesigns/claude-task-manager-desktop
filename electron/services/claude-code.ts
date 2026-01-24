/**
 * Claude Code Service
 *
 * Manages Claude Code CLI integration for task automation.
 * Handles spawning Claude Code processes, session management, and terminal integration.
 *
 * Uses child_process.spawn instead of node-pty to prevent TTY detection,
 * ensuring Claude Code respects the --output-format stream-json flag.
 */

import { spawn, type ChildProcess } from 'child_process';
import { databaseService } from './database.js';
import { claudeHooksService } from './claude-hooks.js';
import { trayService } from './tray.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import { activityLogger, type ActivityEntry } from './activity-logger.js';
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
  // For stream_event messages (partial streaming with --include-partial-messages)
  event?: {
    type: string;
    index?: number;
    content_block?: {
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    };
    delta?: {
      type: string;
      text?: string;
      partial_json?: string;
      thinking?: string;
    };
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
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'command_failed' | 'system' | 'awaiting_input';
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
  private _toolUseMap: Map<string, { name: string; input?: Record<string, unknown> }> = new Map();
  private _lastToolUseFallback: { name: string; id?: string; input?: Record<string, unknown> } | null = null;

  /**
   * Strip ANSI escape sequences from a string.
   * This handles both CSI sequences (e.g., colors) and OSC sequences (e.g., terminal titles).
   *
   * @param str - String potentially containing ANSI escape codes
   * @returns Clean string with ANSI codes removed
   */
  private stripAnsiCodes(str: string): string {
    // Remove ANSI CSI sequences (e.g., \x1b[0m for reset, \x1b[31m for red)
    // Remove ANSI OSC sequences (e.g., \x1b]0;title\x07 for window title)
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
  }

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

    // Add buffer size limit - prevent unbounded buffer growth (1MB max)
    if (this._lineBuffer.length > 1024 * 1024) {
      console.error('[StreamJsonParser] Buffer exceeded 1MB limit, resetting');
      this._lineBuffer = '';
    }

    // Process complete lines (handle all line ending styles: \r\n, \n, or \r)
    const lines = this._lineBuffer.split(/\r?\n|\r/);
    // Keep the last incomplete line in buffer
    this._lineBuffer = lines.pop() || '';

    console.log(`[StreamJsonParser] Processing ${String(lines.length)} complete lines, buffer has ${String(this._lineBuffer.length)} bytes remaining`);

    for (const line of lines) {
      // Strip ANSI escape sequences before processing
      const trimmed = this.stripAnsiCodes(line).trim();
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
        // Track ALL tool_use blocks by ID, then return status for the last one
        let lastToolUseStatus: ClaudeStatusMessage | null = null;
        if (msg.message?.content) {
          for (const item of msg.message.content) {
            if (item.type === 'tool_use' && item.name) {
              // Store tool info in map by ID for correlation with tool_result
              if (item.id) {
                this._toolUseMap.set(item.id, {
                  name: item.name,
                  ...(item.input !== undefined && { input: item.input }),
                });
              }
              // Also keep fallback for legacy correlation (no ID matching)
              this._lastToolUseFallback = {
                name: item.name,
                ...(item.id !== undefined && { id: item.id }),
                ...(item.input !== undefined && { input: item.input }),
              };
              // Generate contextual status message for this tool use
              const contextualMessage = this.getContextualToolMessage(item.name, item.input);
              console.log(`[StreamJsonParser] Tool use detected: ${item.name} (id: ${item.id || 'none'}) -> "${contextualMessage}"`);
              lastToolUseStatus = {
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
        // Return status for the last tool_use found (if any)
        if (lastToolUseStatus) {
          return lastToolUseStatus;
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
              // Look up tool info by tool_use_id from the Map
              let toolInfo: { name: string; input?: Record<string, unknown> } | null = null;
              if (item.tool_use_id) {
                toolInfo = this._toolUseMap.get(item.tool_use_id) || null;
                // Delete from map after lookup (one-time correlation)
                this._toolUseMap.delete(item.tool_use_id);
              }
              // Fall back to _lastToolUseFallback if no ID match
              if (!toolInfo && this._lastToolUseFallback) {
                toolInfo = this._lastToolUseFallback;
              }

              // Check for AskUserQuestion failure first
              if (item.is_error && toolInfo?.name === 'AskUserQuestion') {
                // Extract the question from the tool input using helper
                const questionText = this.extractQuestionText(toolInfo.input);
                console.log(`[StreamJsonParser] AskUserQuestion detected (id: ${item.tool_use_id || 'none'}), returning awaiting_input status`);
                this._lastToolUseFallback = null;
                return {
                  type: 'awaiting_input',
                  message: questionText,
                  tool: 'AskUserQuestion',
                  timestamp,
                };
              }

              // Tool completed - only show errors
              if (item.is_error) {
                console.log(`[StreamJsonParser] Tool error detected (tool: ${toolInfo?.name || 'unknown'})`);
                this._lastToolUseFallback = null;  // Clear after processing
                // Handle complex error content (could be string, object, or array)
                let errorContent = item.content || 'Unknown error';
                if (typeof errorContent === 'object') {
                  errorContent = JSON.stringify(errorContent);
                }
                // Truncate very long error messages for cleaner display
                const displayError = String(errorContent).length > 500
                  ? String(errorContent).substring(0, 500) + '...'
                  : String(errorContent);

                // Check if this is a Bash command failure (exit code error)
                const isBashCommandFailure = toolInfo?.name === 'Bash' &&
                  String(errorContent).includes('Exit code');

                if (isBashCommandFailure) {
                  console.log(`[StreamJsonParser] Bash command failed`);
                  return {
                    type: 'command_failed',
                    message: `Command failed: ${displayError}`,
                    tool: 'Bash',
                    timestamp,
                  };
                }

                return {
                  type: 'error',
                  message: `Tool error: ${displayError}`,
                  ...(toolInfo?.name && { tool: toolInfo.name }),
                  timestamp,
                };
              }
              // Success - clear fallback tracking
              this._lastToolUseFallback = null;
              // Success - no status message needed, next tool_use will show progress
              console.log(`[StreamJsonParser] Tool result (success, tool: ${toolInfo?.name || 'unknown'}) - skipping status`);
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

      case 'stream_event':
        // Handle partial streaming events from --include-partial-messages
        return this.processStreamEvent(msg, timestamp);

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
      const lastTool = this._lastToolUseFallback;
      this._lastToolUseFallback = null;  // Clear after capturing

      const errorStr = String(msg.error);

      // Check if this is a Bash command failure (exit code error)
      const isBashCommandFailure = lastTool?.name === 'Bash' &&
        errorStr.includes('Exit code');

      if (isBashCommandFailure) {
        console.log(`[StreamJsonParser] Bash command failed (legacy format)`);
        return {
          type: 'command_failed',
          message: `Command failed: ${errorStr}`,
          tool: 'Bash',
          timestamp,
        };
      }

      return {
        type: 'error',
        message: `Tool error: ${errorStr}`,
        ...(lastTool?.name && { tool: lastTool.name }),
        timestamp,
      };
    }

    // For successful results, we don't need to show a status
    // The next tool_use or text response will indicate progress
    return null;
  }

  /**
   * Process a stream_event message (partial streaming with --include-partial-messages)
   *
   * @param msg - Stream event message
   * @param timestamp - Message timestamp
   * @returns Status message or null
   */
  private processStreamEvent(msg: StreamJsonMessage, timestamp: number): ClaudeStatusMessage | null {
    const event = msg.event;
    if (!event) {
      console.log(`[StreamJsonParser] stream_event missing event field`);
      return null;
    }

    console.log(`[StreamJsonParser] Processing stream_event: ${event.type}`);

    switch (event.type) {
      case 'content_block_start':
        // Check if this is a tool_use block starting
        if (event.content_block?.type === 'tool_use' && event.content_block.name) {
          const toolName = event.content_block.name;
          const contextualMessage = this.getContextualToolMessage(toolName, event.content_block.input);
          console.log(`[StreamJsonParser] stream_event tool_use start: ${toolName} -> "${contextualMessage}"`);
          return {
            type: 'tool_start',
            message: contextualMessage,
            tool: toolName,
            timestamp,
          };
        }

        // Check if this is a thinking block starting
        if (event.content_block?.type === 'thinking') {
          console.log(`[StreamJsonParser] stream_event thinking start`);
          return {
            type: 'thinking',
            message: 'Thinking...',
            timestamp,
          };
        }

        // Text blocks starting - no status needed
        return null;

      case 'content_block_delta':
      case 'content_block_stop':
      case 'message_start':
      case 'message_stop':
      case 'message_delta':
      case 'ping':
        // These events don't need status updates - they're for incremental streaming
        return null;

      default:
        console.log(`[StreamJsonParser] Unhandled stream_event type: ${event.type}`);
        return null;
    }
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
   * Extract question text from AskUserQuestion tool input with robust fallback handling.
   *
   * @param input - The tool input record (may be undefined or malformed)
   * @returns The extracted question text or a default message
   */
  private extractQuestionText(input: Record<string, unknown> | undefined): string {
    const defaultMessage = 'Claude needs your input';

    // Handle undefined input
    if (!input) {
      return defaultMessage;
    }

    // Get questions field
    const questions = input['questions'];

    // Handle missing questions field
    if (questions === undefined || questions === null) {
      return defaultMessage;
    }

    // Handle non-array questions
    if (!Array.isArray(questions)) {
      return defaultMessage;
    }

    // Handle empty array
    if (questions.length === 0) {
      return defaultMessage;
    }

    // Get first question object
    const firstQuestion = questions[0];

    // Handle malformed question objects (not an object, missing question field, or non-string question)
    if (
      typeof firstQuestion !== 'object' ||
      firstQuestion === null ||
      !('question' in firstQuestion) ||
      typeof firstQuestion.question !== 'string'
    ) {
      return defaultMessage;
    }

    // Return the question text, or default if empty string
    return firstQuestion.question || defaultMessage;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this._lineBuffer = '';
    this._toolUseMap.clear();
    this._lastToolUseFallback = null;
  }
}

// ============================================================================
// Activity Logging Helper Functions
// ============================================================================

/**
 * Generate a human-readable summary for a tool use activity.
 *
 * @param toolName - Name of the tool being used
 * @param input - Tool input parameters
 * @returns Human-readable summary string
 */
function generateToolSummary(toolName: string, input: unknown): string {
  const params = input as Record<string, unknown> | null | undefined;
  switch (toolName) {
    case 'Read': {
      const filePath = params?.['file_path'] as string | undefined;
      const fileName = filePath?.split('/').pop() || 'file';
      return `Read ${fileName}`;
    }
    case 'Write': {
      const filePath = params?.['file_path'] as string | undefined;
      const fileName = filePath?.split('/').pop() || 'file';
      return `Write ${fileName}`;
    }
    case 'Edit': {
      const filePath = params?.['file_path'] as string | undefined;
      const fileName = filePath?.split('/').pop() || 'file';
      return `Edit ${fileName}`;
    }
    case 'Bash': {
      const command = params?.['command'] as string | undefined;
      if (command) {
        const truncated = command.length > 50 ? command.slice(0, 50) + '...' : command;
        return `Run: ${truncated}`;
      }
      return 'Run command';
    }
    case 'Glob': {
      const pattern = params?.['pattern'] as string | undefined;
      return `Search for ${pattern || 'files'}`;
    }
    case 'Grep': {
      const pattern = params?.['pattern'] as string | undefined;
      return `Search for "${pattern || 'pattern'}" in code`;
    }
    case 'Task': {
      const description = params?.['description'] as string | undefined;
      if (description) {
        const truncated = description.length > 50 ? description.slice(0, 50) + '...' : description;
        return `Spawn agent: ${truncated}`;
      }
      return 'Spawn agent';
    }
    case 'WebFetch': {
      const url = params?.['url'] as string | undefined;
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          return `Fetch ${hostname}`;
        } catch {
          return 'Fetch web content';
        }
      }
      return 'Fetch web content';
    }
    case 'WebSearch': {
      const query = params?.['query'] as string | undefined;
      if (query) {
        const truncated = query.length > 40 ? query.slice(0, 40) + '...' : query;
        return `Search: "${truncated}"`;
      }
      return 'Search the web';
    }
    case 'NotebookEdit':
      return 'Edit notebook';
    case 'TodoWrite':
      return 'Update task list';
    case 'Skill': {
      const skill = params?.['skill'] as string | undefined;
      return skill ? `Run skill: ${skill}` : 'Run skill';
    }
    default:
      return `Use ${toolName}`;
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
 * Managed Claude process instance
 */
interface ManagedClaudeProcess {
  /** The spawned child process */
  process: ChildProcess;
  /** Task ID for tracking */
  taskId: string;
  /** Terminal ID for IPC events */
  terminalId: string;
  /** StreamJsonParser for this process */
  parser: StreamJsonParser;
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
 *
 * Uses child_process.spawn instead of node-pty to prevent TTY detection,
 * ensuring Claude Code outputs stream-json format correctly.
 */
class ClaudeCodeService {
  /**
   * Track tasks that are currently being paused.
   * Used to prevent sending failure messages when a task is intentionally paused.
   */
  private pausingTasks: Set<string> = new Set();

  /**
   * Map of active Claude processes by taskId.
   * Used for pause/resume/kill operations.
   */
  private activeProcesses: Map<string, ManagedClaudeProcess> = new Map();

  /**
   * Start a new Claude Code task.
   *
   * Uses child_process.spawn instead of node-pty to prevent TTY detection,
   * ensuring Claude Code respects the --output-format stream-json flag.
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
      // Build the task prompt
      const taskPrompt = this.buildTaskPrompt(options);
      console.log(`[ClaudeCodeService] Built task prompt (${String(taskPrompt.length)} chars)`);
      console.log(`[ClaudeCodeService] Task prompt preview: ${taskPrompt.substring(0, 200)}...`);

      // Build the arguments array for spawn (no shell escaping needed)
      const args = this.buildClaudeArgs(options, taskPrompt);
      console.log(`[ClaudeCodeService] Built spawn args: claude ${args.join(' ').substring(0, 200)}...`);
      console.log(`[ClaudeCodeService] Full command: claude ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);
      console.log(`[ClaudeCodeService] Working directory: ${options.projectPath}`);

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

      // Create a parser for this process
      const parser = new StreamJsonParser();

      // Build environment variables
      const env = { ...process.env };
      if (hooksConfigPath) {
        env['CLAUDE_CODE_HOOKS_FILE'] = hooksConfigPath;
      }

      // Display startup banner BEFORE spawning the process
      const banner = this.buildStartupBanner(options);
      console.log(`[ClaudeCodeService] Sending startup banner via IPC`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:output:${terminalId}`, banner);
      }

      // Send initial status message
      const startStatus: ClaudeStatusMessage = {
        type: 'system',
        message: `Starting: ${options.taskTitle}`,
        timestamp: Date.now(),
      };
      lastStatusCache.set(terminalId, startStatus);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:status:${terminalId}`, startStatus);
      }

      // Spawn the Claude Code process using child_process.spawn
      // This prevents TTY detection, ensuring Claude respects --output-format stream-json
      const claudeProcess = spawn('claude', args, {
        cwd: options.projectPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      console.log(`[ClaudeCodeService] Spawned Claude Code process with PID: ${String(claudeProcess.pid)}`);

      // DEBUG: Track if we ever receive data
      let dataEventFired = false;

      // DEBUG: Verify streams exist immediately after spawn
      console.log('[ClaudeCodeService] DEBUG: stdout exists:', !!claudeProcess.stdout);
      console.log('[ClaudeCodeService] DEBUG: stderr exists:', !!claudeProcess.stderr);
      console.log('[ClaudeCodeService] DEBUG: stdin exists:', !!claudeProcess.stdin);
      console.log('[ClaudeCodeService] DEBUG: stdout type:', claudeProcess.stdout ? typeof claudeProcess.stdout : 'null');
      console.log('[ClaudeCodeService] DEBUG: stderr type:', claudeProcess.stderr ? typeof claudeProcess.stderr : 'null');

      if (!claudeProcess.stdout) {
        console.error('[ClaudeCodeService] CRITICAL: stdout is null/undefined! Stream capture will fail.');
        console.error('[ClaudeCodeService] This may indicate spawn failed or stdio config is wrong.');
      }
      if (!claudeProcess.stderr) {
        console.error('[ClaudeCodeService] CRITICAL: stderr is null/undefined! Error capture will fail.');
      }
      if (!claudeProcess.pid) {
        console.error('[ClaudeCodeService] CRITICAL: Process has no PID! Spawn may have failed silently.');
      }

      // Close stdin to signal no more input - this triggers Claude CLI to start processing
      // Without this, the CLI waits indefinitely for stdin to close before producing output
      if (claudeProcess.stdin) {
        claudeProcess.stdin.end();
        console.log('[ClaudeCodeService] DEBUG: stdin closed to trigger CLI processing');
      }

      // DEBUG: Listen for the spawn event to confirm process started correctly
      claudeProcess.on('spawn', () => {
        console.log('[ClaudeCodeService] DEBUG: spawn event fired - process started successfully');
        console.log(`[ClaudeCodeService] DEBUG: PID after spawn: ${String(claudeProcess.pid)}`);
        // Check stream state when spawn fires
        if (claudeProcess.stdout) {
          console.log('[ClaudeCodeService] DEBUG: At spawn - stdout.readableFlowing:', claudeProcess.stdout.readableFlowing);
          console.log('[ClaudeCodeService] DEBUG: At spawn - stdout.readableLength:', claudeProcess.stdout.readableLength);
        }
      });

      // DEBUG: Check if there's already buffered data (race condition check)
      if (claudeProcess.stdout) {
        const initialReadableLength = claudeProcess.stdout.readableLength;
        console.log('[ClaudeCodeService] DEBUG: Immediately after spawn - readableLength:', initialReadableLength);
        if (initialReadableLength > 0) {
          console.log('[ClaudeCodeService] DEBUG: WARNING - Data already buffered before handler attached!');
        }
      }

      // DEBUG: Check if streams are readable/writable
      if (claudeProcess.stdout) {
        console.log('[ClaudeCodeService] DEBUG: stdout readable:', claudeProcess.stdout.readable);
        console.log('[ClaudeCodeService] DEBUG: stdout readableFlowing:', claudeProcess.stdout.readableFlowing);
        console.log('[ClaudeCodeService] DEBUG: stdout readableLength:', claudeProcess.stdout.readableLength);
      }
      if (claudeProcess.stderr) {
        console.log('[ClaudeCodeService] DEBUG: stderr readable:', claudeProcess.stderr.readable);
      }

      // Store the managed process
      const managedProcess: ManagedClaudeProcess = {
        process: claudeProcess,
        taskId: options.taskId,
        terminalId,
        parser,
      };
      this.activeProcesses.set(options.taskId, managedProcess);

      // Handle stdout data - use explicit null check instead of optional chaining
      if (claudeProcess.stdout) {
        console.log('[ClaudeCodeService] DEBUG: Attaching stdout data handler');

        // DEBUG: Check initial stream state
        console.log('[ClaudeCodeService] DEBUG: Initial stdout.readableFlowing:', claudeProcess.stdout.readableFlowing);
        console.log('[ClaudeCodeService] DEBUG: Initial stdout.readableLength:', claudeProcess.stdout.readableLength);
        console.log('[ClaudeCodeService] DEBUG: Initial stdout.isPaused():', claudeProcess.stdout.isPaused());

        // Ensure the stream is in flowing mode by setting encoding
        // Some Node.js versions require this to properly emit 'data' events
        claudeProcess.stdout.setEncoding('utf8');

        // DEBUG: Check state after setEncoding
        console.log('[ClaudeCodeService] DEBUG: After setEncoding - readableFlowing:', claudeProcess.stdout.readableFlowing);

        // Explicitly start reading (in case the stream is paused)
        claudeProcess.stdout.resume();

        // DEBUG: Check state after resume
        console.log('[ClaudeCodeService] DEBUG: After resume - readableFlowing:', claudeProcess.stdout.readableFlowing);
        console.log('[ClaudeCodeService] DEBUG: After resume - isPaused():', claudeProcess.stdout.isPaused());

        claudeProcess.stdout.on('data', (data: Buffer | string) => {
          // DEBUG: Mark that we received data
          if (!dataEventFired) {
            dataEventFired = true;
            console.log('[ClaudeCodeService] DEBUG: FIRST data event fired!');
          }

          // With setEncoding('utf8'), data will be a string, but handle Buffer for safety
          const text = typeof data === 'string' ? data : data.toString('utf8');
          console.log(`[ClaudeCodeService] stdout received ${String(text.length)} chars`);
          console.log(`[ClaudeCodeService] stdout preview: ${text.substring(0, 200).replace(/\n/g, '\\n')}`);

          // Check if window exists before sending events
          if (!mainWindow || mainWindow.isDestroyed()) {
            console.log(`[ClaudeCodeService] Window destroyed, skipping data send`);
            return;
          }

          // Format the JSON output nicely for terminal display
          const formattedOutput = this.formatJsonOutputForTerminal(text);
          mainWindow.webContents.send(`terminal:output:${terminalId}`, formattedOutput);

          // Parse stream-json output and send clean status updates
          const statusMessages = parser.parse(text);
          console.log(`[ClaudeCodeService] Parser returned ${String(statusMessages.length)} status messages`);
          for (const status of statusMessages) {
            console.log(`[ClaudeCodeService] Sending status to renderer: ${status.message}`);
            lastStatusCache.set(terminalId, status);
            mainWindow.webContents.send(`terminal:status:${terminalId}`, status);

            // If awaiting input, update task status in database
            if (status.type === 'awaiting_input') {
              void this.updateTaskAwaitingInput(options.taskId, status.message);
            }

            // Record activity for AI review workflow
            this.recordActivityFromStatus(options.taskId, status);
          }
        });

        // DEBUG: Check state after attaching data handler
        console.log('[ClaudeCodeService] DEBUG: After data handler attached - readableFlowing:', claudeProcess.stdout.readableFlowing);

        // Also listen for end and close events on stdout
        claudeProcess.stdout.on('end', () => {
          console.log('[ClaudeCodeService] DEBUG: stdout stream ended');
        });
        claudeProcess.stdout.on('close', () => {
          console.log('[ClaudeCodeService] DEBUG: stdout stream closed');
        });
        claudeProcess.stdout.on('error', (err: Error) => {
          console.error('[ClaudeCodeService] ERROR: stdout stream error:', err.message);
        });

        // DEBUG: Log Node.js and Electron versions for context
        console.log('[ClaudeCodeService] DEBUG: Node.js version:', process.version);
        console.log('[ClaudeCodeService] DEBUG: Electron version:', process.versions.electron);
        console.log('[ClaudeCodeService] DEBUG: Chrome version:', process.versions.chrome);

        // DEBUG: Schedule a check after a delay to see if stream state changed
        setTimeout(() => {
          console.log('[ClaudeCodeService] DEBUG: After 1s - dataEventFired:', dataEventFired);
          if (claudeProcess.stdout) {
            console.log('[ClaudeCodeService] DEBUG: After 1s - readableFlowing:', claudeProcess.stdout.readableFlowing);
            console.log('[ClaudeCodeService] DEBUG: After 1s - readableLength:', claudeProcess.stdout.readableLength);
            console.log('[ClaudeCodeService] DEBUG: After 1s - isPaused():', claudeProcess.stdout.isPaused());
            console.log('[ClaudeCodeService] DEBUG: After 1s - destroyed:', claudeProcess.stdout.destroyed);
            console.log('[ClaudeCodeService] DEBUG: After 1s - process.killed:', claudeProcess.killed);
            console.log('[ClaudeCodeService] DEBUG: After 1s - process.exitCode:', claudeProcess.exitCode);
          }
          // If no data after 1s, something is definitely wrong
          if (!dataEventFired) {
            console.error('[ClaudeCodeService] ERROR: No data received after 1 second!');
            console.error('[ClaudeCodeService] ERROR: This suggests stdout is not producing any output.');
            console.error('[ClaudeCodeService] ERROR: Possible causes:');
            console.error('[ClaudeCodeService] ERROR:   1. Claude CLI is buffering output');
            console.error('[ClaudeCodeService] ERROR:   2. Stream is stuck in paused mode');
            console.error('[ClaudeCodeService] ERROR:   3. Process failed silently');
          }
        }, 1000);

      } else {
        console.error('[ClaudeCodeService] CRITICAL: Cannot attach stdout handler - stream is null!');
      }

      // Handle stderr data - use explicit null check instead of optional chaining
      if (claudeProcess.stderr) {
        console.log('[ClaudeCodeService] DEBUG: Attaching stderr data handler');

        // Ensure the stream is in flowing mode
        claudeProcess.stderr.setEncoding('utf8');
        claudeProcess.stderr.resume();

        claudeProcess.stderr.on('data', (data: Buffer | string) => {
          const text = typeof data === 'string' ? data : data.toString('utf8');
          console.log(`[ClaudeCodeService] stderr received ${String(text.length)} chars: ${text.substring(0, 100)}`);

          if (!mainWindow || mainWindow.isDestroyed()) {
            return;
          }

          // Send stderr to terminal with error formatting
          const formattedError = `\x1b[31m${text}\x1b[0m`; // Red color
          mainWindow.webContents.send(`terminal:output:${terminalId}`, formattedError);
        });

        claudeProcess.stderr.on('error', (err: Error) => {
          console.error('[ClaudeCodeService] ERROR: stderr stream error:', err.message);
        });
      } else {
        console.error('[ClaudeCodeService] CRITICAL: Cannot attach stderr handler - stream is null!');
      }

      // Handle process exit
      claudeProcess.on('exit', (code: number | null, signal: string | null) => {
        const exitCode = code ?? (signal ? 128 : 1); // Use signal-based exit code or default to 1
        console.log(`[ClaudeCodeService] Process exited with code: ${String(exitCode)}, signal: ${signal || 'none'}`);

        // Remove from active processes
        this.activeProcesses.delete(options.taskId);

        // Check if window exists before sending events
        const windowValid = mainWindow && !mainWindow.isDestroyed();

        // Check if this task is being paused - if so, don't send failure message
        const isPausing = this.pausingTasks.has(options.taskId);
        if (isPausing) {
          console.log(`[ClaudeCodeService] Task ${options.taskId} is being paused, skipping failure message`);
          const pausedStatus: ClaudeStatusMessage = {
            type: 'system',
            message: 'Task paused',
            timestamp: Date.now(),
          };
          lastStatusCache.set(terminalId, pausedStatus);
          if (windowValid) {
            mainWindow.webContents.send(`terminal:status:${terminalId}`, pausedStatus);
          }
          this.pausingTasks.delete(options.taskId);
        } else {
          // Send completion status message
          const completionStatus: ClaudeStatusMessage = {
            type: exitCode === 0 ? 'system' : 'error',
            message: exitCode === 0 ? 'Task completed successfully' : `Task failed with exit code ${String(exitCode)}`,
            timestamp: Date.now(),
          };
          lastStatusCache.set(terminalId, completionStatus);
          if (windowValid) {
            mainWindow.webContents.send(`terminal:status:${terminalId}`, completionStatus);
          }
        }

        // Update task status based on exit code
        void this.handleTaskExit(options.taskId, exitCode, mainWindow);

        // Notify renderer of process exit
        if (windowValid) {
          mainWindow.webContents.send(`terminal:exit:${terminalId}`, exitCode);
        }

        // Clear status cache when process exits
        lastStatusCache.delete(terminalId);
      });

      // Handle process errors (spawn failures, etc.)
      claudeProcess.on('error', (err: Error) => {
        console.error(`[ClaudeCodeService] Process error for task ${options.taskId}:`, err);

        // Remove from active processes
        this.activeProcesses.delete(options.taskId);

        if (mainWindow && !mainWindow.isDestroyed()) {
          const errorStatus: ClaudeStatusMessage = {
            type: 'error',
            message: `Failed to start Claude Code: ${err.message}`,
            timestamp: Date.now(),
          };
          lastStatusCache.set(terminalId, errorStatus);
          mainWindow.webContents.send(`terminal:status:${terminalId}`, errorStatus);
          mainWindow.webContents.send(`terminal:output:${terminalId}`, `\x1b[31mError: ${err.message}\x1b[0m\r\n`);
        }
      });

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

      // Clean up process if it was created
      const managedProcess = this.activeProcesses.get(options.taskId);
      if (managedProcess) {
        try {
          managedProcess.process.kill();
          this.activeProcesses.delete(options.taskId);
          console.log(`[ClaudeCodeService] Cleaned up process for task ${options.taskId} after error`);
        } catch (killError) {
          console.error(
            `[ClaudeCodeService] Failed to clean up process for task ${options.taskId}:`,
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
   * Format JSON output from Claude Code for terminal display.
   * Converts raw JSON lines into a more readable format.
   *
   * @param text - Raw text output from Claude Code
   * @returns Formatted text suitable for terminal display
   */
  private formatJsonOutputForTerminal(text: string): string {
    // Split into lines and format each line
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        formattedLines.push('');
        continue;
      }

      // Try to parse as JSON for prettier formatting
      try {
        const parsed = JSON.parse(trimmed);
        // Format based on message type
        if (parsed.type === 'assistant' && parsed.message?.content) {
          for (const item of parsed.message.content) {
            if (item.type === 'text' && item.text) {
              formattedLines.push(item.text);
            } else if (item.type === 'tool_use') {
              formattedLines.push(`\x1b[36m[Tool: ${item.name || 'unknown'}]\x1b[0m`);
            }
          }
        } else if (parsed.type === 'user' && parsed.message?.content) {
          for (const item of parsed.message.content) {
            if (item.type === 'tool_result' && !item.is_error) {
              // Tool results can be verbose, just show a marker
              formattedLines.push(`\x1b[32m[Tool completed]\x1b[0m`);
            } else if (item.type === 'tool_result' && item.is_error) {
              formattedLines.push(`\x1b[31m[Tool error: ${item.content || 'Unknown'}]\x1b[0m`);
            }
          }
        } else if (parsed.type === 'system') {
          // Show system messages in gray
          if (parsed.content) {
            formattedLines.push(`\x1b[90m${parsed.content}\x1b[0m`);
          }
        } else if (parsed.type === 'result') {
          if (parsed.subtype === 'success') {
            formattedLines.push(`\x1b[32m[Task completed]\x1b[0m`);
          }
        } else {
          // For other types, show a compact JSON representation
          formattedLines.push(`\x1b[90m${JSON.stringify(parsed)}\x1b[0m`);
        }
      } catch {
        // Not JSON, show as-is
        formattedLines.push(line);
      }
    }

    // Join with carriage return + newline for terminal display
    return formattedLines.join('\r\n');
  }

  /**
   * Resume an existing Claude Code session by sending SIGCONT to the paused process.
   * This continues a process that was previously suspended with SIGSTOP.
   *
   * @param taskId - Task ID to resume
   * @param mainWindow - Main BrowserWindow for output streaming
   * @returns True if resume was successful, false otherwise
   */
  resumeTask(taskId: string, mainWindow: BrowserWindow): boolean {
    const terminalId = `claude-${taskId}`;
    const managedProcess = this.activeProcesses.get(taskId);

    if (!managedProcess) {
      console.error(`[ClaudeCodeService] Process for task ${taskId} not found for resume`);
      return false;
    }

    const pid = managedProcess.process.pid;
    if (!pid) {
      console.error(`[ClaudeCodeService] Process for task ${taskId} has no PID`);
      return false;
    }

    // Clear the pausing flag since we're resuming
    this.clearPausingFlag(taskId);

    try {
      // Send SIGCONT to resume the process
      process.kill(pid, 'SIGCONT');
      console.log(`[ClaudeCodeService] Sent SIGCONT to PID ${String(pid)}`);

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
      return true;
    } catch (error) {
      console.error(`[ClaudeCodeService] Failed to resume task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Pause a Claude Code task using SIGSTOP.
   * Suspends the process without terminating it, allowing it to be resumed later.
   *
   * @param taskId - Task ID to pause
   * @returns True if pause was successful, false otherwise
   */
  pauseTask(taskId: string): boolean {
    const managedProcess = this.activeProcesses.get(taskId);

    if (!managedProcess) {
      console.error(`[ClaudeCodeService] Process for task ${taskId} not found`);
      return false;
    }

    const pid = managedProcess.process.pid;
    if (!pid) {
      console.error(`[ClaudeCodeService] Process for task ${taskId} has no PID`);
      return false;
    }

    // Mark this task as being paused BEFORE sending SIGSTOP
    // This prevents the exit handler from sending a failure message if the process exits
    this.pausingTasks.add(taskId);
    console.log(`[ClaudeCodeService] Marked task ${taskId} as pausing`);

    try {
      // Send SIGSTOP to pause the process
      process.kill(pid, 'SIGSTOP');
      console.log(`[ClaudeCodeService] Sent SIGSTOP to PID ${String(pid)}`);
      return true;
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
   * Check if a Claude Code process is active for a task.
   *
   * @param taskId - Task ID to check
   * @returns True if a process is active for this task
   */
  hasActiveProcess(taskId: string): boolean {
    return this.activeProcesses.has(taskId);
  }

  /**
   * Kill a Claude Code process for a task.
   *
   * @param taskId - Task ID to kill
   * @returns True if the process was killed, false if not found
   */
  killTask(taskId: string): boolean {
    const managedProcess = this.activeProcesses.get(taskId);

    if (!managedProcess) {
      console.log(`[ClaudeCodeService] No active process for task ${taskId}`);
      return false;
    }

    try {
      managedProcess.process.kill();
      this.activeProcesses.delete(taskId);
      console.log(`[ClaudeCodeService] Killed process for task ${taskId}`);
      return true;
    } catch (error) {
      console.error(`[ClaudeCodeService] Error killing task ${taskId}:`, error);
      // Still remove from tracking
      this.activeProcesses.delete(taskId);
      return true;
    }
  }

  /**
   * Kill all active Claude Code processes.
   * Should be called when the app is closing.
   */
  killAllProcesses(): void {
    console.log(`[ClaudeCodeService] Killing all processes (${String(this.activeProcesses.size)} active)`);

    for (const [taskId, managedProcess] of this.activeProcesses.entries()) {
      try {
        managedProcess.process.kill();
        console.log(`[ClaudeCodeService] Killed process for task ${taskId}`);
      } catch (error) {
        console.error(`[ClaudeCodeService] Error killing process for task ${taskId}:`, error);
      }
    }

    this.activeProcesses.clear();
    this.pausingTasks.clear();
  }

  /**
   * Build a simplified startup banner to display before executing Claude Code command.
   * Shows just the task title and a simple starting message.
   *
   * @param options - Claude Code options containing context
   * @returns Formatted banner string with terminal line endings
   */
  private buildStartupBanner(options: ClaudeCodeOptions): string {
    const banner: string[] = [];

    // Simple, clean header
    banner.push('\r\n');
    banner.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n');
    banner.push(`Task: ${options.taskTitle}\r\n`);
    banner.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n');
    banner.push('\r\n');
    banner.push('Starting Claude Code...\r\n');
    banner.push('\r\n');

    return banner.join('');
  }

  /**
   * Build the arguments array for spawning Claude Code.
   *
   * Since we use child_process.spawn, we don't need shell escaping.
   * Arguments are passed directly to the process.
   *
   * @param options - Claude Code options
   * @param taskPrompt - The task prompt to include as a command argument
   * @returns Array of arguments for spawn
   */
  private buildClaudeArgs(options: ClaudeCodeOptions, taskPrompt: string): string[] {
    const args: string[] = [];

    // Print mode (non-interactive) for programmatic use
    args.push('-p');

    // Skip permission prompts for programmatic execution (default: true)
    // This is standard practice for programmatic Claude Code execution
    // Requires user to have accepted terms once by running `claude --dangerously-skip-permissions` manually
    if (options.skipPermissions !== false) {
      args.push('--dangerously-skip-permissions');
    }

    // Streaming JSON output format (requires --verbose)
    args.push('--output-format', 'stream-json');
    args.push('--verbose');
    // Include partial streaming events for real-time progress updates
    args.push('--include-partial-messages');

    // Max turns
    if (options.maxTurns !== undefined) {
      args.push('--max-turns', String(options.maxTurns));
    }

    // Max budget
    if (options.maxBudget !== undefined) {
      args.push('--max-budget', String(options.maxBudget));
    }

    // Allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowed-tools', options.allowedTools.join(','));
    }

    // Custom system prompt - no escaping needed with spawn
    if (options.appendSystemPrompt) {
      args.push('--append-system-prompt', options.appendSystemPrompt);
    }

    // Add the task prompt as the final argument - no escaping needed with spawn
    if (taskPrompt) {
      args.push(taskPrompt);
    }

    return args;
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

    // Flush any pending activities to the database before completing the task
    try {
      await activityLogger.flushActivities(taskId);
      logger.info(`Flushed activities for completed task ${taskId}`);
    } catch (flushError) {
      // Log but don't fail the exit handling
      logger.error(`Failed to flush activities for task ${taskId}:`, flushError);
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

      // Update task with completion status and clear terminal/session IDs
      await prisma.task.update({
        where: { id: taskId },
        data: {
          claudeStatus,
          claudeTerminalId: null,
          claudeSessionId: null,
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

  /**
   * Record an activity from a status message for AI review workflows.
   *
   * Maps status message types to activity entries and records them via the
   * activity logger. This captures tool usage, text responses, and errors
   * for later review.
   *
   * @param taskId - The task ID to record activity for
   * @param status - The status message to convert to an activity
   */
  private recordActivityFromStatus(taskId: string, status: ClaudeStatusMessage): void {
    let activity: ActivityEntry | null = null;

    switch (status.type) {
      case 'tool_start': {
        // For tool_start, we need to extract tool details from the managed process
        const managedProcess = this.activeProcesses.get(taskId);
        const toolInfo = managedProcess?.parser['_lastToolUseFallback'] as
          | { name: string; input?: Record<string, unknown> }
          | null
          | undefined;
        const toolInput = toolInfo?.input;

        const toolStartActivity: ActivityEntry = {
          type: 'tool_use',
          summary: status.tool
            ? generateToolSummary(status.tool, toolInput)
            : status.message,
          timestamp: status.timestamp,
        };
        if (status.tool) {
          toolStartActivity.toolName = status.tool;
        }
        if (toolInput) {
          toolStartActivity.details = { input: toolInput };
        }
        activity = toolStartActivity;
        break;
      }

      case 'thinking':
        activity = {
          type: 'thinking',
          summary: 'Claude is thinking...',
          timestamp: status.timestamp,
        };
        break;

      case 'text':
        // Text responses from Claude (currently not emitted by parser, but included for completeness)
        activity = {
          type: 'text',
          summary: status.message.slice(0, 200) + (status.message.length > 200 ? '...' : ''),
          timestamp: status.timestamp,
        };
        break;

      case 'error':
      case 'command_failed': {
        const errorActivity: ActivityEntry = {
          type: 'error',
          summary: status.message,
          timestamp: status.timestamp,
        };
        if (status.tool) {
          errorActivity.toolName = status.tool;
        }
        if (status.details) {
          errorActivity.details = { error: status.details };
        }
        activity = errorActivity;
        break;
      }

      case 'awaiting_input':
        // Record as a decision point when Claude needs user input
        activity = {
          type: 'decision',
          toolName: 'AskUserQuestion',
          summary: `Awaiting input: ${status.message.slice(0, 150)}${status.message.length > 150 ? '...' : ''}`,
          timestamp: status.timestamp,
        };
        break;

      case 'system':
        // Skip system messages for activity logging (too noisy)
        break;

      default:
        // Skip unknown status types
        break;
    }

    if (activity) {
      activityLogger.recordActivity(taskId, activity);
    }
  }

  /**
   * Update task status to AWAITING_INPUT when Claude asks a question.
   *
   * @param taskId - The task ID to update
   * @param question - The question Claude is asking
   */
  private async updateTaskAwaitingInput(taskId: string, question: string): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      await prisma.task.update({
        where: { id: taskId },
        data: { claudeStatus: 'AWAITING_INPUT' },
      });
      console.log(`[ClaudeCodeService] Updated task ${taskId} to AWAITING_INPUT: ${question}`);
    } catch (error) {
      console.error(`[ClaudeCodeService] Failed to update task ${taskId} to AWAITING_INPUT:`, error);
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
