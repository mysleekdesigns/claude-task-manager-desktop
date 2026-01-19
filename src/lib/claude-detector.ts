/**
 * Claude Code Detection Utilities
 *
 * Utilities for detecting Claude Code status in terminal output.
 */

/**
 * Claude status type
 */
export type ClaudeStatus = 'inactive' | 'active' | 'waiting';

/**
 * Patterns to detect Claude Code in terminal output
 */
const CLAUDE_PATTERNS = {
  // Claude Code starting
  start: [
    /claude code/i,
    /starting claude/i,
    /claude (?:v|version)/i,
  ],

  // Claude waiting for input
  waiting: [
    /how can i help/i,
    /what would you like/i,
    /what can i help you with/i,
  ],

  // Claude actively working
  active: [
    /analyzing/i,
    /implementing/i,
    /creating/i,
    /updating/i,
    /reading.*file/i,
    /writing.*file/i,
  ],

  // Claude exiting
  exit: [
    /exiting claude/i,
    /goodbye/i,
    /claude.*exited/i,
  ],
};

/**
 * Detect Claude Code status from terminal output
 */
export function detectClaudeStatus(output: string): ClaudeStatus | null {
  // Check for exit patterns first
  if (CLAUDE_PATTERNS.exit.some(pattern => pattern.test(output))) {
    return 'inactive';
  }

  // Check for active patterns
  if (CLAUDE_PATTERNS.active.some(pattern => pattern.test(output))) {
    return 'active';
  }

  // Check for waiting patterns
  if (CLAUDE_PATTERNS.waiting.some(pattern => pattern.test(output))) {
    return 'waiting';
  }

  // Check for start patterns
  if (CLAUDE_PATTERNS.start.some(pattern => pattern.test(output))) {
    return 'active';
  }

  return null;
}

/**
 * Create a Claude status detector that accumulates output
 * and detects status changes over time
 */
export function createClaudeStatusDetector() {
  let buffer = '';
  const MAX_BUFFER_SIZE = 10000; // Keep last 10KB of output

  return {
    /**
     * Process new terminal output and detect status
     */
    process(output: string): ClaudeStatus | null {
      // Add to buffer
      buffer += output;

      // Trim buffer if too large
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer = buffer.slice(-MAX_BUFFER_SIZE);
      }

      // Detect status from recent output
      return detectClaudeStatus(output);
    },

    /**
     * Get the current buffer content
     */
    getBuffer(): string {
      return buffer;
    },

    /**
     * Clear the buffer
     */
    clear(): void {
      buffer = '';
    },
  };
}
