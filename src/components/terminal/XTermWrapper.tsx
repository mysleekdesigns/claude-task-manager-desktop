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
 * - DEC Mode 2026 (Synchronized Output) support for flicker-free rendering
 *
 * DEC Mode 2026 (Synchronized Output):
 * ------------------------------------
 * This mode prevents screen tearing/flickering when TUI applications (like Claude Code
 * which uses Ink/React for CLI) re-render their entire screen buffer on every streaming
 * chunk. When an application sends:
 *   - CSI ?2026h (Begin Synchronized Update) - xterm.js buffers all screen updates
 *   - CSI ?2026l (End Synchronized Update) - xterm.js flushes and renders atomically
 *
 * xterm.js 6.0.0+ has native support for this mode. The feature is enabled automatically
 * and requires no configuration. The terminal.modes.synchronizedOutputMode property
 * reflects the current state.
 *
 * If flickering persists, enable DEBUG_SYNC_MODE below to diagnose whether the
 * application is sending the sync sequences correctly.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { invoke } from '@/lib/ipc';
import type { AllEventChannels } from '@/types/ipc';
import { GRID_TRANSITION_DURATION_MS } from '@/routes/terminals';
import '@xterm/xterm/css/xterm.css';

// ============================================================================
// DEC Mode 2026 Debug Configuration
// ============================================================================

/**
 * Enable debug logging for DEC Mode 2026 (Synchronized Output).
 *
 * When enabled, logs messages when:
 * - Synchronized output mode is activated (CSI ?2026h received)
 * - Synchronized output mode is deactivated (CSI ?2026l received)
 * - The automatic 1-second safety timeout triggers
 *
 * Use this to diagnose flickering issues with Claude Code or other TUI applications.
 * Set to true if terminal flickering persists despite xterm.js 6.0.0+ support.
 */
const DEBUG_SYNC_MODE = false;

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
  const resizeRAFRef = useRef<number | null>(null);
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

  /**
   * Handle terminal resize with CSS transition awareness and RAF-based execution.
   *
   * The terminal grid uses CSS transitions (duration: GRID_TRANSITION_DURATION_MS)
   * for smooth layout changes. If we call fitAddon.fit() during a transition,
   * ResizeObserver fires at intermediate states causing incorrect dimensions.
   *
   * Resize Pattern (debounce + requestAnimationFrame):
   * -------------------------------------------------
   * We use a two-stage approach recommended by xterm.js documentation:
   * 1. setTimeout debounce: Waits for resize events to settle (CSS transitions complete)
   * 2. requestAnimationFrame: Syncs the actual fit() call with browser's render cycle
   *
   * This pattern prevents SIGWINCH flooding to TUI applications (like Claude Code)
   * which can cause rendering issues if resize signals arrive too rapidly. The RAF
   * ensures smooth visual updates by aligning terminal rendering with display refresh.
   *
   * The debounce delay is set to GRID_TRANSITION_DURATION_MS + 50ms buffer.
   */
  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current) return;

    // Clear any pending debounce timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }

    // Clear any pending animation frame
    if (resizeRAFRef.current) {
      cancelAnimationFrame(resizeRAFRef.current);
      resizeRAFRef.current = null;
    }

    // Wait for CSS transition to complete before fitting
    const resizeDelay = GRID_TRANSITION_DURATION_MS + 50; // Add 50ms buffer

    // Stage 1: Debounce - wait for resize events to settle
    resizeTimeoutRef.current = setTimeout(() => {
      // Stage 2: RAF - sync fit operation with browser's render cycle
      resizeRAFRef.current = requestAnimationFrame(() => {
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
      });
    }, resizeDelay);
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

    // ============================================================================
    // DEC Mode 2026 (Synchronized Output) Monitoring
    // ============================================================================
    // xterm.js 6.0.0+ natively supports DEC Mode 2026 for flicker-free rendering.
    // When applications send CSI ?2026h, rendering is buffered until CSI ?2026l.
    // This prevents screen tearing when Claude Code (using Ink) re-renders on each chunk.
    //
    // The mode state is available via terminal.modes.synchronizedOutputMode
    // A 1-second safety timeout automatically flushes if ESU isn't received.
    let syncModeDebugInterval: NodeJS.Timeout | null = null;
    let lastSyncModeState = false;

    if (DEBUG_SYNC_MODE) {
      // Poll the sync mode state periodically for debug logging
      // Note: xterm.js doesn't expose a mode change event, so we poll
      syncModeDebugInterval = setInterval(() => {
        if (isCleanedUp || !terminal) return;

        const currentSyncMode = terminal.modes.synchronizedOutputMode;
        if (currentSyncMode !== lastSyncModeState) {
          if (currentSyncMode) {
            console.log(`[XTermWrapper:${terminalId}] DEC Mode 2026: Synchronized output ACTIVATED - buffering updates`);
          } else {
            console.log(`[XTermWrapper:${terminalId}] DEC Mode 2026: Synchronized output DEACTIVATED - rendering flushed`);
          }
          lastSyncModeState = currentSyncMode;
        }
      }, 50); // Poll every 50ms when debugging
    }

    // Track whether initial resize was sent to avoid duplicate resize from ResizeObserver
    // Use an object so we can update the property asynchronously
    const initialResizeRef = { sent: false };

    // Initial fit with dimension validation to prevent corrupt 10x5 resize
    // IMPORTANT: We need to send the correct dimensions to the PTY immediately after
    // the terminal opens. The PTY spawns with default 80x24, and if we don't send
    // an immediate resize, CLI applications may render incorrectly.
    const initialDims = fitAddon.proposeDimensions();

    if (initialDims && initialDims.cols >= 20 && initialDims.rows >= 10) {
      fitAddon.fit();

      // Send immediate resize to PTY with the correct dimensions
      // This is critical to ensure the PTY has correct dimensions from the start,
      // rather than waiting for the debounced ResizeObserver callback.
      const cols = terminal.cols;
      const rows = terminal.rows;

      if (cols >= 20 && rows >= 10) {
        console.log(`[XTermWrapper] Sending immediate initial resize: ${cols}x${rows}`);
        // Mark as sent immediately (optimistically) to prevent race with async IIFE
        initialResizeRef.sent = true;

        window.electron
          .invoke('terminal:resize', {
            id: terminalId,
            cols,
            rows,
          })
          .then(() => {
            console.log(`[XTermWrapper] Initial resize sent successfully: ${cols}x${rows}`);
          })
          .catch((error) => {
            console.error('[XTermWrapper] Failed to send initial resize:', error);
            // On error, allow deferred resize to try again
            initialResizeRef.sent = false;
          });

        // Call optional resize callback
        onResize?.(cols, rows);
      }
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

      // ============================================================================
      // Ensure PTY has correct dimensions after restoration
      // ============================================================================
      // If the initial fit didn't happen (container had invalid dimensions),
      // we need to retry now that the DOM is fully ready. This ensures the PTY
      // gets correct dimensions even if the container wasn't ready at mount time.
      if (!initialResizeRef.sent) {
        // Wait a frame for layout to settle
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (isCleanedUp) return;

        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols >= 20 && dims.rows >= 10) {
          fitAddon.fit();
          const cols = terminal.cols;
          const rows = terminal.rows;

          if (cols >= 20 && rows >= 10) {
            console.log(`[XTermWrapper] Sending deferred initial resize: ${cols}x${rows}`);
            window.electron
              .invoke('terminal:resize', {
                id: terminalId,
                cols,
                rows,
              })
              .then(() => {
                console.log(`[XTermWrapper] Deferred resize sent successfully: ${cols}x${rows}`);
              })
              .catch((error) => {
                console.error('[XTermWrapper] Failed to send deferred resize:', error);
              });

            // Call optional resize callback
            onResize?.(cols, rows);
          }
        }
      }

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

      // Clear resize timeout and animation frame
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      if (resizeRAFRef.current) {
        cancelAnimationFrame(resizeRAFRef.current);
        resizeRAFRef.current = null;
      }

      // Clear sync mode debug interval
      if (syncModeDebugInterval) {
        clearInterval(syncModeDebugInterval);
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

  /**
   * Padding Chain Documentation:
   * ----------------------------
   * The terminal content area has multiple padding layers:
   *
   * 1. TerminalsPage grid:      padding: 1rem (16px)  - outer container
   * 2. Grid gap:                gap: 1rem (16px)      - between grid cells
   * 3. TerminalPane CardContent: p-0                  - no padding
   * 4. XTermWrapper:            padding: 8px          - inner terminal padding
   *
   * Total padding from grid edge to terminal content:
   *   16px (grid padding) + 8px (xterm padding) = 24px per side
   *
   * When calculating available terminal space, these values must be considered.
   * The minmax() constraints on the grid account for the outer padding.
   */
  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className}`}
      style={{
        padding: '8px',
        backgroundColor: TERMINAL_THEME.background,
        // Critical for flex/grid children: allow shrinking below content size
        minWidth: 0,
        minHeight: 0,
        // Ensure xterm canvas fills available space
        overflow: 'hidden',
      }}
    />
  );
}
