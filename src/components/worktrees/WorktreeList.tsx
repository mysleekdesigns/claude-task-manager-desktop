/**
 * WorktreeList Component
 *
 * Displays a table of git worktrees for a project with actions.
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { GitBranch, MoreHorizontal, FolderOpen, Terminal, Trash2 } from 'lucide-react';
import type { WorktreeWithStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface WorktreeListProps {
  worktrees: WorktreeWithStatus[];
  loading?: boolean;
  onDelete: (id: string, force: boolean) => Promise<void>;
  onOpenTerminal?: (worktreeId: string) => void;
  onRefresh?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function WorktreeList({
  worktrees,
  loading = false,
  onDelete,
  onOpenTerminal,
  onRefresh,
}: WorktreeListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorktree, setSelectedWorktree] = useState<WorktreeWithStatus | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleDeleteClick = (worktree: WorktreeWithStatus) => {
    setSelectedWorktree(worktree);
    setForceDelete(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedWorktree) return;

    try {
      await onDelete(selectedWorktree.id, forceDelete);
      setDeleteDialogOpen(false);
      setSelectedWorktree(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete worktree:', error);
      // Keep dialog open on error so user can try force delete
    }
  };

  const handleOpenTerminal = (worktreeId: string) => {
    if (onOpenTerminal) {
      onOpenTerminal(worktreeId);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const truncatePath = (path: string, maxLength = 50) => {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return `.../${parts.slice(-2).join('/')}`;
  };


  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading worktrees...</div>
      </div>
    );
  }

  if (worktrees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-6xl opacity-20 mb-4">📁</div>
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">
          No Worktrees Found
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Create a worktree to work on multiple branches simultaneously.
          Each worktree is a separate working directory linked to the same repository.
        </p>
      </div>
    );
  }

  return (
    <>
      <TooltipProvider>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="w-[350px]">Path</TableHead>
                <TableHead className="w-[150px]">Terminals</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worktrees.map((worktree) => {
                const terminalCount = worktree._count?.terminals || 0;
                const isMainWorktree = worktree.isMain;

                return (
                  <TableRow key={worktree.id}>
                    {/* Name */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {worktree.name}
                        {isMainWorktree && (
                          <Badge variant="default" className="text-xs">
                            Main
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Branch */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{worktree.branch}</span>
                      </div>
                    </TableCell>

                    {/* Path */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground font-mono">
                              {truncatePath(worktree.path)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">{worktree.path}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Terminal Count */}
                    <TableCell>
                      {terminalCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{terminalCount}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { handleOpenTerminal(worktree.id); }}
                            disabled={!onOpenTerminal}
                          >
                            <Terminal className="mr-2 h-4 w-4" />
                            Open Terminal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => { handleDeleteClick(worktree); }}
                            disabled={isMainWorktree}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Worktree
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worktree</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the worktree "{selectedWorktree?.name}"?
              <br />
              <br />
              <span className="font-mono text-xs text-muted-foreground">
                {selectedWorktree?.path}
              </span>
              {selectedWorktree?._count?.terminals ? (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium text-warning">
                    This worktree has {selectedWorktree._count.terminals} active{' '}
                    {selectedWorktree._count.terminals === 1 ? 'terminal' : 'terminals'}.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deleting will close all associated terminals.
                  </p>
                </div>
              ) : null}
              <div className="mt-4 flex items-start gap-2">
                <input
                  type="checkbox"
                  id="force-delete"
                  checked={forceDelete}
                  onChange={(e) => { setForceDelete(e.target.checked); }}
                  className="mt-1"
                />
                <label htmlFor="force-delete" className="text-sm">
                  Force delete (removes worktree even if there are uncommitted changes)
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
