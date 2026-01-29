/**
 * Terminal Grid Component
 *
 * @deprecated This component is no longer used. The terminals page now uses
 * a tabbed interface instead of a grid layout. Kept for backwards compatibility.
 *
 * Grid layout for displaying multiple terminal panes.
 * Supports 1-12 terminals with automatic grid adjustment.
 */

import { TerminalPane } from './TerminalPane';

// ============================================================================
// Types
// ============================================================================

export interface TerminalGridProps {
  projectId: string;
  terminals: {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'exited';
  }[];
  onTerminalClose: (id: string) => void;
  children?: React.ReactNode; // Optional custom content per terminal
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate grid columns based on terminal count
 * 1 terminal: 1 column
 * 2 terminals: 2 columns
 * 3-4 terminals: 2 columns
 * 5-6 terminals: 3 columns
 * 7-9 terminals: 3 columns
 * 10-12 terminals: 4 columns
 */
function getGridColumns(count: number): string {
  if (count === 0) return 'grid-cols-1';
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-3';
  if (count <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

/**
 * Calculate grid rows based on terminal count
 */
function getGridRows(count: number): string {
  if (count === 0) return 'grid-rows-1';
  if (count === 1) return 'grid-rows-1';
  if (count === 2) return 'grid-rows-1';
  if (count <= 4) return 'grid-rows-2';
  if (count <= 6) return 'grid-rows-2';
  if (count <= 9) return 'grid-rows-3';
  return 'grid-rows-3';
}

// ============================================================================
// Component
// ============================================================================

/**
 * @deprecated Use the tabbed interface in TerminalsPage instead
 */
export function TerminalGrid({
  projectId,
  terminals,
  onTerminalClose,
}: TerminalGridProps) {
  // Empty state
  if (terminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-20">&#x2328;</div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-muted-foreground">
              No Terminals Open
            </h3>
            <p className="text-sm text-muted-foreground">
              Click &quot;New Terminal&quot; to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Grid layout for multiple terminals
  const gridCols = getGridColumns(terminals.length);
  const gridRows = getGridRows(terminals.length);

  return (
    <div
      className={`grid ${gridCols} ${gridRows} gap-4 p-4 h-full w-full transition-all duration-300`}
    >
      {terminals.map((terminal) => (
        <div key={terminal.id} className="min-h-0">
          <TerminalPane
            terminal={terminal}
            projectId={projectId}
            onClose={onTerminalClose}
          />
        </div>
      ))}
    </div>
  );
}
