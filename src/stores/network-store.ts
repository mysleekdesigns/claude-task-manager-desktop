/**
 * Network Store
 *
 * Zustand store for managing network connectivity and sync state.
 * Tracks online/offline status, pending sync operations, and sync progress.
 *
 * @module stores/network-store
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Network connectivity status
 */
export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

/**
 * Represents a pending change waiting to be synced
 */
export interface PendingChange {
  /** Unique identifier for the change */
  id: string;
  /** Type of entity being changed (e.g., 'task', 'project') */
  entityType: string;
  /** ID of the entity being changed */
  entityId: string;
  /** Type of operation (create, update, delete) */
  operation: 'create' | 'update' | 'delete';
  /** Human-readable description of the change */
  description: string;
  /** Timestamp when the change was queued */
  timestamp: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Last error if sync failed */
  lastError?: string;
}

/**
 * Network store state interface
 */
export interface NetworkState {
  /** Current network status */
  status: NetworkStatus;
  /** Number of changes pending sync */
  pendingSyncCount: number;
  /** List of pending changes awaiting sync */
  pendingChanges: PendingChange[];
  /** Timestamp of last successful sync */
  lastSyncedAt: Date | null;
  /** Sync progress percentage (0-100) during active sync, null when not syncing */
  syncProgress: number | null;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Last sync error message */
  lastSyncError: string | null;
  /** Whether we're in offline mode (user manually set) */
  isOfflineMode: boolean;
}

/**
 * Network store actions interface
 */
export interface NetworkActions {
  /** Set the network status */
  setStatus: (status: NetworkStatus) => void;
  /** Set the pending sync count */
  setPendingSyncCount: (count: number) => void;
  /** Add a pending change to the queue */
  addPendingChange: (change: Omit<PendingChange, 'id' | 'timestamp' | 'retryCount'>) => void;
  /** Remove a pending change by ID */
  removePendingChange: (id: string) => void;
  /** Update a pending change's retry count and error */
  updatePendingChange: (id: string, updates: Partial<Pick<PendingChange, 'retryCount' | 'lastError'>>) => void;
  /** Clear all pending changes */
  clearPendingChanges: () => void;
  /** Set the last synced timestamp */
  setLastSyncedAt: (date: Date | null) => void;
  /** Set the sync progress */
  setSyncProgress: (progress: number | null) => void;
  /** Set syncing state */
  setIsSyncing: (isSyncing: boolean) => void;
  /** Set the last sync error */
  setLastSyncError: (error: string | null) => void;
  /** Toggle offline mode */
  setOfflineMode: (offline: boolean) => void;
  /** Reset the store to initial state */
  reset: () => void;
  /** Start a sync operation (sets syncing state and clears errors) */
  startSync: () => void;
  /** Complete a sync operation (updates timestamps and clears progress) */
  completeSync: (success: boolean, error?: string) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: NetworkState = {
  status: typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'online',
  pendingSyncCount: 0,
  pendingChanges: [],
  lastSyncedAt: null,
  syncProgress: null,
  isSyncing: false,
  lastSyncError: null,
  isOfflineMode: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Network store for managing connectivity and sync state.
 *
 * Uses subscribeWithSelector middleware for granular subscriptions.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const status = useNetworkStore((state) => state.status);
 *
 * // Subscribe to specific changes
 * useNetworkStore.subscribe(
 *   (state) => state.status,
 *   (status) => console.log('Network status changed:', status)
 * );
 * ```
 */
export const useNetworkStore = create<NetworkState & NetworkActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setStatus: (status) => {
      set({ status });
    },

    setPendingSyncCount: (count) => {
      set({ pendingSyncCount: count });
    },

    addPendingChange: (change) => {
      const newChange: PendingChange = {
        ...change,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        retryCount: 0,
      };
      set((state) => ({
        pendingChanges: [...state.pendingChanges, newChange],
        pendingSyncCount: state.pendingSyncCount + 1,
      }));
    },

    removePendingChange: (id) => {
      set((state) => {
        const filtered = state.pendingChanges.filter((c) => c.id !== id);
        return {
          pendingChanges: filtered,
          pendingSyncCount: filtered.length,
        };
      });
    },

    updatePendingChange: (id, updates) => {
      set((state) => ({
        pendingChanges: state.pendingChanges.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },

    clearPendingChanges: () => {
      set({
        pendingChanges: [],
        pendingSyncCount: 0,
      });
    },

    setLastSyncedAt: (date) => {
      set({ lastSyncedAt: date });
    },

    setSyncProgress: (progress) => {
      set({ syncProgress: progress });
    },

    setIsSyncing: (isSyncing) => {
      set({ isSyncing });
    },

    setLastSyncError: (error) => {
      set({ lastSyncError: error });
    },

    setOfflineMode: (offline) => {
      set({
        isOfflineMode: offline,
        status: offline ? 'offline' : (navigator?.onLine ? 'online' : 'offline'),
      });
    },

    reset: () => {
      set(initialState);
    },

    startSync: () => {
      set({
        isSyncing: true,
        syncProgress: 0,
        lastSyncError: null,
      });
    },

    completeSync: (success, error) => {
      const state = get();
      set({
        isSyncing: false,
        syncProgress: null,
        lastSyncedAt: success ? new Date() : state.lastSyncedAt,
        lastSyncError: error || null,
        // Clear pending changes on successful sync
        ...(success
          ? {
              pendingChanges: [],
              pendingSyncCount: 0,
            }
          : {}),
      });
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector for checking if there are pending changes
 */
export const selectHasPendingChanges = (state: NetworkState): boolean =>
  state.pendingSyncCount > 0;

/**
 * Selector for getting the effective connectivity status
 * (accounts for offline mode override)
 */
export const selectEffectiveStatus = (state: NetworkState): NetworkStatus =>
  state.isOfflineMode ? 'offline' : state.status;

/**
 * Selector for getting sync status summary
 */
export const selectSyncSummary = (state: NetworkState) => ({
  status: state.status,
  isSyncing: state.isSyncing,
  pendingCount: state.pendingSyncCount,
  lastSynced: state.lastSyncedAt,
  hasError: !!state.lastSyncError,
});

// ============================================================================
// Browser Event Integration
// ============================================================================

/**
 * Initialize browser network event listeners.
 * Call this once in your app initialization.
 */
export function initNetworkListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => { /* noop for SSR */ };
  }

  const handleOnline = () => {
    const state = useNetworkStore.getState();
    if (!state.isOfflineMode) {
      useNetworkStore.setState({ status: 'online' });
    }
  };

  const handleOffline = () => {
    useNetworkStore.setState({ status: 'offline' });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export default useNetworkStore;
