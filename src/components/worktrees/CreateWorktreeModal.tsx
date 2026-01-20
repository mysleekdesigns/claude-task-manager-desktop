/**
 * CreateWorktreeModal Component
 *
 * Reusable modal for creating new git worktrees.
 * Allows selecting existing branches or creating new ones,
 * with directory picker integration.
 */

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateWorktreeInput, BranchInfo, OpenDirectoryResult } from '@/types/ipc';

// ============================================================================
// Props Interface
// ============================================================================

export interface CreateWorktreeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTargetPath?: string | null;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CreateWorktreeModal({
  open,
  onOpenChange,
  projectId,
  projectTargetPath,
  onSuccess,
}: CreateWorktreeModalProps) {
  // Form state
  const [worktreeName, setWorktreeName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [worktreePath, setWorktreePath] = useState('');
  const [createNewBranch, setCreateNewBranch] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    branch?: string;
    path?: string;
  }>({});

  // Fetch branches when modal opens
  const {
    data: branches = [],
    loading: branchesLoading,
  } = useIPCQuery(
    'branches:list',
    projectId ? [projectId] : undefined,
    {
      enabled: !!projectId && open,
    }
  );

  // Create worktree mutation
  const createWorktreeMutation = useIPCMutation('worktrees:create');

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Reset form state when modal opens/closes
   */
  useEffect(() => {
    if (!open) {
      setWorktreeName('');
      setSelectedBranch('');
      setWorktreePath('');
      setCreateNewBranch(false);
      setErrors({});
    }
  }, [open]);

  /**
   * Handle directory picker
   */
  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result: OpenDirectoryResult = await window.electron.invoke('dialog:openDirectory', {
        title: 'Select Worktree Location',
        buttonLabel: 'Select Folder',
        defaultPath: projectTargetPath || undefined,
      });

      if (!result.canceled && result.filePaths.length > 0 && result.filePaths[0]) {
        setWorktreePath(result.filePaths[0]);
        const { path, ...rest } = errors;
        setErrors(rest);
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
      toast.error('Failed to open directory picker');
    }
  }, [projectTargetPath, errors]);

  /**
   * Validate form inputs
   */
  const validateForm = useCallback(() => {
    const newErrors: typeof errors = {};

    if (!worktreeName.trim()) {
      newErrors.name = 'Worktree name is required';
    }

    if (!selectedBranch.trim()) {
      newErrors.branch = 'Branch name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [worktreeName, selectedBranch]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      if (!projectTargetPath) {
        toast.error('Project must have a target path set');
        return;
      }

      try {
        // Generate path if not provided
        const finalPath =
          worktreePath.trim() ||
          `${projectTargetPath}/../${worktreeName.replace(/\s+/g, '-')}`;

        const createInput: CreateWorktreeInput = {
          projectId,
          name: worktreeName.trim(),
          branch: selectedBranch.trim(),
          path: finalPath,
          createBranch: createNewBranch,
        };

        await createWorktreeMutation.mutate(createInput);

        toast.success(`Worktree "${worktreeName}" created successfully`);

        // Close modal
        onOpenChange(false);

        // Call success callback
        onSuccess?.();
      } catch (err) {
        console.error('Failed to create worktree:', err);
        toast.error(
          `Failed to create worktree: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [
      validateForm,
      projectTargetPath,
      worktreePath,
      worktreeName,
      selectedBranch,
      createNewBranch,
      projectId,
      createWorktreeMutation,
      onOpenChange,
      onSuccess,
    ]
  );

  /**
   * Handle checkbox toggle
   */
  const handleCreateNewBranchToggle = useCallback((checked: boolean) => {
    setCreateNewBranch(checked);
    setSelectedBranch('');
    setErrors((prev) => {
      const { branch, ...rest } = prev;
      return rest;
    });
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Worktree</DialogTitle>
          <DialogDescription>
            Create a git worktree to work on a branch in a separate directory.
            Each worktree is a separate working directory linked to the same repository.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Worktree Name */}
            <div className="space-y-2">
              <Label htmlFor="worktree-name">
                Worktree Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="worktree-name"
                placeholder="feature-branch"
                value={worktreeName}
                onChange={(e) => {
                  setWorktreeName(e.target.value);
                  setErrors((prev) => {
                    const { name, ...rest } = prev;
                    return rest;
                  });
                }}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch">
                Branch <span className="text-destructive">*</span>
              </Label>
              {createNewBranch ? (
                <Input
                  id="branch"
                  placeholder="Enter new branch name"
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setErrors((prev) => {
                      const { branch, ...rest } = prev;
                      return rest;
                    });
                  }}
                  className={errors.branch ? 'border-destructive' : ''}
                />
              ) : (
                <Select
                  value={selectedBranch}
                  onValueChange={(value) => {
                    setSelectedBranch(value);
                    setErrors((prev) => {
                      const { branch, ...rest } = prev;
                      return rest;
                    });
                  }}
                >
                  <SelectTrigger
                    className={errors.branch ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {branchesLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">
                            Loading branches...
                          </span>
                        </div>
                      ) : !branches || branches.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No branches found
                        </div>
                      ) : (
                        branches.map((branch: BranchInfo) => (
                          <SelectItem key={branch.name} value={branch.name}>
                            {branch.name}
                            {branch.current && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (current)
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              )}
              {errors.branch && (
                <p className="text-xs text-destructive">{errors.branch}</p>
              )}

              {/* Create new branch checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="create-new-branch"
                  checked={createNewBranch}
                  onCheckedChange={handleCreateNewBranchToggle}
                />
                <Label
                  htmlFor="create-new-branch"
                  className="text-sm text-muted-foreground cursor-pointer font-normal"
                >
                  Create new branch
                </Label>
              </div>
            </div>

            {/* Path Input */}
            <div className="space-y-2">
              <Label htmlFor="worktree-path">
                Path <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="worktree-path"
                  placeholder={
                    projectTargetPath
                      ? `${projectTargetPath}/../worktree-name`
                      : 'Enter absolute path'
                  }
                  value={worktreePath}
                  onChange={(e) => {
                    setWorktreePath(e.target.value);
                    setErrors((prev) => {
                      const { path, ...rest } = prev;
                      return rest;
                    });
                  }}
                  className={`flex-1 ${errors.path ? 'border-destructive' : ''}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleBrowseDirectory}
                  title="Browse directory"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              {errors.path && (
                <p className="text-xs text-destructive">{errors.path}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate based on worktree name
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createWorktreeMutation.loading}
            >
              {createWorktreeMutation.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Worktree'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
