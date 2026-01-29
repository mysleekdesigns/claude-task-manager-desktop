/**
 * Terminal Components Example
 *
 * @deprecated This example uses the old grid layout. The main TerminalsPage
 * now uses a tabbed interface instead.
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

/**
 * @deprecated Use TerminalsPage with tabbed interface instead
 */
export function TerminalExample() {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: '1', name: 'Terminal 1', status: 'running' },
    { id: '2', name: 'Terminal 2', status: 'idle' },
    { id: '3', name: 'Terminal 3', status: 'running' },
  ]);

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
          projectId="example-project-id"
          terminals={terminals}
          onTerminalClose={handleTerminalClose}
        />
      </div>
    </div>
  );
}
