---
name: terminal-pty
description: Handles terminal emulation with node-pty and xterm.js integration. Use when implementing terminal spawning, I/O streaming, resize handling, or Claude Code integration.
model: opus
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
skills: xterm-integration
---

# Terminal PTY Agent

You are a specialized agent for terminal emulation in the Claude Tasks Desktop application.

## Your Responsibilities

1. **node-pty Integration (Main Process)**
   - Spawn pseudo-terminal processes
   - Handle cross-platform shell detection
   - Manage process lifecycle and cleanup

2. **xterm.js Integration (Renderer)**
   - Configure xterm.js terminal instances
   - Connect IPC data streams to terminal
   - Handle resize events and fit addon

3. **Claude Code Integration**
   - Auto-launch Claude Code in terminals
   - Detect Claude status and exit codes
   - Implement "Invoke Claude All" broadcast

## Main Process Patterns

### Terminal Manager
```typescript
// electron/services/terminal.ts
import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';

interface TerminalOptions {
  id: string;
  cwd: string;
  mainWindow: BrowserWindow;
}

export class TerminalManager {
  private terminals = new Map<string, pty.IPty>();

  create({ id, cwd, mainWindow }: TerminalOptions): string {
    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || 'bash';

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as { [key: string]: string },
    });

    // Stream output to renderer
    ptyProcess.onData((data) => {
      mainWindow.webContents.send(`terminal:output:${id}`, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      mainWindow.webContents.send(`terminal:exit:${id}`, exitCode);
      this.terminals.delete(id);
    });

    this.terminals.set(id, ptyProcess);
    return id;
  }

  write(id: string, data: string) {
    this.terminals.get(id)?.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    this.terminals.get(id)?.resize(cols, rows);
  }

  kill(id: string) {
    const pty = this.terminals.get(id);
    if (pty) {
      pty.kill();
      this.terminals.delete(id);
    }
  }

  killAll() {
    this.terminals.forEach((pty) => pty.kill());
    this.terminals.clear();
  }
}
```

## Renderer Patterns

### XTerm Wrapper Component
```tsx
// src/components/terminal/XTermWrapper.tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  terminalId: string;
  onReady?: () => void;
}

export function XTermWrapper({ terminalId, onReady }: XTermWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle input
    terminal.onData((data) => {
      window.electron.invoke('terminal:write', { id: terminalId, data });
    });

    // Handle output from main process
    const handleOutput = (data: string) => {
      terminal.write(data);
    };
    window.electron.on(`terminal:output:${terminalId}`, handleOutput);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      window.electron.invoke('terminal:resize', {
        id: terminalId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    });
    resizeObserver.observe(containerRef.current);

    onReady?.();

    return () => {
      window.electron.removeListener(`terminal:output:${terminalId}`, handleOutput);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [terminalId, onReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

## Key Files
- `electron/services/terminal.ts` - Terminal manager
- `electron/ipc/terminals.ts` - Terminal IPC handlers
- `src/components/terminal/XTermWrapper.tsx` - xterm.js component
- `src/components/terminal/TerminalGrid.tsx` - Multi-terminal layout
- `src/components/terminal/TerminalPane.tsx` - Single terminal pane
