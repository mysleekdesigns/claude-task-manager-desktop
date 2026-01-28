/**
 * Network Sync Hook
 *
 * Integrates network store with browser and IPC events for
 * real-time sync status updates.
 *
 * @module hooks/useNetworkSync
 */

import { useEffect, useCallback } from 'react';
import { useNetworkStore, initNetworkListeners } from '@/stores/network-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Sync status event from main process
 */
export interface SyncStatusEvent {
  status: 'idle' | 'syncing' | 'error' | 'success';
  progress?: number;
  pendingCount?: number;
  error?: string;
}

/**
 * Network status event from main process
 */
export interface NetworkStatusEvent {
  online: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to initialize and manage network sync state.
 *
 * This hook:
 * 1. Sets up browser online/offline event listeners
 * 2. Subscribes to IPC events for sync status updates
 * 3. Provides utilities for manual sync triggering
 *
 * Should be called once at the app root level.
 *
 * @example
 * ```tsx
 * function App() {
 *   useNetworkSync();
 *
 *   return (
 *     <MainLayout>
 *       <Routes />
 *     </MainLayout>
 *   );
 * }
 * ```
 */
export function useNetworkSync(): void {
  const setStatus = useNetworkStore((state) => state.setStatus);
  const setSyncProgress = useNetworkStore((state) => state.setSyncProgress);
  const setPendingSyncCount = useNetworkStore((state) => state.setPendingSyncCount);
  const setLastSyncError = useNetworkStore((state) => state.setLastSyncError);
  const setIsSyncing = useNetworkStore((state) => state.setIsSyncing);
  const setLastSyncedAt = useNetworkStore((state) => state.setLastSyncedAt);

  // Handle sync status events from main process
  const handleSyncStatus = useCallback(
    (event: SyncStatusEvent) => {
      switch (event.status) {
        case 'syncing':
          setIsSyncing(true);
          if (event.progress !== undefined) {
            setSyncProgress(event.progress);
          }
          break;
        case 'success':
          setIsSyncing(false);
          setSyncProgress(null);
          setLastSyncedAt(new Date());
          setLastSyncError(null);
          break;
        case 'error':
          setIsSyncing(false);
          setSyncProgress(null);
          setLastSyncError(event.error || 'Sync failed');
          break;
        case 'idle':
        default:
          setIsSyncing(false);
          setSyncProgress(null);
          break;
      }

      if (event.pendingCount !== undefined) {
        setPendingSyncCount(event.pendingCount);
      }
    },
    [setIsSyncing, setSyncProgress, setLastSyncedAt, setLastSyncError, setPendingSyncCount]
  );

  // Handle network status events from main process
  const handleNetworkStatus = useCallback(
    (event: NetworkStatusEvent) => {
      const isOfflineMode = useNetworkStore.getState().isOfflineMode;
      if (!isOfflineMode) {
        setStatus(event.online ? 'online' : 'offline');
      }
    },
    [setStatus]
  );

  // Initialize browser event listeners
  useEffect(() => {
    const cleanup = initNetworkListeners();
    return cleanup;
  }, []);

  // Subscribe to IPC events from main process
  useEffect(() => {
    // Check if we're in Electron environment
    if (typeof window === 'undefined' || !window.electron) {
      return;
    }

    // Subscribe to sync:status events
    // Note: These event channels would need to be added to the IPC types
    // For now, we'll use a pattern that can be extended
    const unsubscribeSyncStatus = window.electron.on(
      'sync:status' as never,
      (event: unknown) => {
        handleSyncStatus(event as SyncStatusEvent);
      }
    );

    // Subscribe to sync:progress events
    const unsubscribeSyncProgress = window.electron.on(
      'sync:progress' as never,
      (progress: unknown) => {
        if (typeof progress === 'number') {
          setSyncProgress(progress);
        }
      }
    );

    // Subscribe to network:status events
    const unsubscribeNetworkStatus = window.electron.on(
      'network:status' as never,
      (event: unknown) => {
        handleNetworkStatus(event as NetworkStatusEvent);
      }
    );

    // Cleanup subscriptions
    return () => {
      unsubscribeSyncStatus();
      unsubscribeSyncProgress();
      unsubscribeNetworkStatus();
    };
  }, [handleSyncStatus, handleNetworkStatus, setSyncProgress]);
}

/**
 * Hook to get current sync summary
 *
 * @returns Object with sync status information
 *
 * @example
 * ```tsx
 * function SyncBadge() {
 *   const { isOnline, isSyncing, pendingCount } = useSyncStatus();
 *
 *   return (
 *     <Badge variant={isOnline ? 'default' : 'destructive'}>
 *       {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
 *     </Badge>
 *   );
 * }
 * ```
 */
export function useSyncStatus() {
  const status = useNetworkStore((state) => state.status);
  const isSyncing = useNetworkStore((state) => state.isSyncing);
  const syncProgress = useNetworkStore((state) => state.syncProgress);
  const pendingSyncCount = useNetworkStore((state) => state.pendingSyncCount);
  const lastSyncedAt = useNetworkStore((state) => state.lastSyncedAt);
  const lastSyncError = useNetworkStore((state) => state.lastSyncError);
  const isOfflineMode = useNetworkStore((state) => state.isOfflineMode);

  return {
    status,
    isOnline: status === 'online' && !isOfflineMode,
    isOffline: status === 'offline' || isOfflineMode,
    isReconnecting: status === 'reconnecting',
    isSyncing,
    syncProgress,
    pendingCount: pendingSyncCount,
    hasPendingChanges: pendingSyncCount > 0,
    lastSyncedAt,
    lastSyncError,
    hasError: !!lastSyncError,
    isOfflineMode,
  };
}

/**
 * Hook to get sync actions
 *
 * @returns Object with sync control functions
 *
 * @example
 * ```tsx
 * function SyncControls() {
 *   const { triggerSync, setOfflineMode, clearCache } = useSyncActions();
 *
 *   return (
 *     <div>
 *       <Button onClick={triggerSync}>Sync Now</Button>
 *       <Button onClick={() => setOfflineMode(true)}>Go Offline</Button>
 *       <Button onClick={clearCache}>Clear Cache</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSyncActions() {
  const startSync = useNetworkStore((state) => state.startSync);
  const completeSync = useNetworkStore((state) => state.completeSync);
  const setOfflineMode = useNetworkStore((state) => state.setOfflineMode);
  const clearPendingChanges = useNetworkStore((state) => state.clearPendingChanges);
  const addPendingChange = useNetworkStore((state) => state.addPendingChange);

  const triggerSync = useCallback(async () => {
    const state = useNetworkStore.getState();

    // Don't sync if offline or already syncing
    if (state.status === 'offline' || state.isOfflineMode || state.isSyncing) {
      return;
    }

    // Don't sync if nothing to sync
    if (state.pendingSyncCount === 0) {
      return;
    }

    startSync();

    try {
      // In a real implementation, this would call IPC to trigger sync
      // For now, we simulate the sync
      await new Promise((resolve) => setTimeout(resolve, 1000));
      completeSync(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      completeSync(false, message);
    }
  }, [startSync, completeSync]);

  const clearCache = useCallback(() => {
    clearPendingChanges();
  }, [clearPendingChanges]);

  const queueChange = useCallback(
    (
      entityType: string,
      entityId: string,
      operation: 'create' | 'update' | 'delete',
      description: string
    ) => {
      addPendingChange({
        entityType,
        entityId,
        operation,
        description,
      });
    },
    [addPendingChange]
  );

  return {
    triggerSync,
    setOfflineMode,
    clearCache,
    queueChange,
  };
}

export default useNetworkSync;
