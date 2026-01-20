/**
 * WorktreeCard Component
 *
 * Card-based view of a git worktree with status and actions.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GitBranch,
  FolderOpen,
  Terminal,
  MoreHorizontal,
  Trash2,
  GitCommit,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { WorktreeWithStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface WorktreeCardProps {
  worktree: WorktreeWithStatus;
  onDelete: (id: string) => void;
  onOpenTerminal?: (worktreeId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WorktreeCard({ worktree, onDelete, onOpenTerminal }: WorktreeCardProps) {
  const terminalCount = worktree._count?.terminals || 0;
  const gitStatus = worktree.gitStatus;
  const isMainWorktree = worktree.isMain;

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const truncatePath = (path: string, maxLength = 40) => {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return `.../${parts.slice(-2).join('/')}`;
  };

  const renderGitStatus = () => {
    if (!gitStatus) return null;

    const hasChanges =
      gitStatus.staged > 0 || gitStatus.modified > 0 || gitStatus.untracked > 0;
    const hasRemoteChanges = gitStatus.ahead > 0 || gitStatus.behind > 0;

    if (!hasChanges && !hasRemoteChanges) return null;

    return (
      <div className="flex gap-2 flex-wrap mt-3">
        {gitStatus.ahead > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                <ArrowUp className="h-3 w-3 mr-1" />
                {gitStatus.ahead}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gitStatus.ahead} commits ahead of remote</p>
            </TooltipContent>
          </Tooltip>
        )}
        {gitStatus.behind > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                <ArrowDown className="h-3 w-3 mr-1" />
                {gitStatus.behind}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gitStatus.behind} commits behind remote</p>
            </TooltipContent>
          </Tooltip>
        )}
        {gitStatus.staged > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="default" className="text-xs">
                <GitCommit className="h-3 w-3 mr-1" />
                {gitStatus.staged} staged
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gitStatus.staged} staged changes</p>
            </TooltipContent>
          </Tooltip>
        )}
        {gitStatus.modified > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs">
                {gitStatus.modified} modified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gitStatus.modified} modified files</p>
            </TooltipContent>
          </Tooltip>
        )}
        {gitStatus.untracked > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                {gitStatus.untracked} untracked
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gitStatus.untracked} untracked files</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Name and Main Badge */}
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{worktree.name}</h3>
              {isMainWorktree && (
                <Badge variant="default" className="text-xs flex-shrink-0">
                  Main
                </Badge>
              )}
            </div>

            {/* Branch */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4 flex-shrink-0" />
              <span className="font-mono truncate">{worktree.branch}</span>
            </div>
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onOpenTerminal?.(worktree.id)}
                disabled={!onOpenTerminal}
              >
                <Terminal className="mr-2 h-4 w-4" />
                Open Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(worktree.id)}
                disabled={isMainWorktree}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Worktree
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Path */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm cursor-help">
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-muted-foreground truncate">
                {truncatePath(worktree.path)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs max-w-md break-all">{worktree.path}</p>
          </TooltipContent>
        </Tooltip>

        {/* Terminal Count */}
        {terminalCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span>
              {terminalCount} {terminalCount === 1 ? 'terminal' : 'terminals'}
            </span>
          </div>
        )}

        {/* Git Status */}
        {renderGitStatus()}
      </CardContent>
    </Card>
  );
}
