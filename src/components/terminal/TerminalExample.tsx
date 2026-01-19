/**
 * Terminal Components Example
 *
 * Demo/test page showing how to use TerminalGrid and TerminalToolbar together.
 * This can be used for development and testing until the actual terminal
 * integration with XTermWrapper is ready.
 */

import { useState } from 'react';
import { TerminalGrid } from './TerminalGrid';
import { TerminalToolbar } from './TerminalToolbar';

// ============================================================================
// Types
// ============================================================================

interface Terminal {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'exited';
}

// ============================================================================
// Component
// ============================================================================

export function TerminalExample() {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: '1', name: 'Terminal 1', status: 'running' },
    { id: '2', name: 'Terminal 2', status: 'idle' },
    { id: '3', name: 'Terminal 3', status: 'running' },
  ]);
  const [expandedTerminalId, setExpandedTerminalId] = useState<string | null>(null);

  const handleNewTerminal = () => {
    const newId = (terminals.length + 1).toString();
    const newTerminal: Terminal = {
      id: newId,
      name: `Terminal ${newId}`,
      status: 'idle',
    };
    setTerminals([...terminals, newTerminal]);
  };

  const handleTerminalClose = (id: string) => {
    setTerminals(terminals.filter((t) => t.id !== id));
    if (expandedTerminalId === id) {
      setExpandedTerminalId(null);
    }
  };

  const handleTerminalExpand = (id: string) => {
    setExpandedTerminalId(id);
  };

  const handleCollapseExpanded = () => {
    setExpandedTerminalId(null);
  };

  const handleInvokeClaudeAll = () => {
    console.log('Invoking Claude Code in all terminals...');
    // TODO: Implement Claude Code invocation in all running terminals
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <TerminalToolbar
        terminalCount={terminals.length}
        maxTerminals={12}
        onNewTerminal={handleNewTerminal}
        onInvokeClaudeAll={handleInvokeClaudeAll}
      />

      {/* Terminal Grid */}
      <div className="flex-1 overflow-hidden">
        <TerminalGrid
          terminals={terminals}
          expandedTerminalId={expandedTerminalId}
          onTerminalClose={handleTerminalClose}
          onTerminalExpand={handleTerminalExpand}
          onCollapseExpanded={handleCollapseExpanded}
        />
      </div>
    </div>
  );
}
