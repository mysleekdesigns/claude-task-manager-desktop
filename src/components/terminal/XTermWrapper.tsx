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
    // DEBUG: Track total bytes written for diagnosis
    let totalBytesWritten = 0;
    const handleOutput = (...args: unknown[]) => {
      if (isCleanedUp) return;
      if (isRestoringRef.current) return; // Skip during restoration
      const data = args[0] as string;

      // DEBUG: Log first chunks to see ANSI sequences (only log early data to avoid flooding)
      if (totalBytesWritten < 5000) {
        console.log('[XTermWrapper OUTPUT] chunk length:', data.length);
        // Log hex codes of first 50 bytes to see ANSI sequences
        const hexCodes = Array.from(data.slice(0, 50)).map(c => {
          const code = c.charCodeAt(0);
          if (code === 27) return 'ESC';
          if (code === 13) return 'CR';
          if (code === 10) return 'LF';
          if (code < 32) return `\\x${code.toString(16).padStart(2, '0')}`;
          return c;
        }).join('');
        console.log('[XTermWrapper OUTPUT] first 50 bytes:', hexCodes);

        // Check for alternate screen buffer sequences
        if (data.includes('\x1b[?1049h')) {
          console.log('[XTermWrapper OUTPUT] *** ENTERING ALTERNATE BUFFER ***');
        }
        if (data.includes('\x1b[?1049l')) {
          console.log('[XTermWrapper OUTPUT] *** EXITING ALTERNATE BUFFER ***');
        }
        // Also check for other common alternate buffer sequences
        if (data.includes('\x1b[?47h')) {
          console.log('[XTermWrapper OUTPUT] *** ENTERING ALTERNATE BUFFER (47h) ***');
        }
        if (data.includes('\x1b[?47l')) {
          console.log('[XTermWrapper OUTPUT] *** EXITING ALTERNATE BUFFER (47l) ***');
        }
        // Check for cursor save/restore that often accompany alternate buffer
        if (data.includes('\x1b7') || data.includes('\x1b[s')) {
          console.log('[XTermWrapper OUTPUT] *** CURSOR SAVE ***');
        }
        if (data.includes('\x1b8') || data.includes('\x1b[u')) {
          console.log('[XTermWrapper OUTPUT] *** CURSOR RESTORE ***');
        }
        // Check for screen clearing
        if (data.includes('\x1b[2J')) {
          console.log('[XTermWrapper OUTPUT] *** CLEAR SCREEN ***');
        }
        if (data.includes('\x1b[H')) {
          console.log('[XTermWrapper OUTPUT] *** CURSOR HOME ***');
        }
      }

      totalBytesWritten += data.length;
      terminal.write(data);

      // DEBUG: Check buffer state IMMEDIATELY after writing data
      if (totalBytesWritten < 5000) {
        const activeType = terminal.buffer.active.type;
        const line0 = terminal.buffer.active.getLine(0);
        const line0Text = line0?.translateToString(true) || '';
        console.log('[XTermWrapper OUTPUT] after write - buffer type:', activeType,
                    'line0 length:', line0Text.length,
                    'line0 preview:', line0Text.substring(0, 30));
        console.log('[XTermWrapper OUTPUT] totalBytesWritten=' + totalBytesWritten + ', buffer.length=' + terminal.buffer.active.length);
      }
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

        // DEBUG: Log what we got from backend
        console.log('[XTermWrapper RESTORE] got serializedState=', JSON.stringify(serializedState));

        if (serializedState && typeof serializedState === 'object' && serializedState.content) {
          if (isCleanedUp) return;

          // DEBUG: Log content details
          console.log('[XTermWrapper RESTORE] content length=' + serializedState.content.length);
          console.log('[XTermWrapper RESTORE] cursor position from state: row=' + serializedState.cursorY + ', col=' + serializedState.cursorX);

          // Write serialized state content to restore terminal output
          // NOTE: SerializeAddon output already includes cursor positioning via ANSI sequences
          // Do NOT add additional cursor positioning here - it would override SerializeAddon's correct position
          terminal.write(serializedState.content);
          console.log('[XTermWrapper RESTORE] wrote serialized content (includes cursor position from SerializeAddon)');

          // DEBUG: Log cursor position after writing content
          console.log('[XTermWrapper RESTORE] after writing content, cursor x=' + terminal.buffer.active.cursorX + ', y=' + terminal.buffer.active.cursorY);

          // DO NOT clear the serialized state - keep it as backup for future navigations
          // The state will be overwritten on next save anyway
          // await invoke('terminal:clearSerializedState', terminalId);  // REMOVED - keep as backup

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
            // DO NOT clear the backend buffer - keep it as fallback for future navigations
            // The buffer continues to accumulate new output anyway
            // await invoke('terminal:clearOutputBuffer', terminalId);  // REMOVED - keep as fallback

            console.debug('[XTermWrapper] Restored from line buffer (fallback)');
          } else {
            // Both serialized state and line buffer are empty
            // Don't write anything - the terminal might still have content from keep-alive
            console.log('[XTermWrapper RESTORE] Both serialized state and line buffer empty - not overwriting terminal');
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
      // DEBUG: Log visibility becoming true
      console.log('[XTermWrapper VISIBILITY] becoming visible, current cursor x=' + terminalRef.current.buffer.active.cursorX + ', y=' + terminalRef.current.buffer.active.cursorY);

      // Use requestAnimationFrame to ensure browser has completed the visibility change
      requestAnimationFrame(() => {
        const terminal = terminalRef.current;
        const fitAddon = fitAddonRef.current;

        if (!terminal || !fitAddon) return;

        // DEBUG: Log cursor position inside animation frame
        console.log('[XTermWrapper VISIBILITY] inside rAF, cursor x=' + terminal.buffer.active.cursorX + ', y=' + terminal.buffer.active.cursorY);

        // With visibility:hidden, dimensions are preserved - check if they're still valid
        const { cols, rows } = terminal;
        console.log('[XTermWrapper VISIBILITY] current dimensions: cols=' + cols + ', rows=' + rows);

        // Only call fit() if dimensions somehow became invalid (shouldn't happen with visibility:hidden)
        if (cols < 20 || rows < 10) {
          console.log('[XTermWrapper VISIBILITY] Dimensions invalid, attempting fit...');
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

        console.log('[XTermWrapper VISIBILITY] cursor absolute Y=' + cursorAbsoluteY + ', viewport=' + viewportTop + '-' + viewportBottom);

        // If cursor is not in viewport, scroll to make it visible
        if (cursorAbsoluteY < viewportTop || cursorAbsoluteY >= viewportBottom) {
          console.log('[XTermWrapper VISIBILITY] cursor not in viewport, scrolling to cursor');
          terminal.scrollToLine(Math.max(0, cursorAbsoluteY - terminal.rows + 1));
        }

        // Force full refresh of all rows to sync cursor rendering layer
        terminal.refresh(0, terminal.rows - 1);

        // DEBUG: Log cursor after refresh
        console.log('[XTermWrapper VISIBILITY] after refresh, cursor x=' + terminal.buffer.active.cursorX + ', y=' + terminal.buffer.active.cursorY);

        // Focus the terminal for keyboard input
        terminal.focus();

        // DEBUG: Log cursor after focus
        console.log('[XTermWrapper VISIBILITY] after focus, cursor x=' + terminal.buffer.active.cursorX + ', y=' + terminal.buffer.active.cursorY);

        // Force PTY to send SIGWINCH to redraw full TUI applications like Claude Code
        window.electron.invoke('terminal:forceRedraw', terminalId).then((result) => {
          console.log('[XTermWrapper VISIBILITY] forceRedraw result:', result);
        }).catch((err) => {
          console.error('[XTermWrapper VISIBILITY] forceRedraw error:', err);
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
    prevVisibleForSaveRef.current = isVisible; // Update at the START, before the condition check

    // DEBUG: Log visibility transition
    console.log('[XTermWrapper SAVE] wasVisible=' + wasVisible + ', isVisible=' + isVisible);

    // When transitioning from visible to hidden, save the serialized state
    if (wasVisible && !isVisible && terminalRef.current && serializeAddonRef.current) {
      try {
        // DEBUG: Check serializeAddonRef is valid
        console.log('[XTermWrapper SAVE] serializeAddonRef.current defined:', !!serializeAddonRef.current);
        console.log('[XTermWrapper SAVE] serializeAddonRef.current.serialize is function:', typeof serializeAddonRef.current.serialize === 'function');

        // DEBUG: Check buffer type - Claude Code likely uses alternate buffer
        console.log('[XTermWrapper SAVE] buffer type:', terminalRef.current.buffer.active.type);
        console.log('[XTermWrapper SAVE] is alternate buffer:', terminalRef.current.buffer.active.type === 'alternate');

        // DEBUG: Check BOTH normal and alternate buffers explicitly
        const normalBuffer = terminalRef.current.buffer.normal;
        const alternateBuffer = terminalRef.current.buffer.alternate;
        console.log('[XTermWrapper SAVE] normal buffer length:', normalBuffer.length);
        console.log('[XTermWrapper SAVE] alternate buffer length:', alternateBuffer.length);

        // DEBUG: Check first 10 lines of NORMAL buffer for non-empty content
        console.log('[XTermWrapper SAVE] === NORMAL BUFFER CONTENTS ===');
        for (let i = 0; i < Math.min(10, normalBuffer.length); i++) {
          const line = normalBuffer.getLine(i);
          const text = line?.translateToString(true) || '';
          if (text.trim()) {
            console.log('[XTermWrapper SAVE] normal buffer line ' + i + ': "' + text.substring(0, 100) + '"' + (text.length > 100 ? '...' : ''));
          }
        }

        // DEBUG: Check first 10 lines of ALTERNATE buffer for non-empty content
        console.log('[XTermWrapper SAVE] === ALTERNATE BUFFER CONTENTS ===');
        for (let i = 0; i < Math.min(10, alternateBuffer.length); i++) {
          const line = alternateBuffer.getLine(i);
          const text = line?.translateToString(true) || '';
          if (text.trim()) {
            console.log('[XTermWrapper SAVE] alternate buffer line ' + i + ': "' + text.substring(0, 100) + '"' + (text.length > 100 ? '...' : ''));
          }
        }

        // DEBUG: Check terminal buffer state BEFORE serialization (using active buffer)
        const buffer = terminalRef.current.buffer.active;
        console.log('[XTermWrapper SAVE] BEFORE serialize (ACTIVE BUFFER):');
        console.log('[XTermWrapper SAVE]   buffer.length (total lines):', buffer.length);
        console.log('[XTermWrapper SAVE]   buffer.baseY (scrollback offset):', buffer.baseY);
        console.log('[XTermWrapper SAVE]   buffer.cursorX:', buffer.cursorX);
        console.log('[XTermWrapper SAVE]   buffer.cursorY:', buffer.cursorY);
        console.log('[XTermWrapper SAVE]   terminal.cols:', terminalRef.current.cols);
        console.log('[XTermWrapper SAVE]   terminal.rows:', terminalRef.current.rows);

        // DEBUG: Check first 20 lines of ACTIVE buffer content (more lines than before)
        const lineCount = Math.min(20, buffer.length);
        let foundNonEmptyLine = false;
        console.log('[XTermWrapper SAVE]   checking first ' + lineCount + ' lines of active buffer:');
        for (let i = 0; i < lineCount; i++) {
          const line = buffer.getLine(i);
          if (line) {
            const lineText = line.translateToString(true);
            if (lineText.trim()) {
              foundNonEmptyLine = true;
              console.log('[XTermWrapper SAVE]     line ' + i + ': "' + lineText.substring(0, 80) + '"' + (lineText.length > 80 ? '...' : ''));
            }
          }
        }
        if (!foundNonEmptyLine) {
          console.log('[XTermWrapper SAVE]     (all ' + lineCount + ' lines are empty strings)');
        }

        // DEBUG: Check RAW CELL DATA for line 0 to see if there's content that's not being translated
        const line0 = terminalRef.current.buffer.active.getLine(0);
        if (line0) {
          console.log('[XTermWrapper SAVE] === RAW CELL DATA FOR LINE 0 ===');
          console.log('[XTermWrapper SAVE] line 0 cell count (length):', line0.length);
          let nonEmptyCells = 0;
          for (let j = 0; j < Math.min(20, line0.length); j++) {
            const cell = line0.getCell(j);
            if (cell) {
              const char = cell.getChars();
              const code = cell.getCode();
              if (code !== 0 && code !== 32) {  // Not null or space
                nonEmptyCells++;
                console.log('[XTermWrapper SAVE] cell ' + j + ': char="' + char + '", code=' + code + ', width=' + cell.getWidth());
              }
            }
          }
          if (nonEmptyCells === 0) {
            console.log('[XTermWrapper SAVE] (first 20 cells are all null/space - code 0 or 32)');
          }
        }

        // DEBUG: Also check line 0 of ALTERNATE buffer's raw cells if we're not in alternate mode
        if (terminalRef.current.buffer.active.type !== 'alternate') {
          const altLine0 = alternateBuffer.getLine(0);
          if (altLine0) {
            console.log('[XTermWrapper SAVE] === RAW CELL DATA FOR ALTERNATE BUFFER LINE 0 ===');
            console.log('[XTermWrapper SAVE] alternate line 0 cell count:', altLine0.length);
            let altNonEmptyCells = 0;
            for (let j = 0; j < Math.min(20, altLine0.length); j++) {
              const cell = altLine0.getCell(j);
              if (cell) {
                const char = cell.getChars();
                const code = cell.getCode();
                if (code !== 0 && code !== 32) {
                  altNonEmptyCells++;
                  console.log('[XTermWrapper SAVE] alt cell ' + j + ': char="' + char + '", code=' + code);
                }
              }
            }
            if (altNonEmptyCells === 0) {
              console.log('[XTermWrapper SAVE] (alternate buffer line 0: first 20 cells are all null/space)');
            }
          }
        }

        const serializedState = serializeAddonRef.current.serialize();

        // Read cursor position from terminal buffer
        const cursorX = terminalRef.current.buffer.active.cursorX;
        const cursorY = terminalRef.current.buffer.active.cursorY;

        // DEBUG: Log what we're saving
        console.log('[XTermWrapper SAVE] AFTER serialize:');
        console.log('[XTermWrapper SAVE]   cursorX=' + cursorX + ', cursorY=' + cursorY);
        console.log('[XTermWrapper SAVE]   serializedState length=' + serializedState.length);
        console.log('[XTermWrapper SAVE]   serializedState first 500 chars:', serializedState.substring(0, 500));
        console.log('[XTermWrapper SAVE]   serializedState is empty:', serializedState === '');

        // CRITICAL: Only save if we have actual content to save
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
          console.log('[XTermWrapper SAVE] Skipping save - serialized state is empty (terminal may be in alternate buffer mode)');
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
