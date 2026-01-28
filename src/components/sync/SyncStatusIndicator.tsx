/**
 * Sync Status Indicator Component
 *
 * A compact indicator showing network connectivity and sync status.
 * Displays as a colored dot with optional badge for pending changes.
 *
 * - Green dot: Online, fully synced
 * - Yellow dot: Syncing or has pending changes
 * - Red dot: Offline
 *
 * @module components/sync/SyncStatusIndicator
 */

import { useState } from 'react';
import {
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNetworkStore, selectEffectiveStatus } from '@/stores/network-store';
import { SyncStatusPanel } from './SyncStatusPanel';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SyncStatusIndicatorProps {
  /** Optional className for styling */
  className?: string;
  /** Whether to show the pending count badge */
  showBadge?: boolean;
  /** Size of the indicator */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a date as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Get status indicator color classes
 */
function getStatusColor(
  status: 'online' | 'offline' | 'reconnecting',
  isSyncing: boolean,
  hasPending: boolean
): string {
  if (status === 'offline') {
    return 'bg-destructive';
  }
  if (isSyncing || hasPending) {
    return 'bg-yellow-500';
  }
  if (status === 'reconnecting') {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
}

/**
 * Get status icon component
 */
function StatusIcon({
  status,
  isSyncing,
  className,
}: {
  status: 'online' | 'offline' | 'reconnecting';
  isSyncing: boolean;
  className?: string;
}) {
  if (isSyncing) {
    return <Loader2 className={cn('animate-spin', className)} />;
  }
  if (status === 'offline') {
    return <CloudOff className={className} />;
  }
  if (status === 'reconnecting') {
    return <RefreshCw className={cn('animate-spin', className)} />;
  }
  return <Cloud className={className} />;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SyncStatusIndicator displays the current network and sync status
 * as a compact indicator with tooltip details.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SyncStatusIndicator />
 *
 * // With badge for pending count
 * <SyncStatusIndicator showBadge />
 *
 * // Different sizes
 * <SyncStatusIndicator size="lg" />
 * ```
 */
export function SyncStatusIndicator({
  className,
  showBadge = true,
  size = 'md',
}: SyncStatusIndicatorProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Store subscriptions
  const effectiveStatus = useNetworkStore(selectEffectiveStatus);
  const isSyncing = useNetworkStore((state) => state.isSyncing);
  const pendingSyncCount = useNetworkStore((state) => state.pendingSyncCount);
  const lastSyncedAt = useNetworkStore((state) => state.lastSyncedAt);
  const lastSyncError = useNetworkStore((state) => state.lastSyncError);
  const isOfflineMode = useNetworkStore((state) => state.isOfflineMode);

  // Compute derived state
  const hasPending = pendingSyncCount > 0;
  const statusColor = getStatusColor(effectiveStatus, isSyncing, hasPending);

  // Size classes
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-9 w-9',
  };

  const iconSizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const dotSizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  // Build tooltip content
  const getTooltipContent = () => {
    const lines: string[] = [];

    // Status line
    if (isOfflineMode) {
      lines.push('Offline mode (manual)');
    } else if (effectiveStatus === 'offline') {
      lines.push('Offline - No internet connection');
    } else if (effectiveStatus === 'reconnecting') {
      lines.push('Reconnecting...');
    } else if (isSyncing) {
      lines.push('Syncing changes...');
    } else if (hasPending) {
      lines.push(`${pendingSyncCount} change${pendingSyncCount !== 1 ? 's' : ''} pending`);
    } else {
      lines.push('Online - All synced');
    }

    // Last sync time
    lines.push(`Last synced: ${formatRelativeTime(lastSyncedAt)}`);

    // Error if present
    if (lastSyncError) {
      lines.push(`Error: ${lastSyncError}`);
    }

    return lines.join('\n');
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'relative',
              sizeClasses[size],
              className
            )}
            onClick={() => setIsPanelOpen(true)}
            aria-label="Sync status"
          >
            <StatusIcon
              status={effectiveStatus}
              isSyncing={isSyncing}
              className={iconSizeClasses[size]}
            />

            {/* Status dot indicator */}
            <span
              className={cn(
                'absolute bottom-1 right-1 rounded-full border-2 border-background',
                dotSizeClasses[size],
                statusColor
              )}
            />

            {/* Pending count badge */}
            {showBadge && hasPending && !isSyncing && (
              <Badge
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
              >
                {pendingSyncCount > 99 ? '99+' : pendingSyncCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="whitespace-pre-line">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>

      {/* Sync Status Panel */}
      <SyncStatusPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
      />
    </>
  );
}

export default SyncStatusIndicator;
