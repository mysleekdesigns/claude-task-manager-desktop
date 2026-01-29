/**
 * Terminal Pane Component
 *
 * Individual terminal pane with header controls and content area.
 * Supports expand/collapse, status indicators, and worktree selection.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Maximize2,
  Minimize2,
  X,
  MoreVertical,
  Pencil,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { WorktreeSelector } from '@/components/worktrees';
import { useIPCQuery } from '@/hooks/useIPC';

// ============================================================================
// Types
// ============================================================================

export interface TerminalPaneProps {
  terminal: {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'exited';
    claudeStatus?: 'inactive' | 'active' | 'waiting';
    worktreeId?: string | null;
    taskId?: string | null;
  };
  projectId: string;
  isExpanded?: boolean;
  onClose: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapse: () => void;
  onLaunchClaude?: (id: string) => void;
  onWorktreeChange?: (terminalId: string, worktreeId: string | null, path: string) => void;
  onViewTask?: (taskId: string) => void;
  children?: React.ReactNode; // Slot for XTermWrapper content
}

// ============================================================================
// Component
// ============================================================================

export function TerminalPane({
  terminal,
  projectId,
  isExpanded = false,
  onClose,
  onExpand,
  onCollapse,
  onLaunchClaude,
  onWorktreeChange,
  onViewTask,
  children,
}: TerminalPaneProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [terminalName, setTerminalName] = useState(terminal.name);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Fetch linked task if terminal has a taskId
  const { data: linkedTask } = useIPCQuery('tasks:get', [terminal.taskId || ''], {
    enabled: !!terminal.taskId,
  });

  // Status indicator styling
  const getStatusColor = (status: string) => {
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default';
      case 'exited':
        return 'destructive';
      case 'idle':
      default:
        return 'secondary';
    }
  };

  const getClaudeStatusBadgeVariant = (claudeStatus?: string) => {
    switch (claudeStatus) {
      case 'active':
        return 'default';
      case 'waiting':
        return 'secondary';
      case 'inactive':
      default:
        return 'outline';
    }
  };

  const handleClose = () => {
    if (terminal.status === 'running') {
      setShowCloseConfirm(true);
    } else {
      onClose(terminal.id);
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose(terminal.id);
  };

  const handleRename = () => {
    setIsRenaming(false);
    // TODO: Call IPC to rename terminal
    // For now, just update local state
  };

  const handleWorktreeChange = (worktreeId: string | null, path: string) => {
    if (onWorktreeChange) {
      onWorktreeChange(terminal.id, worktreeId, path);
    }
  };

  return (
    <>
      {/*
        min-w-0 and min-h-0 are critical for flex/grid children to allow shrinking below content size.
        Without these, the Card may overflow its grid cell when content (especially xterm) has intrinsic sizing.
      */}
      <Card className={`flex flex-col h-full min-w-0 min-h-0 py-0 gap-0 ${isExpanded ? 'shadow-lg' : ''}`}>
        {/* Header - using flex instead of grid for compact layout */}
        <CardHeader className="!flex !flex-row items-center px-2 !py-1 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-1.5 w-full">
            {/* Left side: Status and Name */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Status indicator dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(
                  terminal.status
                )}`}
                title={terminal.status}
              />

              {/* Terminal name (editable) */}
              {isRenaming ? (
                <Input
                  value={terminalName}
                  onChange={(e) => { setTerminalName(e.target.value); }}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRename();
                    } else if (e.key === 'Escape') {
                      setTerminalName(terminal.name);
                      setIsRenaming(false);
                    }
                  }}
                  className="h-6 px-2 text-sm font-medium"
                  autoFocus
                />
              ) : (
                <h3
                  className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                  onClick={() => { setIsRenaming(true); }}
                  title={terminal.name}
                >
                  {terminal.name}
                </h3>
              )}

              {/* Status badge */}
              <Badge
                variant={getStatusBadgeVariant(terminal.status)}
                className="h-5 py-0 text-[10px] flex-shrink-0"
              >
                {terminal.status}
              </Badge>

              {/* Claude status badge */}
              {terminal.claudeStatus && terminal.claudeStatus !== 'inactive' && (
                <Badge
                  variant={getClaudeStatusBadgeVariant(terminal.claudeStatus)}
                  className="h-5 py-0 text-[10px] flex-shrink-0 gap-0.5"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Claude {terminal.claudeStatus}
                </Badge>
              )}

              {/* Linked task badge */}
              {linkedTask && (
                <Badge
                  variant="outline"
                  className="h-5 py-0 text-[10px] flex-shrink-0 gap-0.5 cursor-pointer hover:bg-accent"
                  onClick={() => onViewTask?.(linkedTask.id)}
                  title={linkedTask.title}
                >
                  <CheckSquare className="h-2.5 w-2.5" />
                  <span className="max-w-[150px] truncate">{linkedTask.title}</span>
                </Badge>
              )}
            </div>

            {/* Right side: Controls */}
            <div className="flex items-center gap-0.5">
              {/* Launch/Re-launch Claude button */}
              {onLaunchClaude && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 gap-1 text-xs"
                  onClick={() => { onLaunchClaude(terminal.id); }}
                  title={
                    terminal.claudeStatus === 'inactive'
                      ? 'Launch Claude Code'
                      : 'Re-launch Claude Code'
                  }
                >
                  <Sparkles className="h-3 w-3" />
                  {terminal.claudeStatus === 'inactive' ? 'Launch' : 'Re-launch'} Claude
                </Button>
              )}

              {/* Worktree selector */}
              <WorktreeSelector
                projectId={projectId}
                value={terminal.worktreeId}
                onChange={handleWorktreeChange}
                disabled={terminal.status !== 'running'}
                size="sm"
              />

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="More options"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Terminal Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setIsRenaming(true); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleClose}
                    className="text-destructive focus:text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Close Terminal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Expand/Collapse button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={isExpanded ? onCollapse : () => { onExpand(terminal.id); }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClose}
                title="Close terminal"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Content - XTermWrapper will be rendered here */}
        {/* min-w-0 and min-h-0 allow proper shrinking in flex container */}
        <CardContent className="p-0 flex-1 overflow-hidden bg-black min-w-0 min-h-0">
          {children || (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Terminal content will appear here
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close confirmation dialog */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Close Running Terminal?</DialogTitle>
            <DialogDescription>
              This terminal is currently running. Closing it will terminate the
              running process. Are you sure you want to close it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowCloseConfirm(false); }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmClose}>
              Close Terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
