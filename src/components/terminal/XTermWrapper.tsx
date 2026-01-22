/**
 * XTerm Terminal Wrapper Component
 *
 * React wrapper for xterm.js terminal emulator with node-pty integration.
 * Handles terminal lifecycle, IPC communication, and addon management.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import type { AllEventChannels } from '@/types/ipc';
import '@xterm/xterm/css/xterm.css';

// ============================================================================
// Types
// ============================================================================

export interface XTermWrapperProps {
  terminalId: string;
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
  onResize,
  onExit,
  className = '',
}: XTermWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        // Fit terminal to container
        fitAddonRef.current.fit();

        const { cols, rows } = terminalRef.current;

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

    // Create terminal instance
    const terminal = new Terminal(TERMINAL_OPTIONS);

    // Create and load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);

    // Activate Unicode 11 support
    terminal.unicode.activeVersion = '11';

    // Open terminal in container
    terminal.open(containerRef.current);

    // Initial fit
    fitAddon.fit();

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Subscribe to terminal input
    const inputDisposable = terminal.onData(handleInput);

    // ============================================================================
    // IPC Event Handlers
    // ============================================================================

    // Handle output from main process
    const handleOutput = (...args: unknown[]) => {
      const data = args[0] as string;
      terminal.write(data);
    };

    // Handle terminal exit
    const handleTerminalExit = (...args: unknown[]) => {
      const exitCode = args[0] as number;
      const color = exitCode === 0 ? '\x1b[32m' : '\x1b[31m'; // Green or red
      terminal.writeln(
        `\r\n${color}Process exited with code ${exitCode}\x1b[0m`
      );

      // Call optional exit callback
      onExit?.(exitCode);
    };

    // Subscribe to IPC events (using disposer pattern)
    const outputChannel = `terminal:output:${terminalId}` as AllEventChannels;
    const exitChannel = `terminal:exit:${terminalId}` as AllEventChannels;
    const disposeOutput = window.electron.on(outputChannel, handleOutput);
    const disposeExit = window.electron.on(exitChannel, handleTerminalExit);

    // ============================================================================
    // Resize Observer
    // ============================================================================

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Focus terminal on mount
    terminal.focus();

    // ============================================================================
    // Cleanup
    // ============================================================================

    return () => {
      // Clear resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Unsubscribe from IPC events (using disposer pattern)
      disposeOutput();
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
    };
  }, [terminalId, handleInput, handleResize, onExit]);

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
