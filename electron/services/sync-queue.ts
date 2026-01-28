/**
 * Sync Queue Service
 *
 * Manages local changes to be synchronized with Supabase cloud.
 * Features:
 * - Persists queue using electron-store to survive app restarts
 * - Debounces rapid changes (same record within 500ms)
 * - Retries failed syncs with exponential backoff (max 3 attempts)
 * - Logs all changes to SyncLog table for audit trail
 */

import Store from 'electron-store';
import { supabaseService } from './supabase';
import { getPrismaClient } from './database';

/**
 * Supported table names for sync operations
 */
export type SyncTable = 'Project' | 'Task' | 'ProjectMember';

/**
 * Minimal store interface matching the electron-store methods we use
 */
interface SyncQueueStoreInterface {
  get<K extends keyof SyncQueueStore>(key: K): SyncQueueStore[K];
  set<K extends keyof SyncQueueStore>(key: K, value: SyncQueueStore[K]): void;
}

/**
 * In-memory fallback store for when electron-store cannot write to disk
 * (e.g., during E2E tests or sandboxed environments)
 */
class InMemorySyncQueueStore implements SyncQueueStoreInterface {
  private data: SyncQueueStore = {
    pendingChanges: [],
    lastProcessedAt: null,
  };

  get<K extends keyof SyncQueueStore>(key: K): SyncQueueStore[K] {
    return this.data[key];
  }

  set<K extends keyof SyncQueueStore>(key: K, value: SyncQueueStore[K]): void {
    this.data[key] = value;
  }
}

/**
 * Supported database operations for sync
 */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Represents a change queued for synchronization
 */
export interface SyncChange {
  id: string;
  table: SyncTable;
  recordId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  retryCount: number;
  createdAt: string;
}

/**
 * Status information for the sync queue
 */
export interface SyncStatus {
  pending: number;
  processing: boolean;
  lastProcessedAt: string | null;
}

/**
 * Callback type for sync status changes
 */
type SyncStatusCallback = (status: SyncStatus) => void;

/**
 * electron-store schema for sync queue persistence
 */
interface SyncQueueStore {
  pendingChanges: SyncChange[];
  lastProcessedAt: string | null;
}

/**
 * Exponential backoff delays in milliseconds for retry attempts
 * Attempt 1: 1000ms, Attempt 2: 2000ms, Attempt 3: 4000ms
 */
const BACKOFF_DELAYS = [1000, 2000, 4000];

/**
 * Debounce delay for coalescing rapid changes to the same record
 */
const DEBOUNCE_DELAY_MS = 500;

/**
 * Maximum number of retry attempts before giving up
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * SyncQueueService Class
 *
 * Singleton service that manages the synchronization queue between
 * local SQLite database and Supabase cloud.
 */
class SyncQueueService {
  private store: SyncQueueStoreInterface;
  private processing = false;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private statusCallbacks: Set<SyncStatusCallback> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize electron-store for sync queue persistence
    // Falls back to in-memory storage on permission errors (e.g., E2E tests, sandboxed environments)
    try {
      this.store = new Store<SyncQueueStore>({
        name: 'sync-queue',
        defaults: {
          pendingChanges: [],
          lastProcessedAt: null,
        },
      });
    } catch (error) {
      // Handle EPERM and other permission errors by falling back to in-memory storage
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'EPERM' || errorCode === 'EACCES' || errorCode === 'EROFS') {
        console.warn(
          `[SyncQueue] Cannot write to disk (${errorCode}), using in-memory storage. ` +
            'Queue will not persist across app restarts.'
        );
        this.store = new InMemorySyncQueueStore();
      } else {
        // For unexpected errors, still fall back but log more details
        console.warn(
          '[SyncQueue] Failed to initialize electron-store, using in-memory fallback:',
          error
        );
        this.store = new InMemorySyncQueueStore();
      }
    }
  }

  /**
   * Enqueue a change for synchronization with debouncing.
   *
   * Multiple changes to the same record within 500ms will be coalesced
   * into a single sync operation.
   *
   * @param change - The change to enqueue (without id, retryCount, createdAt)
   */
  enqueue(change: Omit<SyncChange, 'id' | 'retryCount' | 'createdAt'>): void {
    const key = `${change.table}:${change.recordId}`;

    // Clear existing debounce timer for this record
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce: wait 500ms before actually enqueuing
    const timer = setTimeout(() => {
      this.addToQueue(change);
      this.debounceTimers.delete(key);
    }, DEBOUNCE_DELAY_MS);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Internal method to add a change to the persistent queue.
   * Coalesces changes to the same record by removing previous entries.
   *
   * @param change - The change to add
   */
  private addToQueue(
    change: Omit<SyncChange, 'id' | 'retryCount' | 'createdAt'>
  ): void {
    const queue = this.store.get('pendingChanges');

    // Remove any existing change for same record (coalesce)
    const filtered = queue.filter(
      (c) => !(c.table === change.table && c.recordId === change.recordId)
    );

    const newChange: SyncChange = {
      ...change,
      id: crypto.randomUUID(),
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.store.set('pendingChanges', [...filtered, newChange]);

    // Also log to SyncLog table for audit trail
    this.logToDatabase(newChange).catch((error) => {
      console.error('[SyncQueue] Failed to log change to database:', error);
    });

    this.notifyStatusChange();
  }

  /**
   * Log a sync change to the local SyncLog table for audit trail.
   *
   * @param change - The change to log
   */
  private async logToDatabase(change: SyncChange): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.syncLog.create({
        data: {
          table: change.table,
          recordId: change.recordId,
          operation: change.operation,
          data: JSON.stringify(change.data),
          synced: false,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not block sync
      console.error('[SyncQueue] Error logging to SyncLog:', error);
    }
  }

  /**
   * Process all pending changes in the queue.
   *
   * Only processes when online. Each failed change is retried up to
   * MAX_RETRY_ATTEMPTS times with exponential backoff.
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      console.log('[SyncQueue] Already processing - skipping');
      return;
    }

    // Check if online
    if (!supabaseService.isInitialized()) {
      console.log('[SyncQueue] Supabase not initialized - skipping queue processing');
      return;
    }

    if (supabaseService.getConnectionStatus() !== 'online') {
      console.log('[SyncQueue] Offline - skipping queue processing');
      return;
    }

    this.processing = true;
    this.notifyStatusChange();

    try {
      const queue = this.store.get('pendingChanges');

      if (queue.length === 0) {
        console.log('[SyncQueue] Queue is empty');
        return;
      }

      console.log(`[SyncQueue] Processing ${queue.length} pending changes`);

      for (const change of queue) {
        try {
          await this.pushChange(change);
          this.removeFromQueue(change.id);
          await this.markSyncLogSynced(change);
          console.log(
            `[SyncQueue] Successfully synced ${change.table}:${change.recordId} (${change.operation})`
          );
        } catch (error) {
          console.error(
            `[SyncQueue] Failed to sync ${change.table}:${change.recordId}:`,
            error
          );
          await this.handleSyncError(change, error);
        }
      }

      this.store.set('lastProcessedAt', new Date().toISOString());
    } finally {
      this.processing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Push a single change to Supabase.
   *
   * @param change - The change to push
   * @throws Error if the push fails
   */
  private async pushChange(change: SyncChange): Promise<void> {
    const supabase = supabaseService.getClient();
    const tableName = this.getSupabaseTableName(change.table);

    switch (change.operation) {
      case 'INSERT': {
        const { error } = await supabase.from(tableName).insert(change.data);
        if (error) {
          throw new Error(`Supabase INSERT failed: ${error.message}`);
        }
        break;
      }
      case 'UPDATE': {
        const { error } = await supabase
          .from(tableName)
          .update(change.data)
          .eq('id', change.recordId);
        if (error) {
          throw new Error(`Supabase UPDATE failed: ${error.message}`);
        }
        break;
      }
      case 'DELETE': {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', change.recordId);
        if (error) {
          throw new Error(`Supabase DELETE failed: ${error.message}`);
        }
        break;
      }
    }
  }

  /**
   * Convert local table name to Supabase table name.
   * Supabase typically uses lowercase plural table names.
   *
   * @param table - Local table name (e.g., 'Project')
   * @returns Supabase table name (e.g., 'projects')
   */
  private getSupabaseTableName(table: SyncTable): string {
    const tableMap: Record<SyncTable, string> = {
      Project: 'projects',
      Task: 'tasks',
      ProjectMember: 'project_members',
    };
    return tableMap[table];
  }

  /**
   * Handle a sync error by either retrying with backoff or removing
   * the change after max retries.
   *
   * @param change - The change that failed
   * @param error - The error that occurred
   */
  private async handleSyncError(
    change: SyncChange,
    error: unknown
  ): Promise<void> {
    const queue = this.store.get('pendingChanges');
    const index = queue.findIndex((c) => c.id === change.id);

    if (index === -1) {
      return;
    }

    // Check if max retries reached (0, 1, 2 = 3 attempts total)
    if (change.retryCount >= MAX_RETRY_ATTEMPTS - 1) {
      // Max retries reached - remove from queue and log error
      console.error(
        `[SyncQueue] Max retries (${MAX_RETRY_ATTEMPTS}) reached for ${change.table}:${change.recordId} - removing from queue`
      );
      this.removeFromQueue(change.id);

      // Update SyncLog with error
      try {
        const prisma = getPrismaClient();
        await prisma.syncLog.updateMany({
          where: {
            recordId: change.recordId,
            table: change.table,
            synced: false,
          },
          data: {
            error: error instanceof Error ? error.message : String(error),
            retryCount: change.retryCount + 1,
          },
        });
      } catch (logError) {
        console.error('[SyncQueue] Failed to update SyncLog with error:', logError);
      }
    } else {
      // Increment retry count and schedule retry with exponential backoff
      const queuedChange = queue[index];
      if (!queuedChange) {
        return;
      }
      queuedChange.retryCount++;
      this.store.set('pendingChanges', queue);

      const delay = BACKOFF_DELAYS[change.retryCount] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
      console.log(
        `[SyncQueue] Scheduling retry ${change.retryCount + 1}/${MAX_RETRY_ATTEMPTS} for ${change.table}:${change.recordId} in ${delay}ms`
      );

      // Clear any existing retry timeout for this change
      const existingTimeout = this.retryTimeouts.get(change.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Schedule retry
      const timeout = setTimeout(() => {
        this.retryTimeouts.delete(change.id);
        // Only retry this specific change, not the whole queue
        this.retrySingleChange(change.id).catch((err) => {
          console.error('[SyncQueue] Retry failed:', err);
        });
      }, delay);

      this.retryTimeouts.set(change.id, timeout);
    }
  }

  /**
   * Retry a single change from the queue.
   *
   * @param changeId - The ID of the change to retry
   */
  private async retrySingleChange(changeId: string): Promise<void> {
    // Check if still online
    if (
      !supabaseService.isInitialized() ||
      supabaseService.getConnectionStatus() !== 'online'
    ) {
      console.log('[SyncQueue] Not online - deferring retry');
      return;
    }

    const queue = this.store.get('pendingChanges');
    const change = queue.find((c) => c.id === changeId);

    if (!change) {
      console.log('[SyncQueue] Change not found for retry - may have been processed');
      return;
    }

    try {
      await this.pushChange(change);
      this.removeFromQueue(change.id);
      await this.markSyncLogSynced(change);
      console.log(
        `[SyncQueue] Retry successful for ${change.table}:${change.recordId}`
      );
    } catch (error) {
      console.error(
        `[SyncQueue] Retry failed for ${change.table}:${change.recordId}:`,
        error
      );
      await this.handleSyncError(change, error);
    }
  }

  /**
   * Remove a change from the persistent queue.
   *
   * @param id - The ID of the change to remove
   */
  private removeFromQueue(id: string): void {
    const queue = this.store.get('pendingChanges');
    this.store.set(
      'pendingChanges',
      queue.filter((c) => c.id !== id)
    );
    this.notifyStatusChange();
  }

  /**
   * Mark the corresponding SyncLog entry as synced.
   *
   * @param change - The change that was successfully synced
   */
  private async markSyncLogSynced(change: SyncChange): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.syncLog.updateMany({
        where: {
          recordId: change.recordId,
          table: change.table,
          synced: false,
        },
        data: {
          synced: true,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      // Log error but don't throw - marking as synced is not critical
      console.error('[SyncQueue] Error marking SyncLog as synced:', error);
    }
  }

  /**
   * Get the current status of the sync queue.
   *
   * @returns Status including pending count, processing state, and last processed time
   */
  getQueueStatus(): SyncStatus {
    return {
      pending: this.store.get('pendingChanges').length,
      processing: this.processing,
      lastProcessedAt: this.store.get('lastProcessedAt'),
    };
  }

  /**
   * Subscribe to sync status changes.
   *
   * @param callback - Function to call when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(callback: SyncStatusCallback): () => void {
    this.statusCallbacks.add(callback);

    // Immediately call with current status
    callback(this.getQueueStatus());

    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Notify all status callbacks of a status change.
   */
  private notifyStatusChange(): void {
    const status = this.getQueueStatus();
    this.statusCallbacks.forEach((cb) => {
      try {
        cb(status);
      } catch (error) {
        console.error('[SyncQueue] Error in status callback:', error);
      }
    });
  }

  /**
   * Get all pending changes (for debugging/admin purposes).
   *
   * @returns Array of pending sync changes
   */
  getPendingChanges(): SyncChange[] {
    return this.store.get('pendingChanges');
  }

  /**
   * Clear all pending changes (use with caution).
   * This will discard all unsynced changes.
   */
  clearQueue(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // Clear the queue
    this.store.set('pendingChanges', []);
    this.notifyStatusChange();

    console.log('[SyncQueue] Queue cleared');
  }

  /**
   * Clean up resources when the service is being shut down.
   */
  cleanup(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // Clear callbacks
    this.statusCallbacks.clear();

    console.log('[SyncQueue] Cleanup complete');
  }
}

// Export singleton instance
export const syncQueueService = new SyncQueueService();
