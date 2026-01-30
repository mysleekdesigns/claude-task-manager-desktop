/**
 * Memory Card Component
 *
 * Displays a single memory item with type badge, timestamp, content preview,
 * expand/collapse functionality, edit, archive, and delete actions.
 */

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Trash2, Link } from 'lucide-react';
import type { Memory } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface MemoryCardProps {
  memory: Memory;
  onDelete: (memory: Memory) => void;
  onEdit?: (memory: Memory) => void;
  onArchive?: (memory: Memory) => void;
}

// ============================================================================
// Type Badge Configuration
// ============================================================================

const TYPE_BADGE_CONFIG: Record<
  Memory['type'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  context: { label: 'Context', variant: 'default' },
  decision: { label: 'Decision', variant: 'secondary' },
  pattern: { label: 'Pattern', variant: 'secondary' },
  gotcha: { label: 'Gotcha', variant: 'destructive' },
  session: { label: 'Session', variant: 'default' },
  task: { label: 'Task', variant: 'outline' },
  pr_review: { label: 'PR Review', variant: 'secondary' },
  codebase: { label: 'Codebase', variant: 'outline' },
};

// ============================================================================
// Source Badge Configuration
// ============================================================================

const SOURCE_BADGE_CONFIG: Record<
  Memory['source'],
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  manual: { label: 'Manual', variant: 'outline' },
  auto_session: { label: 'Auto Session', variant: 'secondary' },
  auto_commit: { label: 'Auto Commit', variant: 'secondary' },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a date string to relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${String(diffInMinutes)} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${String(diffInHours)} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${String(diffInDays)} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${String(diffInWeeks)} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${String(diffInMonths)} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${String(diffInYears)} ${diffInYears === 1 ? 'year' : 'years'} ago`;
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
}

// ============================================================================
// Component
// ============================================================================

export function MemoryCard({ memory, onDelete, onEdit, onArchive }: MemoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const badgeConfig = TYPE_BADGE_CONFIG[memory.type] || { label: memory.type, variant: 'outline' as const };
  const sourceBadgeConfig = SOURCE_BADGE_CONFIG[memory.source] || { label: memory.source, variant: 'outline' as const };
  const relativeTime = useMemo(() => formatRelativeTime(memory.createdAt), [memory.createdAt]);

  // Content preview (truncated)
  const contentPreview = useMemo(
    () => truncateText(memory.content, 150),
    [memory.content]
  );

  const shouldShowExpandButton = memory.content.length > 150;

  // Handle toggle expand
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle edit click
  const handleEditClick = useCallback(() => {
    onEdit?.(memory);
  }, [memory, onEdit]);

  // Handle archive click
  const handleArchiveClick = useCallback(() => {
    onArchive?.(memory);
  }, [memory, onArchive]);

  // Handle delete confirmation
  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    onDelete(memory);
    setShowDeleteDialog(false);
  }, [memory, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  return (
    <>
      <Card className={`hover:border-primary/50 transition-colors ${memory.isArchived ? 'opacity-60 bg-muted/30' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant={badgeConfig.variant} className="text-xs">
                  {badgeConfig.label}
                </Badge>
                <Badge variant={sourceBadgeConfig.variant} className="text-xs">
                  {sourceBadgeConfig.label}
                </Badge>
                {memory.isArchived && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Archived
                  </Badge>
                )}
                {memory.task && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Link className="h-3 w-3" />
                          Task
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Linked to: {memory.task.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="text-xs text-muted-foreground">{relativeTime}</span>
              </div>
              <h4 className={`font-semibold text-base truncate ${memory.isArchived ? 'text-muted-foreground' : ''}`}>
                {memory.title}
              </h4>
            </div>

            <div className="flex items-center gap-1">
              {/* Edit Button */}
              {onEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={handleEditClick}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit memory</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Archive/Unarchive Button */}
              {onArchive && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                        onClick={handleArchiveClick}
                      >
                        {memory.isArchived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{memory.isArchived ? 'Restore memory' : 'Archive memory'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Delete Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={handleDeleteClick}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete memory</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Content */}
          <div className="space-y-3">
            <p className={`text-sm whitespace-pre-wrap ${memory.isArchived ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              {isExpanded ? memory.content : contentPreview}
            </p>

            {/* Expand/Collapse Button */}
            {shouldShowExpandButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleToggleExpand}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Show more
                  </>
                )}
              </Button>
            )}

            {/* Linked Task Info (when expanded) */}
            {isExpanded && memory.task && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Linked Task:</p>
                <p className="text-sm">{memory.task.title}</p>
              </div>
            )}

            {/* Metadata (if exists and expanded) */}
            {isExpanded && memory.metadata && Object.keys(memory.metadata).length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Metadata:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(memory.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{memory.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
