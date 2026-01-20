/**
 * Session Capture Service
 *
 * Captures and parses terminal session output into Memory entries.
 * Extracts shell commands, file modifications, errors, and creates summaries
 * for storing as "session" type memories in the database.
 */

import { databaseService } from './database.js';

/**
 * ANSI escape code regex for stripping terminal formatting
 */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

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
 * Strip ANSI escape codes from terminal output
 *
 * @param text - Raw terminal output with ANSI codes
 * @returns Clean text without ANSI formatting
 */
function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
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
      trimmed.match(/^PS\s.*>\s/)
    ) {
      let command = trimmed.replace(/^[$%]\s/, '').replace(/^PS\s.*>\s/, '');
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
    const gitMatch = line.match(/^\s*[MAD]\s+(.+)$/);
    if (gitMatch && gitMatch[1]) {
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
    const packageMatch = line.match(/(?:added|updated|removed)\s+(.+)/);
    if (packageMatch && packageMatch[1]) {
      files.add(packageMatch[1].trim());
    }
  }

  return Array.from(files);
}

/**
 * Extract error messages from output.
 * Looks for common error patterns across different tools.
 *
 * @param output - Clean terminal output
 * @returns Array of error messages
 */
function extractErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Common error patterns
    if (
      trimmed.match(/^error:/i) ||
      trimmed.match(/^fatal:/i) ||
      trimmed.match(/Error:/i) ||
      trimmed.match(/Exception:/i) ||
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
 * Generate a summary title for the session based on commands and activity.
 *
 * @param commands - List of commands executed
 * @param errors - List of errors encountered
 * @returns A concise title for the session
 */
function generateTitle(commands: string[], errors: string[]): string {
  if (errors.length > 0) {
    const firstCmd = commands[0];
    const cmdName = firstCmd ? firstCmd.split(' ')[0] : 'terminal activity';
    return `Session with errors: ${cmdName}`;
  }

  if (commands.length === 0) {
    return 'Terminal session';
  }

  const firstCommand = commands[0];
  if (!firstCommand) {
    return 'Terminal session';
  }

  const cmdParts = firstCommand.split(' ');
  const cmdName = cmdParts[0];
  if (!cmdName) {
    return 'Terminal session';
  }

  // Common command patterns
  if (cmdName === 'git') {
    const gitSubcommand = cmdParts[1];
    return `Git ${gitSubcommand || 'operations'}`;
  }

  if (['npm', 'yarn', 'pnpm'].includes(cmdName)) {
    return `Package management: ${cmdName}`;
  }

  if (['cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv'].includes(cmdName)) {
    return `File operations: ${cmdName}`;
  }

  if (['node', 'python', 'ruby', 'go'].includes(cmdName)) {
    return `Running ${cmdName} script`;
  }

  // Default
  return `Terminal session: ${cmdName}`;
}

/**
 * Generate a textual summary of the session.
 *
 * @param insight - Parsed session insight data
 * @returns Formatted summary text
 */
function generateSummary(insight: Omit<SessionInsight, 'summary'>): string {
  const parts: string[] = [];

  if (insight.commands.length > 0) {
    parts.push(`Commands executed:\n${insight.commands.map(c => `  - ${c}`).join('\n')}`);
  }

  if (insight.filesModified.length > 0) {
    parts.push(`Files modified:\n${insight.filesModified.map(f => `  - ${f}`).join('\n')}`);
  }

  if (insight.errors.length > 0) {
    parts.push(`Errors encountered:\n${insight.errors.map(e => `  - ${e}`).join('\n')}`);
  }

  if (parts.length === 0) {
    return 'No significant activity recorded in this session.';
  }

  return parts.join('\n\n');
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

  // Extract key information
  const commands = extractCommands(cleanOutput);
  const filesModified = extractFilePaths(cleanOutput);
  const errors = extractErrors(cleanOutput);

  // Generate title and summary
  const title = generateTitle(commands, errors);
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
 * @returns Created Memory record ID
 */
export async function captureSessionInsight(
  terminalId: string,
  output: string,
  projectId: string,
  terminalName?: string
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

    // Create the memory entry
    const memory = await prisma.memory.create({
      data: {
        type: 'session',
        title: insight.title,
        content: insight.summary,
        metadata: JSON.stringify(metadata),
        projectId,
      },
    });

    console.log(
      `[SessionCapture] Captured session "${insight.title}" for terminal ${terminalId} (Memory ID: ${memory.id})`
    );

    return memory.id;
  } catch (error) {
    console.error(`[SessionCapture] Failed to capture session for terminal ${terminalId}:`, error);
    throw new Error(
      `Failed to capture session: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
