/**
 * TerminalManager Service
 *
 * Manages terminal processes using node-pty for cross-platform shell integration.
 * Handles spawning, resizing, writing to, and cleaning up terminal processes.
 */

import * as pty from 'node-pty';
import { platform } from 'os';

/**
 * Options for spawning a new terminal
 */
export interface TerminalOptions {
  /** Working directory for the terminal process */
  cwd?: string;
  /** Environment variables for the terminal process */
  env?: Record<string, string>;
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
  private terminals: Map<string, ManagedTerminal> = new Map();

  /** Maximum buffer size per terminal (100KB) */
  private readonly MAX_BUFFER_SIZE = 100 * 1024;

  /** Line-based output buffers for race condition prevention */
  private outputBuffers: Map<string, string[]> = new Map();

  /** Incomplete line fragments from previous chunks */
  private incompleteLines: Map<string, string> = new Map();

  /** Maximum number of lines to buffer per terminal */
  private readonly MAX_BUFFER_LINES = 100;

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

      // Get the default shell
      const shell = this.getDefaultShell();

      // Prepare environment variables
      const env = {
        ...process.env,
        ...options.env,
      } as Record<string, string>;

      // Default to current working directory if not specified
      const cwd = options.cwd || process.cwd();

      // Spawn the terminal process
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
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
          console.log(`[TerminalManager] PTY onData for ${id}: ${data.length} bytes, preview: ${JSON.stringify(preview)}`);

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

      // Store the managed terminal
      const managedTerminal: ManagedTerminal = {
        id,
        pty: ptyProcess,
        name,
        pid: ptyProcess.pid,
        outputBuffer: '',
      };

      this.terminals.set(id, managedTerminal);

      console.log(
        `[TerminalManager] Spawned terminal "${name}" (${id}) with PID ${ptyProcess.pid}`
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
      console.log(`[TerminalManager] Writing to terminal ${id}: ${data.length} bytes, preview: ${JSON.stringify(preview)}`);

      terminal.pty.write(data);
    } catch (error) {
      console.error(`[TerminalManager] Failed to write to terminal ${id}:`, error);
      throw new Error(
        `Failed to write to terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resize a terminal.
   *
   * @param id - Terminal ID
   * @param cols - Number of columns
   * @param rows - Number of rows
   * @returns True if resize was successful, false if terminal not found
   */
  resize(id: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      // Terminal may have already been cleaned up - this is not an error
      console.debug(`[TerminalManager] Terminal ${id} not found for resize - may have been closed`);
      return false;
    }

    try {
      terminal.pty.resize(cols, rows);
      console.log(
        `[TerminalManager] Resized terminal ${id} to ${cols}x${rows}`
      );
      return true;
    } catch (error) {
      console.error(`[TerminalManager] Failed to resize terminal ${id}:`, error);
      throw new Error(
        `Failed to resize terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Kill a terminal process and remove it from the manager.
   *
   * @param id - Terminal ID
   * @throws Error if terminal not found
   */
  kill(id: string): void {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      terminal.pty.kill();
      this.terminals.delete(id);
      this.outputBuffers.delete(id);
      this.incompleteLines.delete(id);
      console.log(`[TerminalManager] Killed terminal ${id}`);
    } catch (error) {
      console.error(`[TerminalManager] Failed to kill terminal ${id}:`, error);
      // Still remove from maps even if kill fails
      this.terminals.delete(id);
      this.outputBuffers.delete(id);
      this.incompleteLines.delete(id);
      throw new Error(
        `Failed to kill terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      `[TerminalManager] Killing all terminals (${this.terminals.size} active)`
    );

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
   * Pause a terminal process by sending SIGSTOP signal.
   * This suspends the process execution without terminating it.
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

    try {
      // Send SIGSTOP to pause the process
      process.kill(terminal.pty.pid, 'SIGSTOP');
      console.log(`[TerminalManager] Paused terminal ${id} (PID ${terminal.pty.pid})`);
      return true;
    } catch (error) {
      console.error(`[TerminalManager] Failed to pause terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Resume a paused terminal process by sending SIGCONT signal.
   * This continues a previously suspended process.
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

    try {
      // Send SIGCONT to resume the process
      process.kill(terminal.pty.pid, 'SIGCONT');
      console.log(`[TerminalManager] Resumed terminal ${id} (PID ${terminal.pty.pid})`);
      return true;
    } catch (error) {
      console.error(`[TerminalManager] Failed to resume terminal ${id}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const terminalManager = new TerminalManager();
