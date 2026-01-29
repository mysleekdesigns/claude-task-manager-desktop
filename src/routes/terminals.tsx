/**
 * Terminals Page
 *
 * Main page for managing Claude Code terminal sessions.
 * Uses a tabbed interface where only one terminal is visible at a time.
 * Integrates TerminalToolbar, TerminalPane, and XTermWrapper.
 */

import { useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { TerminalToolbar } from '@/components/terminal/TerminalToolbar';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { InvokeClaudeModal } from '@/components/terminal/InvokeClaudeModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import type { TerminalStatus } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const MAX_TERMINALS = 10;

/**
 * CSS transition duration for layout changes (ms)
 * XTermWrapper still uses this for resize timing
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

  // State for active terminal tab
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

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
  // Effects
  // ============================================================================

  // Ensure active terminal is valid when terminals list changes
  useEffect(() => {
    if (activeTerminals.length > 0) {
      const firstTerminal = activeTerminals[0];
      if (firstTerminal && (!activeTerminalId || !activeTerminals.find(t => t.id === activeTerminalId))) {
        setActiveTerminalId(firstTerminal.id);
      }
    } else {
      setActiveTerminalId(null);
    }
  }, [activeTerminals, activeTerminalId]);

  // Clear local status cache when terminals are refetched
  useEffect(() => {
    if (terminals) {
      setTerminalStatuses({});
    }
  }, [terminals]);

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

      const result = await createTerminalMutation.mutate(createInput);

      // Refetch terminal list
      await refetch();

      // Set the new terminal as active
      if (result?.id) {
        setActiveTerminalId(result.id);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      alert('Failed to create terminal. Please try again.');
    }
  }, [currentProject, activeTerminals.length, createTerminalMutation, refetch]);

  const handleCloseTerminal = useCallback(
    async (id: string) => {
      try {
        const currentIndex = activeTerminals.findIndex(t => t.id === id);

        // Close the terminal via IPC
        await closeTerminalMutation.mutate(id);

        // Switch to adjacent tab if closing active tab
        if (id === activeTerminalId && activeTerminals.length > 1) {
          const nextIndex = currentIndex > 0 ? currentIndex - 1 : 1;
          setActiveTerminalId(activeTerminals[nextIndex]?.id || null);
        }

        // Refetch terminal list to update UI
        await refetch();
      } catch (err) {
        console.error('Failed to close terminal:', err);
        alert('Failed to close terminal. Please try again.');
      }
    },
    [closeTerminalMutation, activeTerminalId, activeTerminals, refetch]
  );

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
  // Helper Functions
  // ============================================================================

  /**
   * Get status indicator color for terminal tab
   */
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'exited':
        return 'bg-red-500';
      case 'idle':
      default:
        return 'bg-gray-400';
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTerminalTabs = () => {
    if (!currentProject) return null;

    // Empty state
    if (activeTerminals.length === 0) {
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

    return (
      <Tabs
        value={activeTerminalId ?? ''}
        onValueChange={setActiveTerminalId}
        className="h-full grid grid-rows-[auto_1fr] gap-0"
      >
        {/* Tab List */}
        <TabsList className="mx-4 mt-2 bg-muted/80 h-auto p-1 flex-shrink-0">
          {activeTerminals.map((terminal) => (
            <TabsTrigger
              key={terminal.id}
              value={terminal.id}
              className="relative gap-2 pr-7 data-[state=active]:bg-background"
            >
              {/* Status indicator dot */}
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(terminal.status)}`}
                title={terminal.status}
              />
              {/* Terminal name */}
              <span className="truncate max-w-[120px]">{terminal.name}</span>
              {/* Close button - using span instead of button to avoid nested button error */}
              <span
                role="button"
                tabIndex={0}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void handleCloseTerminal(terminal.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    void handleCloseTerminal(terminal.id);
                  }
                }}
                title="Close terminal"
              >
                <X className="h-3 w-3" />
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content - All terminals mounted with forceMount, visibility controlled via CSS */}
        {/* IMPORTANT: Use visibility:hidden instead of display:none for inactive tabs.
            display:none causes zero dimensions which breaks xterm FitAddon on initial mount.
            visibility:hidden preserves layout dimensions while hiding the content. */}
        {/* HEIGHT FIX: Using CSS Grid with grid-rows-[auto_1fr] on parent Tabs.
            The TabsList takes auto height (row 1) and this content div is in row 2 (1fr).
            Grid children stretch to fill by default, so this div gets the full row height.
            The relative positioning allows absolutely positioned TabsContent children. */}
        <div className="relative mx-4 mb-4 mt-2 overflow-hidden">
          {activeTerminals.map((terminal) => {
            const isActive = terminal.id === activeTerminalId;
            return (
            <TabsContent
              key={terminal.id}
              value={terminal.id}
              forceMount
              className="absolute inset-0 m-0 h-full"
              style={{
                // Use visibility:hidden instead of display:none to preserve dimensions
                // This prevents xterm.js FitAddon from getting zero dimensions
                visibility: isActive ? 'visible' : 'hidden',
                // Disable pointer events when hidden to prevent accidental interactions
                pointerEvents: isActive ? 'auto' : 'none',
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
                onClose={(id: string) => { void handleCloseTerminal(id); }}
                onLaunchClaude={(id: string) => { void handleLaunchClaude(id); }}
                onWorktreeChange={(terminalId: string, worktreeId: string | null, path: string) => { void handleWorktreeChange(terminalId, worktreeId, path); }}
              >
                <XTermWrapper
                  terminalId={terminal.id}
                  isVisible={terminal.id === activeTerminalId && isVisible}
                  onExit={(exitCode) => { handleTerminalExit(terminal.id, exitCode); }}
                />
              </TerminalPane>
            </TabsContent>
            );
          })}
        </div>
      </Tabs>
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

      {/* Terminal Tabs */}
      {/* CRITICAL: Use h-0 with flex-1 for proper height in flex column layout.
          flex-1 alone can collapse to 0 when children use absolute positioning.
          h-0 + flex-1 = "start at 0 height, then grow to fill available space" */}
      <div className="flex-1 h-0 overflow-hidden">
        {loading && !activeTerminals.length ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl opacity-20">&#x23F3;</div>
              <p className="text-muted-foreground">Loading terminals...</p>
            </div>
          </div>
        ) : (
          renderTerminalTabs()
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
