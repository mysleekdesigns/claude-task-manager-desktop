/**
 * Conflict Notification Component
 *
 * Displays toast/banner notifications when sync conflicts are detected.
 * Shows conflict summary with action button to resolve.
 *
 * @module components/collaboration/ConflictNotification
 */

import { useEffect, useCallback } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import {
  useConflictStore,
  selectPendingConflicts,
  selectHasConflicts,
} from '@/stores/conflict-store';
import { cn } from '@/lib/utils';
import type { SyncConflict, ConflictEntityType } from '@/types/conflict';

// ============================================================================
// Types
// ============================================================================

export interface ConflictNotificationProps {
  /** Optional className for styling */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Maximum number of conflicts to show in list */
  maxVisible?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get entity type display name
 */
function getEntityTypeLabel(entityType: ConflictEntityType): string {
  const labels: Record<ConflictEntityType, string> = {
    task: 'Task',
    project: 'Project',
    memory: 'Memory',
  };
  return labels[entityType] || entityType;
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Single conflict item in the notification
 */
function ConflictItem({
  conflict,
  onResolve,
  onDismiss,
}: {
  conflict: SyncConflict;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-muted/50 hover:bg-muted/80 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="shrink-0 text-xs">
          {getEntityTypeLabel(conflict.entityType)}
        </Badge>
        <span className="text-sm font-medium truncate">{conflict.entityName}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeTime(conflict.detectedAt)}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onResolve(conflict.id)}
        >
          Resolve
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(conflict.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConflictNotification displays a banner when sync conflicts are detected.
 *
 * Features:
 * - Warning banner with conflict count
 * - List of pending conflicts
 * - Quick actions to resolve or dismiss
 * - Auto-hides when no conflicts
 *
 * @example
 * ```tsx
 * // In the app header or global notification area
 * <ConflictNotification />
 *
 * // Compact mode for smaller spaces
 * <ConflictNotification compact />
 * ```
 */
export function ConflictNotification({
  className,
  compact = false,
  maxVisible = 3,
}: ConflictNotificationProps) {
  const conflicts = useConflictStore(selectPendingConflicts);
  const hasConflicts = useConflictStore(selectHasConflicts);
  const { openConflictModal, dismissConflict } = useConflictResolution();

  // Handle resolve action
  const handleResolve = useCallback(
    (conflictId: string) => {
      openConflictModal(conflictId);
    },
    [openConflictModal]
  );

  // Handle dismiss action
  const handleDismiss = useCallback(
    (conflictId: string) => {
      dismissConflict(conflictId);
    },
    [dismissConflict]
  );

  // Handle dismiss all
  const handleDismissAll = useCallback(() => {
    conflicts.forEach((conflict) => {
      dismissConflict(conflict.id);
    });
  }, [conflicts, dismissConflict]);

  // Don't render if no conflicts
  if (!hasConflicts) {
    return null;
  }

  const visibleConflicts = conflicts.slice(0, maxVisible);
  const hiddenCount = conflicts.length - visibleConflicts.length;

  // Compact mode - just a badge
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'relative text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
          className
        )}
        onClick={() => {
          const firstConflict = conflicts[0];
          if (firstConflict) {
            openConflictModal(firstConflict.id);
          }
        }}
      >
        <AlertTriangle className="h-4 w-4 mr-1" />
        {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''}
      </Button>
    );
  }

  return (
    <Alert
      className={cn(
        'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center justify-between">
        <span>
          {conflicts.length} Sync Conflict{conflicts.length !== 1 ? 's' : ''} Detected
        </span>
        {conflicts.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleDismissAll}
          >
            Dismiss All
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-3">
        <div className="space-y-2">
          {visibleConflicts.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
            />
          ))}

          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{hiddenCount} more conflict{hiddenCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to show toast notifications for new conflicts.
 * Call this once at the app root level.
 */
export function useConflictNotifications(): void {
  const { openConflictModal } = useConflictResolution();

  // Subscribe to new conflicts
  useEffect(() => {
    const unsubscribe = useConflictStore.subscribe(
      (state) => state.conflicts,
      (conflicts, previousConflicts) => {
        // Find new conflicts
        const previousIds = new Set(previousConflicts.map((c) => c.id));
        const newConflicts = conflicts.filter((c) => !previousIds.has(c.id));

        // Show toast for each new conflict
        newConflicts.forEach((conflict) => {
          // Toast notifications for new conflicts can be added here
          // For now, the conflict indicator in the header handles visibility
          console.debug('New conflict detected:', conflict.id);
        });
      }
    );

    return unsubscribe;
  }, [openConflictModal]);
}

export default ConflictNotification;
