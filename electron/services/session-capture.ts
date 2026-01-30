/**
 * Session Capture Service
 *
 * Captures and parses terminal session output into Memory entries.
 * Extracts shell commands, file modifications, errors, and creates summaries
 * for storing as "session" type memories in the database.
 */

import { databaseService } from './database.js';

/**
 * Comprehensive ANSI escape code regex for stripping terminal formatting.
 * Handles:
 * - CSI sequences (colors, cursor, formatting): \x1b[...m
 * - Private mode sequences (bracketed paste): \x1b[?2004h, \x1b[?2004l
 * - Bracketed paste markers: \x1b[200~, \x1b[201~
 * - OSC sequences (window titles, hyperlinks): \x1b]...\x07 or \x1b]...\x1b\\
 * - DCS sequences: \x1bP...\x1b\\
 * - Single character escape sequences
 */
// eslint-disable-next-line no-control-regex -- intentionally matching ANSI escape sequences
const ANSI_REGEX = new RegExp(
  [
    // CSI sequences including private mode like [?2004h and bracketed paste like [200~
    '[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]',
    // OSC sequences: ESC ] ... BEL or ESC ] ... ST
    '\u001b\\][^\u0007]*(?:\u0007|\u001b\\\\)',
    // DCS sequences: ESC P ... ST
    '\u001bP[^\u001b]*\u001b\\\\',
    // Single character escape sequences
    '\u001b[=>Mc78NODEFHlm]',
  ].join('|'),
  'g'
);

/**
 * Parsed session insight data
 */
export interface SessionInsight {
  title: string;
  commands: string[];
  filesModified: string[];
  errors: string[];
  summary: string;
  duration?: number;
}

/**
 * Strip ANSI escape codes from terminal output.
 * Uses comprehensive regex plus secondary cleanup for edge cases.
 *
 * @param text - Raw terminal output with ANSI codes
 * @returns Clean text without ANSI formatting
 */
function stripAnsi(text: string): string {
  // Primary pass with comprehensive regex
  let result = text.replace(ANSI_REGEX, '');

  // Secondary cleanup for any remaining escape sequences
  // Remove any stray ESC characters and their immediate followers
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1b./g, '');

  // Remove any remaining control characters except newline, tab, carriage return
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  return result;
}

/**
 * Remove consecutive duplicate lines from text.
 * This handles repeated shell prompts that appear in terminal output.
 *
 * @param text - Text with potential duplicate lines
 * @returns Text with consecutive duplicates removed
 */
function removeConsecutiveDuplicates(text: string): string {
  const lines = text.split('\n');
  return lines
    .filter((line, index) => {
      // Always keep the first line
      if (index === 0) return true;
      // Keep line if it's different from the previous line
      return line !== lines[index - 1];
    })
    .join('\n');
}

/**
 * Remove empty prompt-only lines (lines that are just shell prompts with no command).
 * Filters out lines that match common shell prompt patterns without any command.
 *
 * @param text - Text with potential empty prompt lines
 * @returns Text with empty prompt lines removed
 */
function removeEmptyPromptLines(text: string): string {
  // Common shell prompt patterns - lines that are ONLY a prompt
  // Matches: username@hostname directory % or $ or # or >
  const promptOnlyPattern = /^[\w.-]+@[\w.-]+\s+[\w./-]+\s*[%$#>]\s*$/;

  const lines = text.split('\n');
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      // Keep empty lines between actual content
      if (!trimmed) return true;
      // Filter out lines that are ONLY a shell prompt
      return !promptOnlyPattern.test(trimmed);
    })
    .join('\n');
}

/**
 * Extract shell commands from terminal output.
 * Looks for lines that start with common prompt indicators ($ or %).
 *
 * @param output - Clean terminal output
 * @returns Array of commands executed
 */
function extractCommands(output: string): string[] {
  const lines = output.split('\n');
  const commands: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match common shell prompts
    // $ command (bash)
    // % command (zsh)
    // PS1> command (PowerShell)
    if (
      trimmed.startsWith('$ ') ||
      trimmed.startsWith('% ') ||
      (/^PS\s.*>\s/.exec(trimmed))
    ) {
      const command = trimmed.replace(/^[$%]\s/, '').replace(/^PS\s.*>\s/, '');
      if (command && command.length > 0) {
        commands.push(command);
      }
    }
  }

  return commands;
}

/**
 * Extract file paths mentioned in the output.
 * Looks for common patterns like file modifications, git operations, etc.
 *
 * @param output - Clean terminal output
 * @returns Array of file paths mentioned
 */
function extractFilePaths(output: string): string[] {
  const files = new Set<string>();
  const lines = output.split('\n');

  for (const line of lines) {
    // Git modified files (M, A, D, etc.)
    const gitMatch = /^\s*[MAD]\s+(.+)$/.exec(line);
    if (gitMatch?.[1]) {
      files.add(gitMatch[1].trim());
      continue;
    }

    // File paths with common extensions
    const pathMatches = line.matchAll(/([a-zA-Z0-9_\-./]+\.(ts|tsx|js|jsx|json|md|css|html|yml|yaml|prisma|sql))/g);
    for (const match of pathMatches) {
      if (match[1]) {
        files.add(match[1]);
      }
    }

    // npm/yarn/pnpm install messages
    const packageMatch = /(?:added|updated|removed)\s+(.+)/.exec(line);
    if (packageMatch?.[1]) {
      files.add(packageMatch[1].trim());
    }
  }

  return Array.from(files);
}

/**
 * Patterns that indicate system/infrastructure errors to ignore.
 * These are not actual code problems and should not be shown to users.
 */
const IGNORE_ERROR_PATTERNS = [
  /operation not permitted/i,
  /TAR_ENTRY_ERROR/i,
  /npm warn/i,
  /npm WARN/i,
  /zsh:\d+:/i,
  /bash:\d+:/i,
  /permission denied/i,
  /EPERM/i,
  /EACCES/i,
  /sandbox/i,
  /exit code \d+\s+zsh/i,
  /gyp ERR!/i,
  /node-gyp/i,
  /prebuild-install/i,
];

/**
 * Check if an error line should be ignored (system/infrastructure error).
 *
 * @param line - The error line to check
 * @returns true if the error should be ignored
 */
function shouldIgnoreError(line: string): boolean {
  return IGNORE_ERROR_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Extract error messages from output.
 * Looks for common error patterns across different tools.
 * Filters out system/infrastructure errors that are not actual code problems.
 *
 * @param output - Clean terminal output
 * @returns Array of error messages
 */
function extractErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip system/infrastructure errors
    if (shouldIgnoreError(trimmed)) {
      continue;
    }

    // Common error patterns (actual code errors)
    if (
      (/^error:/i.exec(trimmed)) ||
      (/^fatal:/i.exec(trimmed)) ||
      (/Error:/i.exec(trimmed)) ||
      (/Exception:/i.exec(trimmed)) ||
      trimmed.includes('FAILED') ||
      trimmed.includes('[ERROR]') ||
      trimmed.includes('✖') ||
      trimmed.includes('⨯')
    ) {
      errors.push(trimmed);
    }
  }

  return errors;
}

/**
 * Detect the type of work based on modified files.
 *
 * @param files - List of file paths modified
 * @returns Session type string or null if no pattern matched
 */
function detectSessionType(files: string[]): string | null {
  const patterns = {
    test: /\.(test|spec)\.[jt]sx?$|__tests__|tests?\//i,
    docs: /\.md$|\/docs\//i,
    config: /config\.[jt]s$|package\.json$|tsconfig|\.eslintrc|\.prettierrc/i,
    style: /\.css$|\.scss$|\.less$|tailwind/i,
    database: /prisma|migration|schema\./i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (files.some(f => pattern.test(f))) {
      return type;
    }
  }
  return null;
}

/**
 * Generate a descriptive title for the session based on accomplishments.
 * Follows Conventional Commits-style format when possible.
 *
 * @param commands - List of commands executed
 * @param errors - List of errors encountered
 * @param files - List of files modified
 * @returns A concise title for the session
 */
function generateTitle(commands: string[], errors: string[], files: string[]): string {
  const sessionType = detectSessionType(files);

  // If files were modified, focus on that
  if (files.length > 0) {
    const fileCount = files.length;

    if (sessionType === 'test') {
      return `test: Updated ${fileCount} test file${fileCount > 1 ? 's' : ''}`;
    }
    if (sessionType === 'docs') {
      return `docs: Updated documentation`;
    }
    if (sessionType === 'config') {
      return `chore: Updated configuration`;
    }
    if (sessionType === 'style') {
      return `style: Updated styles`;
    }
    if (sessionType === 'database') {
      return `db: Database changes`;
    }

    // Generic file changes
    return `Updated ${fileCount} file${fileCount > 1 ? 's' : ''}`;
  }

  // If commands were run but no files changed
  if (commands.length > 0) {
    const firstCmd = commands[0];
    const cmdName = firstCmd?.split(' ')[0] || 'commands';

    // Identify common command types
    if (['npm', 'yarn', 'pnpm'].includes(cmdName)) {
      return `chore: Package management`;
    }
    if (['git'].includes(cmdName)) {
      return `git: Repository operations`;
    }
    if (['test', 'vitest', 'jest', 'playwright'].includes(cmdName)) {
      return `test: Ran tests`;
    }

    return `Ran ${cmdName}`;
  }

  // Only show errors if nothing else was accomplished
  if (errors.length > 0) {
    return `Session with issues`;
  }

  return `Terminal session`;
}

/**
 * Generate a textual summary of the session.
 * Focuses on accomplishments (files changed, commands run) rather than errors.
 *
 * @param insight - Parsed session insight data
 * @returns Formatted summary text
 */
function generateSummary(insight: Omit<SessionInsight, 'summary'>): string {
  const parts: string[] = [];

  // Files section FIRST - this is the most important info
  if (insight.filesModified.length > 0) {
    parts.push('Files modified:');
    const displayFiles = insight.filesModified.slice(0, 10);
    displayFiles.forEach(file => parts.push(`  - ${file}`));
    if (insight.filesModified.length > 10) {
      parts.push(`  ... and ${insight.filesModified.length - 10} more`);
    }
  }

  // Commands section - show what was done
  const validCommands = insight.commands.filter(cmd => cmd && cmd.trim().length > 0);
  if (validCommands.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('Commands executed:');
    const displayCommands = validCommands.slice(0, 10);
    displayCommands.forEach(cmd => {
      const truncated = cmd.length > 100 ? cmd.slice(0, 100) + '...' : cmd;
      parts.push(`  - ${truncated}`);
    });
    if (validCommands.length > 10) {
      parts.push(`  ... and ${validCommands.length - 10} more`);
    }
  }

  // NO errors section - we've filtered them out and they're not useful to display

  // If nothing was extracted, indicate that
  if (parts.length === 0) {
    return 'No significant activity detected in this session.';
  }

  return parts.join('\n');
}

/**
 * Parse terminal session output into structured insights.
 *
 * @param output - Raw terminal output
 * @returns Parsed session insight data
 */
export function parseSessionOutput(output: string): SessionInsight {
  // Strip ANSI codes first
  const cleanOutput = stripAnsi(output);

  // Remove consecutive duplicate lines (handles repeated prompts)
  const dedupedOutput = removeConsecutiveDuplicates(cleanOutput);

  // Remove empty prompt-only lines
  const filteredOutput = removeEmptyPromptLines(dedupedOutput);

  // Extract key information from filtered output
  const commands = extractCommands(filteredOutput);
  const filesModified = extractFilePaths(filteredOutput);
  const errors = extractErrors(filteredOutput);

  // Generate title and summary
  const title = generateTitle(commands, errors, filesModified);
  const summary = generateSummary({ title, commands, filesModified, errors });

  return {
    title,
    commands,
    filesModified,
    errors,
    summary,
  };
}

/**
 * Capture a terminal session and save it as a Memory entry.
 *
 * @param terminalId - ID of the terminal
 * @param output - Terminal output buffer
 * @param projectId - Project ID the terminal belongs to
 * @param terminalName - Name of the terminal (optional)
 * @param taskId - Task ID the terminal was working on (optional)
 * @returns Created Memory record ID
 */
export async function captureSessionInsight(
  terminalId: string,
  output: string,
  projectId: string,
  terminalName?: string,
  taskId?: string
): Promise<string> {
  try {
    // Parse the output
    const insight = parseSessionOutput(output);

    // Skip if no meaningful activity
    if (
      insight.commands.length === 0 &&
      insight.filesModified.length === 0 &&
      insight.errors.length === 0
    ) {
      console.log(`[SessionCapture] Skipping empty session for terminal ${terminalId}`);
      return '';
    }

    const prisma = databaseService.getClient();

    // Create metadata
    const metadata = {
      terminalId,
      terminalName: terminalName || 'Unknown Terminal',
      commandCount: insight.commands.length,
      fileCount: insight.filesModified.length,
      errorCount: insight.errors.length,
      timestamp: new Date().toISOString(),
    };

    // Create the memory entry with task association and source tracking
    const memory = await prisma.memory.create({
      data: {
        type: 'session',
        title: insight.title,
        content: insight.summary,
        metadata: JSON.stringify(metadata),
        projectId,
        terminalId,
        source: 'auto_session',
        ...(taskId && { taskId }),
      },
    });

    console.log(
      `[SessionCapture] Captured session "${insight.title}" for terminal ${terminalId}${taskId ? ` (Task: ${taskId})` : ''} (Memory ID: ${memory.id})`
    );

    return memory.id;
  } catch (error) {
    console.error(`[SessionCapture] Failed to capture session for terminal ${terminalId}:`, error);
    throw new Error(
      `Failed to capture session: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
