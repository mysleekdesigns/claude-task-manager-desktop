/**
 * XTerm Terminal Wrapper Component
 *
 * React wrapper for xterm.js terminal emulator with node-pty integration.
 * Handles terminal lifecycle, IPC communication, and addon management.
 *
 * Features:
 * - Restores terminal content from backend buffer on remount (navigation resilience)
 * - Supports output streaming via IPC
 * - Handles resize and fit to container
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { invoke } from '@/lib/ipc';
import type { AllEventChannels } from '@/types/ipc';
import '@xterm/xterm/css/xterm.css';

// ============================================================================
// Types
// ============================================================================

export interface XTermWrapperProps {
  terminalId: string;
  /** Whether the terminal is currently visible (used for focus management after navigation) */
  isVisible?: boolean;
  onResize?: (cols: number, rows: number) => void;
  onExit?: (exitCode: number) => void;
  className?: string;
}

// ============================================================================
// Theme Configuration (Tokyo Night)
// ============================================================================

const TERMINAL_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selection: '#33467c',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

// ============================================================================
// Terminal Options
// ============================================================================

const TERMINAL_OPTIONS = {
  fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
  fontSize: 14,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block' as const,
  theme: TERMINAL_THEME,
  allowTransparency: false,
  scrollback: 10000,
  tabStopWidth: 4,
  allowProposedApi: true, // Required for Unicode11Addon
};

// ============================================================================
// Component
// ============================================================================

export function XTermWrapper({
  terminalId,
  isVisible = true,
  onResize,
  onExit,
  className = '',
}: XTermWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsVisibleRef = useRef<boolean>(isVisible);
  const prevVisibleForSaveRef = useRef<boolean>(true);
  const isRestoringRef = useRef<boolean>(false);

  // ============================================================================
  // Terminal Input Handler
  // ============================================================================

  const handleInput = useCallback(
    (data: string) => {
      // Send input to main process via IPC
      window.electron
        .invoke('terminal:write', { id: terminalId, data })
        .catch((error) => {
          console.error('Failed to write to terminal:', error);
        });
    },
    [terminalId]
  );

  // ============================================================================
  // Terminal Resize Handler
  // ============================================================================

  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current) return;

    // Debounce resize to avoid excessive IPC calls
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (!fitAddonRef.current || !terminalRef.current) return;

      try {
        // Validate dimensions BEFORE fitting to prevent corrupt 10x5 resize
        const dims = fitAddonRef.current.proposeDimensions();
        if (!dims || dims.cols < 20 || dims.rows < 10) {
          console.log('[XTermWrapper] handleResize: Skipping fit - invalid dimensions:', dims);
          return;
        }

        // Get current dimensions before fit to check if they actually changed
        const prevCols = terminalRef.current.cols;
        const prevRows = terminalRef.current.rows;

        // Fit terminal to container
        fitAddonRef.current.fit();

        const { cols, rows } = terminalRef.current;

        // Double-check dimensions after fit (belt and suspenders)
        if (cols < 20 || rows < 10) {
          console.log('[XTermWrapper] handleResize: Skipping resize IPC - invalid post-fit dimensions:', { cols, rows });
          return;
        }

        // Skip IPC if dimensions haven't actually changed
        if (cols === prevCols && rows === prevRows) {
          console.log('[XTermWrapper] handleResize: Skipping resize IPC - dimensions unchanged:', { cols, rows });
          return;
        }

        // Notify main process of new dimensions
        window.electron
          .invoke('terminal:resize', {
            id: terminalId,
            cols,
            rows,
          })
          .catch((error) => {
            console.error('Failed to resize terminal:', error);
          });

        // Call optional resize callback
        onResize?.(cols, rows);
      } catch (error) {
        console.error('Error during terminal resize:', error);
      }
    }, 100); // 100ms debounce
  }, [terminalId, onResize]);

  // ============================================================================
  // Terminal Lifecycle
  // ============================================================================

  useEffect(() => {
    if (!containerRef.current) return;

    // Track cleanup state to prevent operations after unmount
    let isCleanedUp = false;

    // Create terminal instance
    const terminal = new Terminal(TERMINAL_OPTIONS);

    // Create and load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();
    const serializeAddon = new SerializeAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(serializeAddon);

    // Activate Unicode 11 support
    terminal.unicode.activeVersion = '11';

    // Open terminal in container
    terminal.open(containerRef.current);

    // Initial fit with dimension validation to prevent corrupt 10x5 resize
    const initialDims = fitAddon.proposeDimensions();
    if (initialDims && initialDims.cols >= 20 && initialDims.rows >= 10) {
      fitAddon.fit();
    } else {
      console.log('[XTermWrapper] Initial fit: Skipping - invalid dimensions:', initialDims);
      // ResizeObserver will handle fit once container has proper dimensions
    }

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;

    // ============================================================================
    // Register input and exit handlers (these are safe to register early)
    // ============================================================================

    // Subscribe to terminal input (user typing)
    const inputDisposable = terminal.onData(handleInput);

    // Handle output from main process
    const handleOutput = (...args: unknown[]) => {
      if (isCleanedUp) return;
      if (isRestoringRef.current) return; // Skip during restoration
      const data = args[0] as string;
      terminal.write(data);
    };

    // Handle terminal exit
    const handleTerminalExit = (...args: unknown[]) => {
      if (isCleanedUp) return;
      const exitCode = args[0] as number;
      const color = exitCode === 0 ? '\x1b[32m' : '\x1b[31m'; // Green or red
      terminal.writeln(
        `\r\n${color}Process exited with code ${exitCode}\x1b[0m`
      );

      // Call optional exit callback
      onExit?.(exitCode);
    };

    // Subscribe to exit event early (safe to do before restoration)
    const exitChannel = `terminal:exit:${terminalId}` as AllEventChannels;
    const disposeExit = window.electron.on(exitChannel, handleTerminalExit);

    // Output handler will be registered AFTER restoration completes
    const outputChannel = `terminal:output:${terminalId}` as AllEventChannels;
    let disposeOutput: (() => void) | null = null;
    let outputHandlerRegistered = false;

    // ============================================================================
    // Resize Observer
    // ============================================================================

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // ============================================================================
    // Async Initialization: Restore Buffer then Focus
    // ============================================================================
    // When the component remounts (e.g., after navigation), restore any buffered
    // output from the backend. This prevents content loss when navigating away
    // and back to the terminal view.
    //
    // CRITICAL: Focus must be called AFTER buffer restoration completes,
    // otherwise the terminal will not respond to input after navigation.
    // CRITICAL: Output handler must be registered AFTER restoration to prevent
    // PTY data from interleaving with restoration data.
    (async () => {
      isRestoringRef.current = true;
      try {
        // First try to restore from serialized state (preserves cursor position)
        const serializedState = await invoke('terminal:getSerializedState', terminalId);

        if (serializedState && typeof serializedState === 'object' && serializedState.content) {
          if (isCleanedUp) return;

          // Write serialized state content to restore terminal output
          // NOTE: SerializeAddon output already includes cursor positioning via ANSI sequences
          terminal.write(serializedState.content);
          console.debug('[XTermWrapper] Restored from serialized state with cursor position');
        } else {
          // Fallback to line buffer if no serialized state available
          const buffer = await invoke('terminal:getBuffer', terminalId);
          if (isCleanedUp) return;

          if (buffer && buffer.length > 0) {
            // Write each buffered line to restore previous output
            for (const line of buffer) {
              terminal.write(line);
            }
            console.debug('[XTermWrapper] Restored from line buffer (fallback)');
          }
        }
      } catch (error) {
        console.error('[XTermWrapper] Failed to restore terminal buffer:', error);
      } finally {
        isRestoringRef.current = false;

        // NOW register the output handler after restoration is complete
        // This prevents PTY data from interleaving with restoration
        if (!isCleanedUp) {
          disposeOutput = window.electron.on(outputChannel, handleOutput);
          outputHandlerRegistered = true;
        }
      }

      if (isCleanedUp) return;

      // Focus terminal AFTER buffer restoration is complete
      terminal.focus();

      // Small delay to ensure DOM is fully ready, then re-focus
      setTimeout(() => {
        if (!isCleanedUp && terminalRef.current) {
          terminalRef.current.focus();
        }
      }, 50);
    })();

    // ============================================================================
    // Cleanup
    // ============================================================================

    return () => {
      // Mark as cleaned up to prevent operations after unmount
      isCleanedUp = true;

      // Clear resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Unsubscribe from IPC events (using disposer pattern)
      if (outputHandlerRegistered && disposeOutput) {
        disposeOutput();
      }
      disposeExit();

      // Disconnect resize observer
      resizeObserver.disconnect();

      // Dispose input subscription
      inputDisposable.dispose();

      // Dispose terminal
      terminal.dispose();

      // Clear refs
      terminalRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
    };
  }, [terminalId, handleInput, handleResize, onExit]);

  // ============================================================================
  // Visibility-Based Focus and Cursor Sync
  // ============================================================================
  // When navigating back to the terminals view (isVisible changes from false to true),
  // we need to restore focus and ensure the display is properly rendered.
  // NOTE: With visibility:hidden (instead of display:none), terminal dimensions are
  // preserved, so we no longer need to refit or resize. This prevents buffer reflow
  // and content loss.
  useEffect(() => {
    const wasVisible = prevIsVisibleRef.current;
    prevIsVisibleRef.current = isVisible;

    // Only act when transitioning from hidden to visible
    if (!wasVisible && isVisible && terminalRef.current && fitAddonRef.current) {
      // Use requestAnimationFrame to ensure browser has completed the visibility change
      requestAnimationFrame(() => {
        const terminal = terminalRef.current;
        const fitAddon = fitAddonRef.current;

        if (!terminal || !fitAddon) return;

        // With visibility:hidden, dimensions are preserved - check if they're still valid
        const { cols, rows } = terminal;

        // Only call fit() if dimensions somehow became invalid (shouldn't happen with visibility:hidden)
        if (cols < 20 || rows < 10) {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols >= 20 && dims.rows >= 10) {
            fitAddon.fit();
            // Send resize to backend if dimensions changed
            const newCols = terminal.cols;
            const newRows = terminal.rows;
            if (newCols !== cols || newRows !== rows) {
              window.electron.invoke('terminal:resize', {
                id: terminalId,
                cols: newCols,
                rows: newRows,
              }).catch((error) => {
                console.error('[XTermWrapper] Failed to send resize to backend:', error);
              });
            }
          }
        }

        // Clear texture atlas to fix any WebGL rendering artifacts from visibility change
        terminal.clearTextureAtlas();

        // Verify cursor is visible in viewport
        const buffer = terminal.buffer.active;
        const cursorAbsoluteY = buffer.baseY + buffer.cursorY;
        const viewportTop = buffer.viewportY;
        const viewportBottom = viewportTop + terminal.rows;

        // If cursor is not in viewport, scroll to make it visible
        if (cursorAbsoluteY < viewportTop || cursorAbsoluteY >= viewportBottom) {
          terminal.scrollToLine(Math.max(0, cursorAbsoluteY - terminal.rows + 1));
        }

        // Force full refresh of all rows to sync cursor rendering layer
        terminal.refresh(0, terminal.rows - 1);

        // Focus the terminal for keyboard input
        terminal.focus();

        // Force PTY to send SIGWINCH to redraw full TUI applications like Claude Code
        window.electron.invoke('terminal:forceRedraw', terminalId).then((result) => {
          console.log('[XTermWrapper] forceRedraw result:', result);
        }).catch((err) => {
          console.error('[XTermWrapper] forceRedraw error:', err);
        });
      });
    }
  }, [isVisible, terminalId]);

  // ============================================================================
  // Save Serialized State on Hide
  // ============================================================================
  // Save serialized terminal state when becoming hidden (navigating away)
  // This preserves cursor position for proper restoration later
  // NOTE: Uses a separate ref (prevVisibleForSaveRef) to avoid race condition
  // with the visibility effect which also tracks visibility transitions
  useEffect(() => {
    const wasVisible = prevVisibleForSaveRef.current;
    prevVisibleForSaveRef.current = isVisible;

    // When transitioning from visible to hidden, save the serialized state
    if (wasVisible && !isVisible && terminalRef.current && serializeAddonRef.current) {
      try {
        const serializedState = serializeAddonRef.current.serialize();

        // Read cursor position from terminal buffer
        const cursorX = terminalRef.current.buffer.active.cursorX;
        const cursorY = terminalRef.current.buffer.active.cursorY;

        // Only save if we have actual content to save
        // If serialized state is empty (possibly due to alternate buffer), don't overwrite existing backup
        if (serializedState && serializedState.length > 0) {
          window.electron.invoke('terminal:saveSerializedState', {
            id: terminalId,
            state: serializedState,
            cursorX,
            cursorY,
          }).catch((error) => {
            console.error('[XTermWrapper] Failed to save serialized state:', error);
          });
        } else {
          console.debug('[XTermWrapper] Skipping save - serialized state is empty (terminal may be in alternate buffer mode)');
        }
      } catch (error) {
        console.error('[XTermWrapper] Failed to serialize terminal:', error);
      }
    }
  }, [isVisible, terminalId]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className}`}
      style={{
        padding: '8px',
        backgroundColor: TERMINAL_THEME.background,
      }}
    />
  );
}
