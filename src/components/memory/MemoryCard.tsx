/**
 * Memory Card Component
 *
 * Displays a single memory item with type badge, timestamp, content preview,
 * expand/collapse functionality, and delete action.
 */

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Memory } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface MemoryCardProps {
  memory: Memory;
  onDelete: (memory: Memory) => void;
}

// ============================================================================
// Type Badge Configuration
// ============================================================================

const TYPE_BADGE_CONFIG: Record<
  Memory['type'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  session: { label: 'Session', variant: 'default' },
  pr_review: { label: 'PR Review', variant: 'secondary' },
  codebase: { label: 'Codebase', variant: 'outline' },
  pattern: { label: 'Pattern', variant: 'secondary' },
  gotcha: { label: 'Gotcha', variant: 'destructive' },
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
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
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

export function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const badgeConfig = TYPE_BADGE_CONFIG[memory.type];
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
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={badgeConfig.variant} className="text-xs">
                  {badgeConfig.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{relativeTime}</span>
              </div>
              <h4 className="font-semibold text-base truncate">{memory.title}</h4>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Content */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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
              Are you sure you want to delete "{memory.title}"? This action cannot be undone.
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
