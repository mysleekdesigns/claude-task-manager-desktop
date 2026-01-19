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
}

/**
 * TerminalManager handles the lifecycle of terminal processes.
 *
 * Features:
 * - Cross-platform shell detection
 * - Terminal spawning with custom environment and working directory
 * - Input writing and terminal resizing
 * - Process cleanup and resource management
 */
class TerminalManager {
  private terminals: Map<string, ManagedTerminal> = new Map();

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

      // Set up data handler
      ptyProcess.onData((data: string) => {
        try {
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
          // Clean up the terminal from our map
          this.terminals.delete(id);
        }
      });

      // Store the managed terminal
      const managedTerminal: ManagedTerminal = {
        id,
        pty: ptyProcess,
        name,
        pid: ptyProcess.pid,
      };

      this.terminals.set(id, managedTerminal);

      console.log(
        `[TerminalManager] Spawned terminal "${name}" (${id}) with PID ${ptyProcess.pid}`
      );

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
   * @throws Error if terminal not found
   */
  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);

    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      terminal.pty.resize(cols, rows);
      console.log(
        `[TerminalManager] Resized terminal ${id} to ${cols}x${rows}`
      );
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
      console.log(`[TerminalManager] Killed terminal ${id}`);
    } catch (error) {
      console.error(`[TerminalManager] Failed to kill terminal ${id}:`, error);
      // Still remove from map even if kill fails
      this.terminals.delete(id);
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
}

// Export singleton instance
export const terminalManager = new TerminalManager();
