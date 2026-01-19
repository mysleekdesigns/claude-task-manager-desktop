---
name: xterm-integration
description: xterm.js terminal emulation in Electron renderer process. Use when implementing terminal UI, handling terminal I/O, configuring addons, or managing terminal lifecycle.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# xterm.js Terminal Integration

## Overview

xterm.js is a terminal emulator for the browser. In Electron, it runs in the renderer process and communicates with node-pty in the main process via IPC.

## Installation

```bash
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-unicode11
```

## Basic Setup

### Terminal Wrapper Component

```tsx
// src/components/terminal/XTermWrapper.tsx
import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  terminalId: string;
  onReady?: () => void;
  onExit?: (code: number) => void;
}

export function XTermWrapper({ terminalId, onReady, onExit }: XTermWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Send input to main process
  const handleInput = useCallback((data: string) => {
    window.electron.invoke('terminal:write', { id: terminalId, data });
  }, [terminalId]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current) return;

    fitAddonRef.current.fit();
    window.electron.invoke('terminal:resize', {
      id: terminalId,
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows,
    });
  }, [terminalId]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selection: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
      },
    });

    // Load addons
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new Unicode11Addon());

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle user input
    terminal.onData(handleInput);

    // Handle output from main process
    const handleOutput = (data: string) => {
      terminal.write(data);
    };
    window.electron.on(`terminal:output:${terminalId}`, handleOutput);

    // Handle exit
    const handleTerminalExit = (code: number) => {
      terminal.writeln(`\r\n\x1b[90mProcess exited with code ${code}\x1b[0m`);
      onExit?.(code);
    };
    window.electron.on(`terminal:exit:${terminalId}`, handleTerminalExit);

    // Handle container resize
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    onReady?.();

    // Cleanup
    return () => {
      window.electron.removeListener(`terminal:output:${terminalId}`, handleOutput);
      window.electron.removeListener(`terminal:exit:${terminalId}`, handleTerminalExit);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [terminalId, handleInput, handleResize, onReady, onExit]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: '8px', backgroundColor: '#1a1b26' }}
    />
  );
}
```

## Terminal Grid Layout

```tsx
// src/components/terminal/TerminalGrid.tsx
import { useState, useCallback } from 'react';
import { TerminalPane } from './TerminalPane';

interface TerminalInfo {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'exited';
}

interface TerminalGridProps {
  terminals: TerminalInfo[];
  onTerminalCreate: () => void;
  onTerminalClose: (id: string) => void;
}

export function TerminalGrid({ terminals, onTerminalCreate, onTerminalClose }: TerminalGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const gridCols = terminals.length <= 2 ? 'grid-cols-2' :
                   terminals.length <= 4 ? 'grid-cols-2' :
                   terminals.length <= 6 ? 'grid-cols-3' :
                   'grid-cols-4';

  const gridRows = terminals.length <= 2 ? 'grid-rows-1' :
                   terminals.length <= 4 ? 'grid-rows-2' :
                   'grid-rows-3';

  if (expandedId) {
    const terminal = terminals.find(t => t.id === expandedId);
    if (terminal) {
      return (
        <div className="h-full">
          <TerminalPane
            terminal={terminal}
            expanded
            onCollapse={() => setExpandedId(null)}
            onClose={() => onTerminalClose(terminal.id)}
          />
        </div>
      );
    }
  }

  return (
    <div className={`grid ${gridCols} ${gridRows} gap-2 h-full p-2`}>
      {terminals.map(terminal => (
        <TerminalPane
          key={terminal.id}
          terminal={terminal}
          onExpand={() => setExpandedId(terminal.id)}
          onClose={() => onTerminalClose(terminal.id)}
        />
      ))}
    </div>
  );
}
```

## Terminal Pane

```tsx
// src/components/terminal/TerminalPane.tsx
import { XTermWrapper } from './XTermWrapper';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface TerminalPaneProps {
  terminal: TerminalInfo;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onClose: () => void;
}

export function TerminalPane({
  terminal,
  expanded,
  onExpand,
  onCollapse,
  onClose,
}: TerminalPaneProps) {
  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              terminal.status === 'running' ? 'bg-green-500' :
              terminal.status === 'exited' ? 'bg-red-500' :
              'bg-gray-500'
            }`}
          />
          <span className="text-sm font-medium">{terminal.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {expanded ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCollapse}>
              <Minimize2 className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onExpand}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        <XTermWrapper terminalId={terminal.id} />
      </div>
    </div>
  );
}
```

## Custom Themes

```typescript
const themes = {
  tokyoNight: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selection: '#33467c',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
  },
};
```

## Key Events

```typescript
// Clear terminal
terminal.clear();

// Write with ANSI colors
terminal.write('\x1b[32mSuccess!\x1b[0m\r\n');

// Reset terminal
terminal.reset();

// Focus terminal
terminal.focus();

// Scroll to bottom
terminal.scrollToBottom();
```
