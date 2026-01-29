/**
 * TerminalManager Service
 *
 * Manages terminal processes using node-pty for cross-platform shell integration.
 * Handles spawning, resizing, writing to, and cleaning up terminal processes.
 */

import * as pty from 'node-pty';
import { platform } from 'os';
import { execSync } from 'child_process';

/** Maximum number of terminals allowed */
const MAX_TERMINALS = 4;

/**
 * Options for spawning a new terminal
 */
export interface TerminalOptions {
  /** Working directory for the terminal process */
  cwd?: string;
  /** Environment variables for the terminal process */
  env?: Record<string, string>;
  /** Initial number of columns (defaults to 80) */
  cols?: number;
  /** Initial number of rows (defaults to 24) */
  rows?: number;
  /** Callback for terminal output data */
  onData: (data: string) => void;
  /** Callback for terminal exit */
  onExit: (code: number) => void;
}

/**
 * Managed terminal instance
 */
interface ManagedTerminal {
  /** Unique identifier for the terminal */
  id: string;
  /** The node-pty instance */
  pty: pty.IPty;
  /** Display name for the terminal */
  name: string;
  /** Process ID of the terminal */
  pid: number;
  /** Output buffer for session capture */
  outputBuffer: string;
  /** Current terminal columns */
  cols: number;
  /** Current terminal rows */
  rows: number;
}

/**
 * TerminalManager handles the lifecycle of terminal processes.
 *
 * Features:
 * - Cross-platform shell detection
 * - Terminal spawning with custom environment and working directory
 * - Input writing and terminal resizing
 * - Process cleanup and resource management
 * - Output buffering for session capture (limited to 100KB per terminal)
 * - Line-based output buffering to prevent race conditions (last 100 lines per terminal)
 */
class TerminalManager {
  private terminals = new Map<string, ManagedTerminal>();

  /** Maximum buffer size per terminal (100KB) */
  private readonly MAX_BUFFER_SIZE = 100 * 1024;

  /** Line-based output buffers for race condition prevention */
  private outputBuffers = new Map<string, string[]>();

  /** Incomplete line fragments from previous chunks */
  private incompleteLines = new Map<string, string>();

  /** Serialized terminal state from xterm SerializeAddon (preserves cursor position, attributes, buffer content) */
  private serializedStates = new Map<string, { content: string; cursorX: number; cursorY: number }>();

  /** Maximum number of lines to buffer per terminal */
  private readonly MAX_BUFFER_LINES = 100;

  /** Pending resize timers for debouncing (per terminal) */
  private resizeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Debounce delay for resize operations in milliseconds */
  private readonly RESIZE_DEBOUNCE_MS = 100;

  /**
   * Get the default shell based on the current platform.
   *
   * @returns The path to the default shell executable
   */
  private getDefaultShell(): string {
    const currentPlatform = platform();

    if (currentPlatform === 'win32') {
      return 'powershell.exe';
    }

    // For macOS and Linux, prefer zsh if available, otherwise bash
    // In practice, both should be available on modern systems
    return process.env['SHELL'] || '/bin/bash';
  }

  /**
   * Spawn a new terminal process.
   *
   * @param id - Unique identifier for the terminal
   * @param name - Display name for the terminal
   * @param options - Terminal configuration options
   * @returns Terminal information including ID and process ID
   * @throws Error if spawning fails
   */
  spawn(
    id: string,
    name: string,
    options: TerminalOptions
  ): { id: string; pid: number } {
    try {
      // Check if terminal with this ID already exists
      if (this.terminals.has(id)) {
        throw new Error(`Terminal with ID ${id} already exists`);
      }

      // Check if we've reached the maximum number of terminals
      if (this.terminals.size >= MAX_TERMINALS) {
        throw new Error(`Maximum terminal limit (${MAX_TERMINALS}) reached`);
      }

      // Get the default shell
      const shell = this.getDefaultShell();

      // Prepare environment variables
      const env = {
        ...process.env,
        ...options.env,
      } as Record<string, string>;

      // Reset TMPDIR to system default to avoid sandbox permission issues.
      // If Claude Code is run in this terminal, its sandbox creates working directory
      // symlinks in /tmp/claude-<uid>/ which fails if TMPDIR points to a restricted location.
      // Only delete if not explicitly set in options.env to allow user override.
      if (!options.env?.['TMPDIR']) {
        delete env['TMPDIR'];
      }

      // Default to current working directory if not specified
      const cwd = options.cwd || process.cwd();

      // Use provided dimensions or defaults
      const cols = options.cols || 80;
      const rows = options.rows || 24;

      // Add terminal dimension environment variables for Claude Code / Ink detection.
      // These help CLI applications detect terminal width when process.stdout.columns
      // returns undefined in embedded PTY environments.
      env['COLUMNS'] = String(cols);
      env['LINES'] = String(rows);
      env['CLI_WIDTH'] = String(cols);  // For cli-width package used by Ink

      // Spawn the terminal process
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      });

      // Initialize line buffer and incomplete line tracker for this terminal
      this.outputBuffers.set(id, []);
      this.incompleteLines.set(id, '');

      // Set up data handler
      ptyProcess.onData((data: string) => {
        try {
          // Debug: log PTY data received
          const preview = data.length > 100 ? data.substring(0, 100) + '...' : data;
          console.log(`[TerminalManager] PTY onData for ${id}: ${String(data.length)} bytes, preview: ${JSON.stringify(preview)}`);

          // Add to buffer for session capture
          this.addToBuffer(id, data);

          // Add to line-based output buffer for race condition prevention
          this.addToLineBuffer(id, data);

          // Forward to callback
          options.onData(data);
        } catch (error) {
          console.error(
            `[TerminalManager] Error in onData callback for terminal ${id}:`,
            error
          );
        }
      });

      // Set up exit handler
      ptyProcess.onExit((event: { exitCode: number; signal?: number }) => {
        try {
          options.onExit(event.exitCode);
        } catch (error) {
          console.error(
            `[TerminalManager] Error in onExit callback for terminal ${id}:`,
            error
          );
        } finally {
          // Clean up the terminal from our maps
          this.terminals.delete(id);
          this.outputBuffers.delete(id);
          this.incompleteLines.delete(id);
        }
      });

      // Store the managed terminal with initial dimensions
      const managedTerminal: ManagedTerminal = {
        id,
        pty: ptyProcess,
        name,
        pid: ptyProcess.pid,
        outputBuffer: '',
        cols,
        rows,
      };

      this.terminals.set(id, managedTerminal);

      console.log(
        `[TerminalManager] Spawned terminal "${name}" (${id}) with PID ${String(ptyProcess.pid)}`
      );
      console.log(`[TerminalManager] Terminal spawned with shell: ${shell}, cwd: ${cwd}`);

      return {
        id,
        pid: ptyProcess.pid,
      };
    } catch (error) {
      console.error(`[TerminalManager] Failed to spawn terminal ${id}:`, error);
      throw new Error(
        `Failed to spawn terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Write input data to a terminal.
   *
   * @param id - Terminal ID
   * @param data - Data to write to the terminal
   * @throws Error if terminal not found
   */
  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      // Debug: log what's being written to the terminal
      const preview = data.length > 100 ? data.substring(0, 100) + '...' : data;
      console.log(`[TerminalManager] Writing to terminal ${id}: ${String(data.length)} bytes, preview: ${JSON.stringify(preview)}`);

      terminal.pty.write(data);
    } catch (error) {
      console.error(`[TerminalManager] Failed to write to terminal ${id}:`, error);
      throw new Error(
        `Failed to write to terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /** Minimum number of columns for terminal resize */
  private readonly MIN_COLS = 10;

  /** Minimum number of rows for terminal resize */
  private readonly MIN_ROWS = 5;

  /**
   * Resize a terminal with debouncing to prevent SIGWINCH flooding.
   *
   * @param id - Terminal ID
   * @param cols - Number of columns (minimum: 10)
   * @param rows - Number of rows (minimum: 5)
   * @returns True if resize was scheduled/executed, false if terminal not found
   * @throws Error if dimensions are below minimums
   */
  resize(id: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      // Terminal may have already been cleaned up - this is not an error
      console.debug(`[TerminalManager] Terminal ${id} not found for resize - may have been closed`);
      return false;
    }

    // Validate minimum dimensions to prevent unusable terminal sizes
    if (cols < this.MIN_COLS || rows < this.MIN_ROWS) {
      throw new Error(
        `Invalid terminal dimensions: ${cols}x${rows}. Minimum is ${this.MIN_COLS}x${this.MIN_ROWS}.`
      );
    }

    // Check if dimensions actually changed
    if (terminal.cols === cols && terminal.rows === rows) {
      console.debug(
        `[TerminalManager] Skipping resize for terminal ${id} - dimensions unchanged (${String(cols)}x${String(rows)})`
      );
      return true;
    }

    // Clear any pending resize timer for this terminal
    const existingTimer = this.resizeTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule the resize with debouncing
    const timer = setTimeout(() => {
      this.resizeTimers.delete(id);
      this.executeResize(id, cols, rows);
    }, this.RESIZE_DEBOUNCE_MS);

    this.resizeTimers.set(id, timer);
    return true;
  }

  /**
   * Execute the actual PTY resize operation.
   * This is called after debouncing and performs the low-level resize.
   *
   * @param id - Terminal ID
   * @param cols - Number of columns
   * @param rows - Number of rows
   */
  private executeResize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      // Terminal may have been closed during debounce delay
      console.debug(`[TerminalManager] Terminal ${id} no longer exists for deferred resize`);
      return;
    }

    // Double-check dimensions haven't changed to match current state
    // (another resize may have come in with different dimensions)
    if (terminal.cols === cols && terminal.rows === rows) {
      console.debug(
        `[TerminalManager] Skipping deferred resize for terminal ${id} - dimensions already match (${String(cols)}x${String(rows)})`
      );
      return;
    }

    try {
      terminal.pty.resize(cols, rows);
      // Update tracked dimensions after successful resize
      terminal.cols = cols;
      terminal.rows = rows;
      console.log(
        `[TerminalManager] Resized terminal ${id} to ${String(cols)}x${String(rows)}`
      );
    } catch (error) {
      console.error(`[TerminalManager] Failed to resize terminal ${id}:`, error);
      // Don't throw - this is called from a timer callback
    }
  }

  /**
   * Kill a terminal process and remove it from the manager.
   * This method is idempotent - calling it on a non-existent terminal is safe.
   *
   * @param id - Terminal ID
   * @returns True if terminal was killed, false if terminal was not found (already cleaned up)
   */
  kill(id: string): boolean {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      console.debug(`[TerminalManager] Terminal ${id} not found - already cleaned up`);
      return false;
    }

    // Clear any pending resize timer
    const resizeTimer = this.resizeTimers.get(id);
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      this.resizeTimers.delete(id);
    }

    try {
      terminal.pty.kill();
      this.terminals.delete(id);
      this.outputBuffers.delete(id);
      this.incompleteLines.delete(id);
      this.serializedStates.delete(id);
      console.log(`[TerminalManager] Killed terminal ${id}`);
      return true;
    } catch (error) {
      console.error(`[TerminalManager] Failed to kill terminal ${id}:`, error);
      // Still remove from maps even if kill fails
      this.terminals.delete(id);
      this.outputBuffers.delete(id);
      this.incompleteLines.delete(id);
      this.serializedStates.delete(id);
      // Return true since we cleaned up the terminal from our tracking
      return true;
    }
  }

  /**
   * Get a terminal by ID.
   *
   * @param id - Terminal ID
   * @returns The managed terminal or undefined if not found
   */
  get(id: string): ManagedTerminal | undefined {
    return this.terminals.get(id);
  }

  /**
   * Get all terminal IDs.
   *
   * @returns Array of terminal IDs
   */
  getAll(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Kill all terminals and clear the manager.
   * This should be called when the app is closing.
   */
  killAll(): void {
    console.log(
      `[TerminalManager] Killing all terminals (${String(this.terminals.size)} active)`
    );

    // Clear all pending resize timers
    for (const timer of this.resizeTimers.values()) {
      clearTimeout(timer);
    }
    this.resizeTimers.clear();

    for (const [id, terminal] of this.terminals.entries()) {
      try {
        terminal.pty.kill();
        console.log(`[TerminalManager] Killed terminal ${id}`);
      } catch (error) {
        console.error(`[TerminalManager] Failed to kill terminal ${id}:`, error);
      }
    }

    this.terminals.clear();
    this.outputBuffers.clear();
    this.incompleteLines.clear();
    this.serializedStates.clear();
  }

  /**
   * Get the number of active terminals.
   *
   * @returns Number of active terminals
   */
  getActiveCount(): number {
    return this.terminals.size;
  }

  /**
   * Check if a terminal exists.
   *
   * @param id - Terminal ID
   * @returns True if the terminal exists
   */
  has(id: string): boolean {
    return this.terminals.has(id);
  }

  /**
   * Add output data to the terminal's buffer.
   * Automatically truncates if buffer exceeds MAX_BUFFER_SIZE.
   *
   * @param id - Terminal ID
   * @param data - Output data to add
   */
  addToBuffer(id: string, data: string): void {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      return;
    }

    // Append data
    terminal.outputBuffer += data;

    // Truncate if exceeds max size
    if (terminal.outputBuffer.length > this.MAX_BUFFER_SIZE) {
      // Keep only the last MAX_BUFFER_SIZE characters
      terminal.outputBuffer = terminal.outputBuffer.slice(-this.MAX_BUFFER_SIZE);
    }
  }

  /**
   * Get the output buffer for a terminal.
   *
   * @param id - Terminal ID
   * @returns The terminal's output buffer, or empty string if not found
   */
  getBuffer(id: string): string {
    const terminal = this.terminals.get(id);
    return terminal?.outputBuffer || '';
  }

  /**
   * Clear the output buffer for a terminal.
   *
   * @param id - Terminal ID
   */
  clearBuffer(id: string): void {
    const terminal = this.terminals.get(id);

    if (terminal) {
      terminal.outputBuffer = '';
    }
  }

  /**
   * Add output data to the line-based buffer for race condition prevention.
   * Keeps the last MAX_BUFFER_LINES lines.
   *
   * This handles terminal data that arrives in arbitrary chunks (e.g., "Hello\nWo", then "rld\n")
   * by tracking incomplete lines across chunks and only pushing complete lines to the buffer.
   *
   * @param id - Terminal ID
   * @param data - Output data to add
   */
  private addToLineBuffer(id: string, data: string): void {
    const buffer = this.outputBuffers.get(id);

    if (!buffer) {
      return;
    }

    // Prepend any incomplete line from the previous chunk
    const incomplete = this.incompleteLines.get(id) || '';
    const fullData = incomplete + data;

    // Split on newlines
    const lines = fullData.split('\n');

    // If data doesn't end with \n, the last element is incomplete
    if (!fullData.endsWith('\n')) {
      // Save the incomplete line for the next chunk
      this.incompleteLines.set(id, lines.pop() || '');
    } else {
      // Data ended with \n, so all lines are complete
      this.incompleteLines.set(id, '');
    }

    // Add complete lines to the buffer
    for (const line of lines) {
      buffer.push(line);

      // Truncate buffer if it exceeds max lines
      if (buffer.length > this.MAX_BUFFER_LINES) {
        buffer.shift(); // Remove oldest line
      }
    }
  }

  /**
   * Get the line-based output buffer for a terminal.
   * Used to retrieve buffered output when the renderer starts listening.
   *
   * @param id - Terminal ID
   * @returns Array of buffered output lines, or empty array if not found
   */
  getOutputBuffer(id: string): string[] {
    return this.outputBuffers.get(id) || [];
  }

  /**
   * Clear the line-based output buffer for a terminal.
   * Used to prevent duplicate output when the renderer re-reads the buffer.
   *
   * @param id - Terminal ID
   */
  clearOutputBuffer(id: string): void {
    this.outputBuffers.set(id, []);
    this.incompleteLines.set(id, '');
  }

  /**
   * Save serialized terminal state (from xterm SerializeAddon).
   * This preserves cursor position, attributes, and buffer content.
   *
   * @param id - Terminal ID
   * @param state - Serialized state string from SerializeAddon.serialize()
   * @param cursorX - Cursor X position (column)
   * @param cursorY - Cursor Y position (row)
   */
  saveSerializedState(id: string, state: string, cursorX: number, cursorY: number): void {
    // DEBUG: Log what we're receiving from renderer
    console.log('[TerminalManager] saveSerializedState called for id=' + id);
    console.log('[TerminalManager] saveSerializedState state.length=' + (state ? state.length : 'null'));
    console.log('[TerminalManager] saveSerializedState cursorX=' + cursorX + ', cursorY=' + cursorY);
    console.log('[TerminalManager] saveSerializedState state is empty:', state === '');
    if (state && state.length > 0) {
      console.log('[TerminalManager] saveSerializedState first 200 chars:', state.substring(0, 200));
    }

    this.serializedStates.set(id, { content: state, cursorX, cursorY });
  }

  /**
   * Get serialized terminal state.
   * Returns the serialized state or null if not available.
   *
   * @param id - Terminal ID
   * @returns The serialized state object with content and cursor position, or null if not found
   */
  getSerializedState(id: string): { content: string; cursorX: number; cursorY: number } | null {
    const state = this.serializedStates.get(id) || null;
    // DEBUG: Log what we're returning to renderer
    console.log('[TerminalManager] getSerializedState for id=' + id);
    console.log('[TerminalManager] getSerializedState result:', state ? 'found (length=' + state.content.length + ')' : 'null');
    return state;
  }

  /**
   * Clear serialized terminal state.
   *
   * @param id - Terminal ID
   */
  clearSerializedState(id: string): void {
    this.serializedStates.delete(id);
  }

  /**
   * Find the foreground process group ID for a terminal.
   *
   * When a shell runs a foreground command (like `claude`), that command typically
   * becomes the leader of its own process group. This is standard Unix job control.
   * The shell's PGID is NOT the same as the foreground command's PGID.
   *
   * This method finds the actual foreground PGID by:
   * 1. Finding child processes of the shell
   * 2. Looking for a child that has a different PGID (indicating a new process group)
   * 3. Returning that PGID so we can signal the correct process group
   *
   * @param shellPid - The PID of the shell process (from node-pty)
   * @returns The foreground PGID, or null if not found
   */
  private findForegroundPgid(shellPid: number): number | null {
    if (platform() === 'win32') {
      // Windows doesn't use Unix-style process groups
      return null;
    }

    try {
      // Get all processes with their PID, PPID, and PGID
      // Look for direct children of the shell that have their own PGID
      const output = execSync(
        `ps -o pid=,ppid=,pgid= -p $(pgrep -P ${shellPid} 2>/dev/null | tr '\\n' ',' | sed 's/,$//')`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (!output) {
        console.log(`[TerminalManager] No child processes found for shell PID ${shellPid}`);
        return null;
      }

      // Parse the output to find a process with a different PGID than the shell
      const lines = output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const pidStr = parts[0];
          const pgidStr = parts[2];
          if (pidStr && pgidStr) {
            const childPid = parseInt(pidStr, 10);
            const pgid = parseInt(pgidStr, 10);

            // If this child has a PGID different from the shell's PID,
            // it's likely the foreground process group leader
            if (pgid !== shellPid && pgid === childPid) {
              console.log(`[TerminalManager] Found foreground PGID ${pgid} (process ${childPid}) for shell ${shellPid}`);
              return pgid;
            }
          }
        }
      }

      // If all children have the shell's PGID, check if any child has its own PGID
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const pgidStr = parts[2];
          if (pgidStr) {
            const pgid = parseInt(pgidStr, 10);
            if (pgid !== shellPid) {
              console.log(`[TerminalManager] Found foreground PGID ${pgid} for shell ${shellPid}`);
              return pgid;
            }
          }
        }
      }

      console.log(`[TerminalManager] All children share shell PGID ${shellPid}`);
      return null;
    } catch (error) {
      // pgrep returns exit code 1 when no processes match, which is normal
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[TerminalManager] Could not find foreground PGID for shell ${shellPid}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Pause a terminal process by sending SIGSTOP signal.
   *
   * IMPORTANT: On Unix systems with job control, when a shell runs a foreground
   * command, that command becomes the leader of its own process group. Sending
   * SIGSTOP to the shell's PGID will NOT stop the foreground command.
   *
   * This method first tries to find and pause the actual foreground process group,
   * falling back to the shell's process group if no foreground process is found.
   *
   * @param id - Terminal ID
   * @returns True if pause was successful, false if terminal not found
   */
  pauseTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal?.pty) {
      console.warn(`[TerminalManager] Terminal ${id} not found for pause`);
      return false;
    }

    const shellPid = terminal.pty.pid;
    const pausedGroups: number[] = [];

    try {
      // First, try to find and pause the foreground process group
      const foregroundPgid = this.findForegroundPgid(shellPid);

      if (foregroundPgid && foregroundPgid !== shellPid) {
        // Pause the foreground process group (e.g., claude and its children)
        try {
          process.kill(-foregroundPgid, 'SIGSTOP');
          pausedGroups.push(foregroundPgid);
          console.log(`[TerminalManager] Sent SIGSTOP to foreground PGID ${foregroundPgid}`);
        } catch (fgError) {
          console.error(`[TerminalManager] Failed to pause foreground PGID ${foregroundPgid}:`, fgError);
        }
      }

      // Also pause the shell's process group to ensure nothing runs
      try {
        process.kill(-shellPid, 'SIGSTOP');
        pausedGroups.push(shellPid);
        console.log(`[TerminalManager] Sent SIGSTOP to shell PGID ${shellPid}`);
      } catch (shellError) {
        // Shell might already be stopped or waiting, which is fine
        console.log(`[TerminalManager] Could not SIGSTOP shell PGID ${shellPid} (may already be waiting):`, shellError);
      }

      if (pausedGroups.length > 0) {
        console.log(`[TerminalManager] Paused terminal ${id} process groups: ${pausedGroups.join(', ')}`);
        return true;
      }

      console.error(`[TerminalManager] Failed to pause any process groups for terminal ${id}`);
      return false;
    } catch (error) {
      console.error(`[TerminalManager] Failed to pause terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Resume a paused terminal process by sending SIGCONT signal.
   *
   * This method sends SIGCONT to both the foreground process group (if found)
   * and the shell's process group to ensure all processes are resumed.
   *
   * @param id - Terminal ID
   * @returns True if resume was successful, false if terminal not found
   */
  resumeTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal?.pty) {
      console.warn(`[TerminalManager] Terminal ${id} not found for resume`);
      return false;
    }

    const shellPid = terminal.pty.pid;
    const resumedGroups: number[] = [];

    try {
      // Resume the shell's process group first
      try {
        process.kill(-shellPid, 'SIGCONT');
        resumedGroups.push(shellPid);
        console.log(`[TerminalManager] Sent SIGCONT to shell PGID ${shellPid}`);
      } catch (shellError) {
        console.log(`[TerminalManager] Could not SIGCONT shell PGID ${shellPid}:`, shellError);
      }

      // Also try to resume the foreground process group if it exists
      const foregroundPgid = this.findForegroundPgid(shellPid);
      if (foregroundPgid && foregroundPgid !== shellPid) {
        try {
          process.kill(-foregroundPgid, 'SIGCONT');
          resumedGroups.push(foregroundPgid);
          console.log(`[TerminalManager] Sent SIGCONT to foreground PGID ${foregroundPgid}`);
        } catch (fgError) {
          console.error(`[TerminalManager] Failed to resume foreground PGID ${foregroundPgid}:`, fgError);
        }
      }

      if (resumedGroups.length > 0) {
        console.log(`[TerminalManager] Resumed terminal ${id} process groups: ${resumedGroups.join(', ')}`);
        return true;
      }

      console.error(`[TerminalManager] Failed to resume any process groups for terminal ${id}`);
      return false;
    } catch (error) {
      console.error(`[TerminalManager] Failed to resume terminal ${id}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const terminalManager = new TerminalManager();
