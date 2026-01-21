/**
 * Worktrees Page
 *
 * Manage git worktrees for parallel task development.
 * Integrates WorktreeList and WorktreeCard components.
 */

import { useCallback, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { WorktreeList } from '@/components/worktrees/WorktreeList';
import { CreateWorktreeModal } from '@/components/worktrees/CreateWorktreeModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Plus, RefreshCw, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import type { DeleteWorktreeInput } from '@/types/ipc';

// ============================================================================
// Component
// ============================================================================

export function WorktreesPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // State for Create Worktree modal
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch worktrees for the current project
  const {
    data: worktrees,
    loading: worktreesLoading,
    error: worktreesError,
    refetch: refetchWorktrees,
  } = useIPCQuery(
    'worktrees:list',
    currentProject?.id ? [currentProject.id] : undefined,
    {
      enabled: !!currentProject?.id,
    }
  );

  // Worktree operations
  const deleteWorktreeMutation = useIPCMutation('worktrees:delete');
  const syncWorktreesMutation = useIPCMutation('worktrees:sync');

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleDeleteWorktree = useCallback(
    async (id: string, force: boolean) => {
      try {
        const deleteInput: DeleteWorktreeInput = {
          id,
          force,
        };

        await deleteWorktreeMutation.mutate(deleteInput);

        toast.success('Worktree deleted successfully');

        // Refetch worktrees
        await refetchWorktrees();
      } catch (err) {
        console.error('Failed to delete worktree:', err);
        toast.error(`Failed to delete worktree: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw err; // Re-throw to keep dialog open
      }
    },
    [deleteWorktreeMutation, refetchWorktrees]
  );

  const handleSyncWorktrees = useCallback(async () => {
    if (!currentProject) return;

    try {
      const result = await syncWorktreesMutation.mutate({
        projectId: currentProject.id,
      });

      if (result.added > 0 || result.removed > 0) {
        toast.success(
          `Synced worktrees: ${String(result.added)} added, ${String(result.removed)} removed`
        );
      } else {
        toast.info('Worktrees are already in sync');
      }

      // Refetch worktrees
      await refetchWorktrees();
    } catch (err) {
      console.error('Failed to sync worktrees:', err);
      toast.error('Failed to sync worktrees');
    }
  }, [currentProject, syncWorktreesMutation, refetchWorktrees]);

  const handleOpenTerminal = useCallback((worktreeId: string) => {
    toast.info('Terminal integration coming soon');
    console.log('Open terminal for worktree:', worktreeId);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderStats = () => {
    const totalWorktrees = worktrees?.length ?? 0;
    const mainWorktree = worktrees?.find((w) => w.isMain);
    const activeTerminals = worktrees?.reduce((sum, w) => sum + (w._count?.terminals ?? 0), 0) ?? 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Worktrees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorktrees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Main Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">
                {mainWorktree?.branch ?? 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Terminals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTerminals}</div>
          </CardContent>
        </Card>
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
          <h1 className="text-3xl font-bold">Git Worktrees</h1>
          <p className="text-muted-foreground mt-2">
            Manage git worktrees for parallel task development
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to manage its worktrees.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Project has no target path
  if (!currentProject.targetPath) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Git Worktrees</h1>
          <p className="text-muted-foreground mt-2">
            Manage git worktrees for parallel task development
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This project does not have a target path set. Please configure the project
            settings to enable worktree management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Git Worktrees</h1>
          <p className="text-muted-foreground mt-2">
            Manage git worktrees for {currentProject.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { void handleSyncWorktrees(); }}
            disabled={syncWorktreesMutation.loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${syncWorktreesMutation.loading ? 'animate-spin' : ''}`}
            />
            Sync
          </Button>
          <Button onClick={handleOpenCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Worktree
          </Button>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Error Alert */}
      {worktreesError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{worktreesError.message}</AlertDescription>
        </Alert>
      )}

      {/* Worktree List */}
      <WorktreeList
        worktrees={worktrees ?? []}
        loading={worktreesLoading}
        onDelete={(id: string, force: boolean) => { void handleDeleteWorktree(id, force); }}
        onOpenTerminal={handleOpenTerminal}
        onRefresh={() => { void refetchWorktrees(); }}
      />

      {/* Create Worktree Modal */}
      <CreateWorktreeModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={currentProject.id}
        projectTargetPath={currentProject.targetPath}
        onSuccess={() => { void refetchWorktrees(); }}
      />
    </div>
  );
}
