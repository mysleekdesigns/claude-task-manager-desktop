/**
 * Collaboration Section Component (Phase 19.4)
 *
 * Settings section for collaboration and sync preferences including:
 * - Enable/disable sync toggle
 * - Sync frequency settings
 * - Clear local cache option
 * - Sync statistics display
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useNetworkStore,
  selectEffectiveStatus,
} from '@/stores/network-store';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type SyncFrequency = 'realtime' | '5min' | '15min' | 'manual';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display
 */
function formatLastSyncTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${String(days)} day${days === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get sync frequency display label
 */
function getSyncFrequencyLabel(frequency: SyncFrequency): string {
  switch (frequency) {
    case 'realtime':
      return 'Real-time';
    case '5min':
      return 'Every 5 minutes';
    case '15min':
      return 'Every 15 minutes';
    case 'manual':
      return 'Manual only';
    default:
      return frequency;
  }
}

// ============================================================================
// Component
// ============================================================================

export function CollaborationSection() {
  // Local state for sync settings
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('realtime');
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Network store subscriptions
  const effectiveStatus = useNetworkStore(selectEffectiveStatus);
  const isSyncing = useNetworkStore((state) => state.isSyncing);
  const pendingSyncCount = useNetworkStore((state) => state.pendingSyncCount);
  const lastSyncedAt = useNetworkStore((state) => state.lastSyncedAt);
  const lastSyncError = useNetworkStore((state) => state.lastSyncError);
  const isOfflineMode = useNetworkStore((state) => state.isOfflineMode);

  // Network store actions
  const setOfflineMode = useNetworkStore((state) => state.setOfflineMode);
  const clearPendingChanges = useNetworkStore((state) => state.clearPendingChanges);
  const startSync = useNetworkStore((state) => state.startSync);
  const completeSync = useNetworkStore((state) => state.completeSync);
  const setSyncProgress = useNetworkStore((state) => state.setSyncProgress);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle sync enable/disable toggle
   */
  const handleSyncToggle = useCallback((enabled: boolean) => {
    setOfflineMode(!enabled);
    toast.info(enabled ? 'Sync enabled' : 'Sync disabled');
  }, [setOfflineMode]);

  /**
   * Handle sync frequency change
   */
  const handleSyncFrequencyChange = useCallback((value: SyncFrequency) => {
    setSyncFrequency(value);
    toast.success(`Sync frequency set to ${getSyncFrequencyLabel(value)}`);
  }, []);

  /**
   * Handle clear cache action
   */
  const handleClearCache = useCallback(async () => {
    setIsClearingCache(true);
    try {
      // Simulate a small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500));
      clearPendingChanges();
      toast.success('Local cache cleared successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to clear cache: ${message}`);
    } finally {
      setIsClearingCache(false);
    }
  }, [clearPendingChanges]);

  /**
   * Handle manual sync trigger
   */
  const handleManualSync = useCallback(async () => {
    if (effectiveStatus === 'offline') {
      toast.error('Cannot sync while offline');
      return;
    }

    if (isSyncing) {
      toast.info('Sync already in progress');
      return;
    }

    startSync();

    try {
      // Simulate sync progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setSyncProgress(i);
      }

      completeSync(true);
      toast.success('Sync completed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      completeSync(false, message);
      toast.error(`Sync failed: ${message}`);
    }
  }, [effectiveStatus, isSyncing, startSync, setSyncProgress, completeSync]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isSyncEnabled = !isOfflineMode;
  const StatusIcon = effectiveStatus === 'online' ? Cloud : CloudOff;
  const statusColor = effectiveStatus === 'online' ? 'text-green-500' : 'text-destructive';

  // Mock sync statistics (in a real implementation, these would come from the backend)
  // For now, we use the pending count and a mock resolved count
  const syncStats = {
    recordsSynced: pendingSyncCount === 0 ? 42 : 42 - pendingSyncCount,
    conflictsResolved: 3,
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className={cn('h-5 w-5', statusColor)} />
          Collaboration
        </CardTitle>
        <CardDescription>
          Manage sync settings and view collaboration statistics
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sync Toggle */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="sync-enabled" className="cursor-pointer">
              Enable Sync
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically synchronize your data across devices and with team members
            </p>
          </div>
          <Switch
            id="sync-enabled"
            checked={isSyncEnabled}
            onCheckedChange={handleSyncToggle}
          />
        </div>

        {/* Sync Frequency */}
        <div className="space-y-2">
          <Label htmlFor="sync-frequency">Sync Frequency</Label>
          <Select
            value={syncFrequency}
            onValueChange={(value) => { handleSyncFrequencyChange(value as SyncFrequency); }}
            disabled={!isSyncEnabled}
          >
            <SelectTrigger id="sync-frequency" className="w-full">
              <SelectValue placeholder="Select sync frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Real-time</SelectItem>
              <SelectItem value="5min">Every 5 minutes</SelectItem>
              <SelectItem value="15min">Every 15 minutes</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How often to sync changes with the server when online
          </p>
        </div>

        {/* Manual Sync Button */}
        {syncFrequency === 'manual' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => { void handleManualSync(); }}
              disabled={!isSyncEnabled || effectiveStatus === 'offline' || isSyncing}
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
            {pendingSyncCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {pendingSyncCount} pending change{pendingSyncCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <Separator />

        {/* Sync Statistics */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Sync Statistics</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Last Sync Time */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Last Sync</p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatLastSyncTime(lastSyncedAt)}
                </p>
              </div>
            </div>

            {/* Records Synced */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Records Synced</p>
                <p className="text-xs text-muted-foreground">
                  {syncStats.recordsSynced} total
                </p>
              </div>
            </div>

            {/* Conflicts Resolved */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {lastSyncError ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">Conflicts Resolved</p>
                <p className="text-xs text-muted-foreground">
                  {syncStats.conflictsResolved} total
                </p>
              </div>
            </div>
          </div>

          {/* Sync Error Display */}
          {lastSyncError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Sync Error</p>
                <p className="text-xs text-muted-foreground">{lastSyncError}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Clear Cache Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Cache Management</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm">Clear Local Cache</p>
              <p className="text-xs text-muted-foreground">
                Remove locally cached data and pending changes. This will not affect synced data.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isClearingCache}
                >
                  {isClearingCache ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Cache
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Local Cache?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all locally cached data and{' '}
                    {pendingSyncCount > 0 ? (
                      <>
                        <strong>{pendingSyncCount} pending change{pendingSyncCount !== 1 ? 's' : ''}</strong> that
                        have not been synced yet.
                      </>
                    ) : (
                      'any pending changes.'
                    )}{' '}
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { void handleClearCache(); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear Cache
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {pendingSyncCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                You have {pendingSyncCount} pending change{pendingSyncCount !== 1 ? 's' : ''} that will be lost if you clear the cache.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
