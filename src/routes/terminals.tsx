/**
 * Terminals Page
 *
 * Main page for managing Claude Code terminal sessions.
 * Integrates TerminalToolbar, TerminalGrid, TerminalPane, and XTermWrapper.
 */

import { useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { TerminalToolbar } from '@/components/terminal/TerminalToolbar';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { InvokeClaudeModal } from '@/components/terminal/InvokeClaudeModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { TerminalStatus } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const MAX_TERMINALS = 12;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate number of grid columns based on terminal count
 */
function getGridColumnCount(count: number): number {
  if (count === 0) return 1;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 3;
  return 4;
}

/**
 * Calculate number of grid rows based on terminal count
 */
function getGridRowCount(count: number): number {
  if (count === 0) return 1;
  if (count === 1) return 1;
  if (count === 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 3;
}

/**
 * Minimum terminal dimensions to maintain usability
 * These values ensure terminals don't shrink below readable/interactive sizes
 */
const MIN_TERMINAL_WIDTH = 300; // px - ensures ~40 columns visible
const MIN_TERMINAL_HEIGHT = 200; // px - ensures ~10 rows visible

/**
 * CSS transition duration for grid layout changes (ms)
 * XTermWrapper must wait for this duration before fitting terminal
 */
export const GRID_TRANSITION_DURATION_MS = 300;

// ============================================================================
// Types
// ============================================================================

export interface TerminalsPageProps {
  /** Whether the terminals page is currently visible (used for focus management) */
  isVisible?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function TerminalsPage({ isVisible = true }: TerminalsPageProps) {
  const currentProject = useProjectStore((state) => state.currentProject);

  // State for expanded terminal
  const [expandedTerminalId, setExpandedTerminalId] = useState<string | null>(null);

  // State for local terminal status updates
  const [terminalStatuses, setTerminalStatuses] = useState<Record<string, TerminalStatus>>({});

  // State for Claude status tracking
  const [claudeStatuses, setClaudeStatuses] = useState<Record<string, 'inactive' | 'active' | 'waiting'>>({});

  // State for Invoke Claude modal
  const [showInvokeClaudeModal, setShowInvokeClaudeModal] = useState(false);

  // Fetch terminals for the current project
  const {
    data: terminals,
    loading,
    error,
    refetch,
  } = useIPCQuery(
    'terminal:list',
    currentProject?.id ? [currentProject.id] : undefined,
    {
      enabled: !!currentProject?.id,
    }
  );

  // Terminal operations
  const createTerminalMutation = useIPCMutation('terminal:create');
  const closeTerminalMutation = useIPCMutation('terminal:close');
  const writeTerminalMutation = useIPCMutation('terminal:write');

  // Merge fetched terminals with local status updates
  const activeTerminals = (terminals ?? []).map((terminal) => ({
    ...terminal,
    status: terminalStatuses[terminal.id] ?? terminal.status,
    claudeStatus: claudeStatuses[terminal.id] ?? ('inactive' as const),
  }));

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCreateTerminal = useCallback(async () => {
    if (!currentProject) return;

    if (activeTerminals.length >= MAX_TERMINALS) {
      alert(`Maximum ${MAX_TERMINALS} terminals reached.`);
      return;
    }

    try {
      const terminalName = `Terminal ${activeTerminals.length + 1}`;

      const createInput = currentProject.targetPath
        ? {
            projectId: currentProject.id,
            name: terminalName,
            cwd: currentProject.targetPath,
          }
        : {
            projectId: currentProject.id,
            name: terminalName,
          };

      await createTerminalMutation.mutate(createInput);

      // Refetch terminal list
      await refetch();
    } catch (err) {
      console.error('Failed to create terminal:', err);
      alert('Failed to create terminal. Please try again.');
    }
  }, [currentProject, activeTerminals.length, createTerminalMutation, refetch]);

  const handleCloseTerminal = useCallback(
    async (id: string) => {
      try {
        // If the closed terminal was expanded, reset expanded state immediately
        if (expandedTerminalId === id) {
          setExpandedTerminalId(null);
        }

        // Close the terminal via IPC
        await closeTerminalMutation.mutate(id);

        // Refetch terminal list to update UI
        await refetch();
      } catch (err) {
        console.error('Failed to close terminal:', err);
        alert('Failed to close terminal. Please try again.');
      }
    },
    [closeTerminalMutation, expandedTerminalId, refetch]
  );

  const handleExpandTerminal = useCallback((id: string) => {
    setExpandedTerminalId(id);
  }, []);

  const handleCollapseExpanded = useCallback(() => {
    setExpandedTerminalId(null);
  }, []);

  const handleInvokeClaudeAll = useCallback(() => {
    setShowInvokeClaudeModal(true);
  }, []);

  const handleLaunchClaude = useCallback(
    async (terminalId: string) => {
      try {
        await writeTerminalMutation.mutate({
          id: terminalId,
          data: 'claude\n',
        });

        // Update local Claude status
        setClaudeStatuses((prev) => ({
          ...prev,
          [terminalId]: 'active',
        }));
      } catch (err) {
        console.error('Failed to launch Claude:', err);
        alert('Failed to launch Claude Code. Please try again.');
      }
    },
    [writeTerminalMutation]
  );

  const handleInvokeClaude = useCallback(
    async (terminalIds: string[], command: string) => {
      try {
        // Send command to each selected terminal
        await Promise.all(
          terminalIds.map((id) =>
            writeTerminalMutation.mutate({
              id,
              data: `${command}\n`,
            })
          )
        );
      } catch (err) {
        console.error('Failed to invoke Claude:', err);
        throw err; // Re-throw to show error in modal
      }
    },
    [writeTerminalMutation]
  );

  const handleTerminalExit = useCallback(
    (terminalId: string, exitCode: number) => {
      console.log(`Terminal ${terminalId} exited with code ${String(exitCode)}`);
      // Update local status to 'exited'
      setTerminalStatuses((prev) => ({
        ...prev,
        [terminalId]: 'exited',
      }));
    },
    []
  );

  const handleWorktreeChange = useCallback(
    async (terminalId: string, worktreeId: string | null, path: string) => {
      if (!currentProject) return;

      try {
        // Option: Send a cd command to change the terminal's working directory
        if (path) {
          await writeTerminalMutation.mutate({
            id: terminalId,
            data: `cd "${path}"\n`,
          });
        } else {
          // If path is empty (default/project root), cd to project target path
          if (currentProject.targetPath) {
            await writeTerminalMutation.mutate({
              id: terminalId,
              data: `cd "${currentProject.targetPath}"\n`,
            });
          }
        }

        // Note: In the future, we could add a terminal:update IPC handler to
        // persist the worktreeId association in the database
        console.log(`Terminal ${terminalId} changed to worktree ${worktreeId ?? 'default'}`);
      } catch (err) {
        console.error('Failed to change worktree:', err);
        alert('Failed to change worktree. Please try again.');
      }
    },
    [writeTerminalMutation, currentProject]
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Clear local status cache when terminals are refetched
  useEffect(() => {
    if (terminals) {
      setTerminalStatuses({});
    }
  }, [terminals]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTerminalGrid = () => {
    if (!currentProject) return null;

    // Empty state
    if (activeTerminals.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="text-6xl opacity-20">⌨️</div>
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

    // If a terminal is expanded, show only that terminal
    if (expandedTerminalId) {
      const expandedTerminal = activeTerminals.find((t) => t.id === expandedTerminalId);
      if (!expandedTerminal) {
        // If expanded terminal not found, reset expanded state
        handleCollapseExpanded();
        return null;
      }

      return (
        <div className="h-full w-full p-4">
          <TerminalPane
            terminal={{
              id: expandedTerminal.id,
              name: expandedTerminal.name,
              status: expandedTerminal.status,
              claudeStatus: expandedTerminal.claudeStatus,
              worktreeId: expandedTerminal.worktreeId,
            }}
            projectId={currentProject.id}
            isExpanded={true}
            onClose={(id: string) => { void handleCloseTerminal(id); }}
            onExpand={handleExpandTerminal}
            onCollapse={handleCollapseExpanded}
            onLaunchClaude={(id: string) => { void handleLaunchClaude(id); }}
            onWorktreeChange={(terminalId: string, worktreeId: string | null, path: string) => { void handleWorktreeChange(terminalId, worktreeId, path); }}
          >
            <XTermWrapper
              terminalId={expandedTerminal.id}
              isVisible={isVisible}
              onExit={(exitCode) => { handleTerminalExit(expandedTerminal.id, exitCode); }}
            />
          </TerminalPane>
        </div>
      );
    }

    // Grid layout for multiple terminals
    // Use CSS minmax() to enforce minimum terminal sizes while allowing flex growth
    const colCount = getGridColumnCount(activeTerminals.length);
    const rowCount = getGridRowCount(activeTerminals.length);

    // Generate grid template with minmax constraints
    // This ensures terminals never shrink below MIN_TERMINAL_WIDTH/HEIGHT
    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: `repeat(${colCount}, minmax(${MIN_TERMINAL_WIDTH}px, 1fr))`,
      gridTemplateRows: `repeat(${rowCount}, minmax(${MIN_TERMINAL_HEIGHT}px, 1fr))`,
      gap: '1rem', // 16px gap
      padding: '1rem', // 16px padding
      height: '100%',
      width: '100%',
      // Allow horizontal scroll if terminals can't fit at minimum size
      overflow: 'auto',
      // Smooth transition for grid layout changes
      transition: `all ${GRID_TRANSITION_DURATION_MS}ms ease-in-out`,
    };

    return (
      <div style={gridStyle}>
        {activeTerminals.map((terminal) => (
          <div
            key={terminal.id}
            className="min-h-0 min-w-0"
            style={{
              // Critical: Allow flex/grid children to shrink below content size
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <TerminalPane
              terminal={{
                id: terminal.id,
                name: terminal.name,
                status: terminal.status,
                claudeStatus: terminal.claudeStatus,
                worktreeId: terminal.worktreeId,
              }}
              projectId={currentProject.id}
              isExpanded={false}
              onClose={(id: string) => { void handleCloseTerminal(id); }}
              onExpand={handleExpandTerminal}
              onCollapse={handleCollapseExpanded}
              onLaunchClaude={(id: string) => { void handleLaunchClaude(id); }}
              onWorktreeChange={(terminalId: string, worktreeId: string | null, path: string) => { void handleWorktreeChange(terminalId, worktreeId, path); }}
            >
              <XTermWrapper
                terminalId={terminal.id}
                isVisible={isVisible}
                onExit={(exitCode) => { handleTerminalExit(terminal.id, exitCode); }}
              />
            </TerminalPane>
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Agent Terminals</h1>
          <p className="text-muted-foreground mt-2">
            Manage Claude Code terminal sessions
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to manage its terminals.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <TerminalToolbar
        terminalCount={activeTerminals.length}
        maxTerminals={MAX_TERMINALS}
        onNewTerminal={() => { void handleCreateTerminal(); }}
        onInvokeClaudeAll={handleInvokeClaudeAll}
      />

      {/* Error Alert */}
      {error && (
        <div className="px-4 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Terminal Grid */}
      <div className="flex-1 overflow-hidden">
        {loading && !activeTerminals.length ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl opacity-20">⏳</div>
              <p className="text-muted-foreground">Loading terminals...</p>
            </div>
          </div>
        ) : (
          renderTerminalGrid()
        )}
      </div>

      {/* Invoke Claude All Modal */}
      <InvokeClaudeModal
        open={showInvokeClaudeModal}
        onClose={() => { setShowInvokeClaudeModal(false); }}
        terminals={activeTerminals.map((t) => ({
          id: t.id,
          name: t.name,
          claudeStatus: t.claudeStatus,
        }))}
        onInvoke={handleInvokeClaude}
      />
    </div>
  );
}
