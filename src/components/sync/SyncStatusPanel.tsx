/**
 * Sync Status Panel Component
 *
 * A slide-out panel showing detailed sync statistics, pending changes,
 * and sync controls. Accessible from the SyncStatusIndicator.
 *
 * @module components/sync/SyncStatusPanel
 */

import { useCallback } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  FilePlus,
  FileX,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  useNetworkStore,
  selectEffectiveStatus,
  type PendingChange,
} from '@/stores/network-store';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SyncStatusPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Operation icon based on change type
 */
function OperationIcon({ operation }: { operation: PendingChange['operation'] }) {
  switch (operation) {
    case 'create':
      return <FilePlus className="h-4 w-4 text-green-500" />;
    case 'update':
      return <FileEdit className="h-4 w-4 text-blue-500" />;
    case 'delete':
      return <FileX className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}

/**
 * Format timestamp as relative or absolute time
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pending change list item
 */
function PendingChangeItem({ change }: { change: PendingChange }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <OperationIcon operation={change.operation} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{change.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {change.entityType}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(change.timestamp)}
          </span>
          {change.retryCount > 0 && (
            <span className="text-xs text-destructive">
              {change.retryCount} retries
            </span>
          )}
        </div>
        {change.lastError && (
          <p className="text-xs text-destructive mt-1 truncate">
            {change.lastError}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * SyncStatusPanel displays detailed sync information and controls
 * in a slide-out sheet panel.
 *
 * Features:
 * - Current sync status overview
 * - Sync progress indicator (when syncing)
 * - List of pending changes
 * - Manual sync trigger
 * - Clear cache option (with confirmation)
 * - Offline mode toggle
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <SyncStatusPanel open={open} onOpenChange={setOpen} />
 * ```
 */
export function SyncStatusPanel({ open, onOpenChange }: SyncStatusPanelProps) {
  // Store subscriptions
  const effectiveStatus = useNetworkStore(selectEffectiveStatus);
  const isSyncing = useNetworkStore((state) => state.isSyncing);
  const syncProgress = useNetworkStore((state) => state.syncProgress);
  const pendingSyncCount = useNetworkStore((state) => state.pendingSyncCount);
  const pendingChanges = useNetworkStore((state) => state.pendingChanges);
  const lastSyncedAt = useNetworkStore((state) => state.lastSyncedAt);
  const lastSyncError = useNetworkStore((state) => state.lastSyncError);
  const isOfflineMode = useNetworkStore((state) => state.isOfflineMode);

  // Store actions
  const setOfflineMode = useNetworkStore((state) => state.setOfflineMode);
  const clearPendingChanges = useNetworkStore((state) => state.clearPendingChanges);
  const startSync = useNetworkStore((state) => state.startSync);
  const completeSync = useNetworkStore((state) => state.completeSync);
  const setSyncProgress = useNetworkStore((state) => state.setSyncProgress);

  // Handlers
  const handleManualSync = useCallback(async () => {
    if (effectiveStatus === 'offline') {
      toast.error('Cannot sync while offline');
      return;
    }

    if (isSyncing) {
      toast.info('Sync already in progress');
      return;
    }

    if (pendingSyncCount === 0) {
      toast.info('Nothing to sync');
      return;
    }

    // Start sync
    startSync();

    try {
      // Simulate sync progress (in real implementation, this would be
      // driven by actual sync operations via IPC)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setSyncProgress(i);
      }

      // Complete sync successfully
      completeSync(true);
      toast.success('Sync completed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      completeSync(false, message);
      toast.error(`Sync failed: ${message}`);
    }
  }, [effectiveStatus, isSyncing, pendingSyncCount, startSync, setSyncProgress, completeSync]);

  const handleClearCache = useCallback(() => {
    clearPendingChanges();
    toast.success('Cache cleared');
  }, [clearPendingChanges]);

  const handleOfflineModeToggle = useCallback((checked: boolean) => {
    setOfflineMode(checked);
    toast.info(checked ? 'Offline mode enabled' : 'Offline mode disabled');
  }, [setOfflineMode]);

  // Status display
  const statusDisplay = {
    online: {
      icon: Cloud,
      label: 'Online',
      color: 'text-green-500',
    },
    offline: {
      icon: CloudOff,
      label: 'Offline',
      color: 'text-destructive',
    },
    reconnecting: {
      icon: RefreshCw,
      label: 'Reconnecting',
      color: 'text-yellow-500',
    },
  }[effectiveStatus];

  const StatusIconComponent = statusDisplay.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StatusIconComponent className={cn('h-5 w-5', statusDisplay.color)} />
            Sync Status
          </SheetTitle>
          <SheetDescription>
            Manage your sync settings and view pending changes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIconComponent className={cn('h-5 w-5', statusDisplay.color)} />
                <span className="font-medium">{statusDisplay.label}</span>
                {isOfflineMode && (
                  <Badge variant="secondary" className="text-xs">
                    Manual
                  </Badge>
                )}
              </div>
              {lastSyncedAt && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(lastSyncedAt)}
                </div>
              )}
            </div>

            {/* Sync Progress */}
            {isSyncing && syncProgress !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Syncing...</span>
                  <span>{Math.round(syncProgress)}%</span>
                </div>
                <Progress value={syncProgress} />
              </div>
            )}

            {/* Sync Status Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {pendingSyncCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {pendingSyncCount === 0 ? 'All synced' : `${pendingSyncCount} pending`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pendingSyncCount === 0 ? 'No changes to sync' : 'Changes awaiting sync'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {lastSyncError ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-destructive">Sync Error</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lastSyncError}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">No errors</p>
                      <p className="text-xs text-muted-foreground">Last sync successful</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Pending Changes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Pending Changes</h4>
              <Badge variant="outline">{pendingSyncCount}</Badge>
            </div>

            {pendingChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No pending changes
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {pendingChanges.map((change) => (
                    <PendingChangeItem key={change.id} change={change} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Controls */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Sync Controls</h4>

            {/* Offline Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="offline-mode">Offline Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Disable network sync temporarily
                </p>
              </div>
              <Switch
                id="offline-mode"
                checked={isOfflineMode}
                onCheckedChange={handleOfflineModeToggle}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleManualSync}
                disabled={
                  effectiveStatus === 'offline' ||
                  isSyncing ||
                  pendingSyncCount === 0
                }
                className="flex-1"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={pendingSyncCount === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Pending Changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will discard all {pendingSyncCount} pending changes that
                      haven't been synced yet. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearCache}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear Cache
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default SyncStatusPanel;
