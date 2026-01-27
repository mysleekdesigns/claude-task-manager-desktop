/**
 * Sync IPC Handlers
 *
 * IPC handlers for real-time synchronization operations.
 * Provides interface between renderer and sync services:
 * - Connection status monitoring
 * - Manual sync triggers
 * - Real-time subscription management
 *
 * @module electron/ipc/sync
 * @phase 17 - Real-Time Sync Engine
 */

import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { realtimeService } from '../services/realtime.js';
import { syncQueueService, type SyncStatus } from '../services/sync-queue.js';
import { supabaseService, type ConnectionStatus } from '../services/supabase.js';
import {
  syncEngineService,
  type SyncResult as EngineSyncResult,
} from '../services/sync-engine.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Overall sync status returned to renderer
 */
export interface SyncStatusResponse {
  connectionStatus: ConnectionStatus;
  queueStatus: SyncStatus;
  activeSubscriptions: string[];
  needsFullSync: boolean;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  syncInProgress: boolean;
}

/**
 * Result of a sync operation (simple)
 */
export interface SyncResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Get overall sync status including connection, queue, subscriptions, and sync engine state
 */
async function handleGetStatus(
  _event: IpcMainInvokeEvent
): Promise<SyncStatusResponse> {
  return {
    connectionStatus: supabaseService.getConnectionStatus(),
    queueStatus: syncQueueService.getQueueStatus(),
    activeSubscriptions: realtimeService.getActiveSubscriptions(),
    needsFullSync: syncEngineService.needsFullSync(),
    lastFullSyncAt: syncEngineService.getLastFullSyncAt(),
    lastIncrementalSyncAt: syncEngineService.getLastIncrementalSyncAt(),
    syncInProgress: syncEngineService.isSyncInProgress(),
  };
}

/**
 * Trigger manual sync (process the queue)
 */
async function handleTriggerSync(
  _event: IpcMainInvokeEvent
): Promise<SyncResult> {
  try {
    await syncQueueService.processQueue();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Perform full sync (bootstrap) from Supabase
 */
async function handlePerformFullSync(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<EngineSyncResult> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required for full sync');
  }

  return syncEngineService.performFullSync(userId);
}

/**
 * Perform incremental sync from Supabase
 */
async function handlePerformIncrementalSync(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<EngineSyncResult> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required for incremental sync');
  }

  return syncEngineService.performIncrementalSync(userId);
}

/**
 * Perform smart sync (chooses full or incremental based on state)
 */
async function handlePerformSync(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<EngineSyncResult> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required for sync');
  }

  return syncEngineService.performSync(userId);
}

/**
 * Reset sync state (for debugging or forcing re-sync)
 */
async function handleResetSyncState(
  _event: IpcMainInvokeEvent
): Promise<SyncResult> {
  try {
    syncEngineService.resetSyncState();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get count of pending changes in queue
 */
async function handleGetQueueCount(
  _event: IpcMainInvokeEvent
): Promise<number> {
  return syncQueueService.getQueueStatus().pending;
}

/**
 * Subscribe to a project's real-time updates
 */
async function handleSubscribe(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<SyncResult> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  try {
    await realtimeService.subscribeToProject(projectId);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Unsubscribe from a project's real-time updates
 */
async function handleUnsubscribe(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<SyncResult> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  try {
    await realtimeService.unsubscribeFromProject(projectId);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get list of active subscriptions (project IDs)
 */
async function handleGetActiveSubscriptions(
  _event: IpcMainInvokeEvent
): Promise<string[]> {
  return realtimeService.getActiveSubscriptions();
}

// ============================================================================
// Logging Wrapper
// ============================================================================

/**
 * Wrap a handler with logging
 */
function wrapWithLogging<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn> {
  return async (
    event: IpcMainInvokeEvent,
    ...args: TArgs
  ): Promise<TReturn> => {
    const startTime = performance.now();
    logIPCRequest(channel, args);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;
      logIPCResponse(channel, result, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logIPCError(channel, error, duration);
      throw error;
    }
  };
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all sync-related IPC handlers
 *
 * @param mainWindow - The main BrowserWindow instance for push notifications
 */
export function registerSyncHandlers(mainWindow: BrowserWindow): void {
  // Set main window reference for push notifications
  realtimeService.setMainWindow(mainWindow);
  syncEngineService.setMainWindow(mainWindow);

  // Subscribe to queue status changes and forward to renderer
  syncQueueService.onStatusChange((status) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:queue-status', status);
    }
  });

  // Subscribe to connection status changes and forward to renderer
  supabaseService.onConnectionStatusChange((status) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:status-change', status);
    }
  });

  // sync:getStatus - Get overall sync status
  ipcMain.handle(
    'sync:getStatus',
    wrapWithLogging('sync:getStatus', wrapHandler(handleGetStatus))
  );

  // sync:triggerSync - Trigger manual sync (process queue)
  ipcMain.handle(
    'sync:triggerSync',
    wrapWithLogging('sync:triggerSync', wrapHandler(handleTriggerSync))
  );

  // sync:getQueueCount - Get pending changes count
  ipcMain.handle(
    'sync:getQueueCount',
    wrapWithLogging('sync:getQueueCount', wrapHandler(handleGetQueueCount))
  );

  // sync:subscribe - Subscribe to project realtime updates
  ipcMain.handle(
    'sync:subscribe',
    wrapWithLogging('sync:subscribe', wrapHandler(handleSubscribe))
  );

  // sync:unsubscribe - Unsubscribe from project
  ipcMain.handle(
    'sync:unsubscribe',
    wrapWithLogging('sync:unsubscribe', wrapHandler(handleUnsubscribe))
  );

  // sync:getActiveSubscriptions - Get list of active subscriptions
  ipcMain.handle(
    'sync:getActiveSubscriptions',
    wrapWithLogging(
      'sync:getActiveSubscriptions',
      wrapHandler(handleGetActiveSubscriptions)
    )
  );

  // sync:performFullSync - Perform full sync (bootstrap) from Supabase
  ipcMain.handle(
    'sync:performFullSync',
    wrapWithLogging('sync:performFullSync', wrapHandler(handlePerformFullSync))
  );

  // sync:performIncrementalSync - Perform incremental sync from Supabase
  ipcMain.handle(
    'sync:performIncrementalSync',
    wrapWithLogging(
      'sync:performIncrementalSync',
      wrapHandler(handlePerformIncrementalSync)
    )
  );

  // sync:performSync - Smart sync (auto chooses full or incremental)
  ipcMain.handle(
    'sync:performSync',
    wrapWithLogging('sync:performSync', wrapHandler(handlePerformSync))
  );

  // sync:resetSyncState - Reset sync state for debugging
  ipcMain.handle(
    'sync:resetSyncState',
    wrapWithLogging('sync:resetSyncState', wrapHandler(handleResetSyncState))
  );
}

/**
 * Unregister all sync-related IPC handlers
 */
export function unregisterSyncHandlers(): void {
  ipcMain.removeHandler('sync:getStatus');
  ipcMain.removeHandler('sync:triggerSync');
  ipcMain.removeHandler('sync:getQueueCount');
  ipcMain.removeHandler('sync:subscribe');
  ipcMain.removeHandler('sync:unsubscribe');
  ipcMain.removeHandler('sync:getActiveSubscriptions');
  ipcMain.removeHandler('sync:performFullSync');
  ipcMain.removeHandler('sync:performIncrementalSync');
  ipcMain.removeHandler('sync:performSync');
  ipcMain.removeHandler('sync:resetSyncState');
}

/**
 * Cleanup function for app quit
 *
 * Should be called during app shutdown to:
 * - Unsubscribe from all real-time channels
 * - Clean up sync queue resources
 * - Clean up sync engine resources
 */
export async function cleanupSyncHandlers(): Promise<void> {
  await realtimeService.cleanup();
  syncQueueService.cleanup();
  syncEngineService.cleanup();
}
