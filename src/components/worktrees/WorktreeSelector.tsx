/**
 * Worktree Selector Component
 *
 * Compact dropdown for selecting a worktree in terminal headers.
 * Shows worktree name, branch, and allows changing terminal working directory.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useIPCQuery } from '@/hooks/useIPC';
import { GitBranch, Folder, AlertCircle } from 'lucide-react';
import type { WorktreeWithStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

export interface WorktreeSelectorProps {
  projectId: string;
  value: string | null | undefined; // worktreeId (null/undefined for default/project root)
  onChange: (worktreeId: string | null, path: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
  showLabel?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function WorktreeSelector({
  projectId,
  value,
  onChange,
  disabled = false,
  size = 'default',
  showLabel = false,
}: WorktreeSelectorProps) {
  const [localValue, setLocalValue] = useState<string>(value || 'default');

  // Fetch worktrees for this project
  const {
    data: worktrees,
    loading,
    error,
  } = useIPCQuery('worktrees:list', [projectId], {
    enabled: !!projectId,
  });

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || 'default');
  }, [value]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleValueChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      if (newValue === 'default') {
        // Use project root - we'll send null as worktreeId
        // The path will be determined by the terminal creation logic
        onChange(null, '');
      } else {
        // Find the selected worktree
        const selectedWorktree = worktrees?.find((w: WorktreeWithStatus) => w.id === newValue);
        if (selectedWorktree) {
          onChange(selectedWorktree.id, selectedWorktree.path);
        }
      }
    },
    [onChange, worktrees]
  );

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTriggerContent = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span className="text-xs">Loading...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Error</span>
        </div>
      );
    }

    // Find current worktree
    const currentWorktree = localValue === 'default'
      ? null
      : worktrees?.find((w: WorktreeWithStatus) => w.id === localValue);

    if (currentWorktree) {
      return (
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs truncate max-w-[120px]" title={currentWorktree.name}>
            {currentWorktree.name}
          </span>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {currentWorktree.branch}
          </Badge>
        </div>
      );
    }

    // Default (project root)
    return (
      <div className="flex items-center gap-2">
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs">Project Root</span>
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  const triggerClassName = size === 'sm'
    ? 'h-7 text-xs'
    : 'h-9 text-sm';

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          Worktree:
        </label>
      )}
      <Select
        value={localValue}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue>
            {renderTriggerContent()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Default option - project root */}
          <SelectItem value="default">
            <div className="flex items-center gap-2 py-1">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Project Root</span>
                <span className="text-xs text-muted-foreground">
                  Default working directory
                </span>
              </div>
            </div>
          </SelectItem>

          {/* Worktree options */}
          {worktrees && worktrees.length > 0 && (
            <>
              {worktrees.map((worktree: WorktreeWithStatus) => (
                <SelectItem key={worktree.id} value={worktree.id}>
                  <div className="flex items-center gap-2 py-1">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{worktree.name}</span>
                        {worktree.isMain && (
                          <Badge variant="default" className="text-[10px] px-1 py-0">
                            Main
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {worktree.branch}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {truncatePath(worktree.path)}
                        </span>
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}

          {/* Empty state */}
          {(!worktrees || worktrees.length === 0) && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No worktrees available
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate path to show last 2 segments
 */
function truncatePath(path: string, maxLength = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}
