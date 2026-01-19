/**
 * IPC Request/Response Logger
 *
 * Provides development-mode logging for IPC calls with timing information.
 */

import { app } from 'electron';

/**
 * Check if we're in development mode
 */
const isDev = !app.isPackaged;

/**
 * Log levels for IPC logger
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
} as const;

/**
 * Format milliseconds into a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) {
    return '<1ms';
  }
  if (ms < 1000) {
    return `${String(Math.round(ms))}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get color based on duration (for visual feedback on slow calls)
 */
function getDurationColor(ms: number): string {
  if (ms < 50) return colors.green;
  if (ms < 200) return colors.yellow;
  return colors.red;
}

/**
 * Truncate long values for display
 */
function truncateValue(value: unknown, maxLength = 100): string {
  // Handle undefined and null explicitly since JSON.stringify returns undefined for undefined
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }

  const str = JSON.stringify(value);
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Log an IPC request
 */
export function logIPCRequest(channel: string, args: unknown[]): void {
  if (!isDev) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, -1) ?? '';
  const argsDisplay = args.length > 0 ? truncateValue(args) : '';

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.cyan}IPC${colors.reset} ` +
      `${colors.bright}${colors.blue}>>>${colors.reset} ` +
      `${colors.magenta}${channel}${colors.reset}` +
      (argsDisplay ? ` ${colors.dim}${argsDisplay}${colors.reset}` : '')
  );
}

/**
 * Log an IPC response
 */
export function logIPCResponse(
  channel: string,
  result: unknown,
  durationMs: number,
  success: boolean
): void {
  if (!isDev) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, -1) ?? '';
  const durationColor = getDurationColor(durationMs);
  const statusColor = success ? colors.green : colors.red;
  const statusSymbol = success ? '<<<' : 'xxx';
  const resultDisplay = truncateValue(result);

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.cyan}IPC${colors.reset} ` +
      `${colors.bright}${statusColor}${statusSymbol}${colors.reset} ` +
      `${colors.magenta}${channel}${colors.reset} ` +
      `${durationColor}(${formatDuration(durationMs)})${colors.reset}` +
      (resultDisplay !== 'undefined'
        ? ` ${colors.dim}${resultDisplay}${colors.reset}`
        : '')
  );
}

/**
 * Log an IPC error
 */
export function logIPCError(
  channel: string,
  error: unknown,
  durationMs: number
): void {
  if (!isDev) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, -1) ?? '';
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.cyan}IPC${colors.reset} ` +
      `${colors.bright}${colors.red}ERR${colors.reset} ` +
      `${colors.magenta}${channel}${colors.reset} ` +
      `${colors.red}(${formatDuration(durationMs)})${colors.reset} ` +
      `${colors.red}${errorMessage}${colors.reset}`
  );
}

/**
 * Log an IPC event being sent
 */
export function logIPCEvent(channel: string, args: unknown[]): void {
  if (!isDev) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, -1) ?? '';
  const argsDisplay = args.length > 0 ? truncateValue(args) : '';

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.cyan}IPC${colors.reset} ` +
      `${colors.bright}${colors.yellow}EVT${colors.reset} ` +
      `${colors.magenta}${channel}${colors.reset}` +
      (argsDisplay ? ` ${colors.dim}${argsDisplay}${colors.reset}` : '')
  );
}

/**
 * IPC Logger class for creating scoped loggers
 */
export class IPCLogger {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a warning
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log an error
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!isDev && level !== 'error' && level !== 'warn') return;

    const timestamp =
      new Date().toISOString().split('T')[1]?.slice(0, -1) ?? '';
    const levelColors: Record<LogLevel, string> = {
      debug: colors.dim,
      info: colors.blue,
      warn: colors.yellow,
      error: colors.red,
    };

    const logFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;

    logFn(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
        `${levelColors[level]}[${level.toUpperCase()}]${colors.reset} ` +
        `${colors.cyan}[${this.prefix}]${colors.reset} ` +
        message,
      ...args
    );
  }
}

/**
 * Create a logger with a specific prefix
 */
export function createIPCLogger(prefix: string): IPCLogger {
  return new IPCLogger(prefix);
}
