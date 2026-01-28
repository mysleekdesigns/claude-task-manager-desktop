/**
 * Network IPC Handlers
 *
 * IPC handlers for network status monitoring and connectivity checks.
 * Provides interface between renderer and network status service:
 * - Get current network status
 * - Subscribe to status changes (push to renderer)
 * - Manual connectivity checks
 *
 * @module electron/ipc/network
 * @phase 18 - Offline Support & Conflict Resolution
 */

import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import {
  networkStatusService,
  type NetworkStatusInfo,
} from '../services/network-status.js';
import { syncQueueService } from '../services/sync-queue.js';
import { wrapHandler } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a network operation
 */
export interface NetworkResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Get current network status
 */
async function handleGetStatus(
  _event: IpcMainInvokeEvent
): Promise<NetworkStatusInfo> {
  return networkStatusService.getStatus();
}

/**
 * Perform a manual network connectivity check (ping).
 * Useful for user-initiated retry actions.
 */
async function handlePing(
  _event: IpcMainInvokeEvent
): Promise<NetworkStatusInfo> {
  return networkStatusService.ping();
}

/**
 * Check if network is online (simple boolean)
 */
async function handleIsOnline(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  return networkStatusService.isOnline();
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
 * Register all network-related IPC handlers
 *
 * @param mainWindow - The main BrowserWindow instance for push notifications
 */
export function registerNetworkHandlers(mainWindow: BrowserWindow): void {
  // Initialize the network status service
  networkStatusService.initialize();

  // Subscribe to network status changes and forward to renderer
  networkStatusService.onStatusChange((status) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('network:status-change', status);
    }
  });

  // Integration with sync-queue: Auto-resume processing when coming back online
  networkStatusService.onStatusChange((status) => {
    if (status.status === 'online' && status.supabaseReachable) {
      console.log('[Network] Back online - triggering sync queue processing');
      // Process any pending sync queue items
      syncQueueService.processQueue().catch((error) => {
        console.error('[Network] Error processing sync queue on reconnect:', error);
      });
    }
  });

  // network:getStatus - Get current network status
  ipcMain.handle(
    'network:getStatus',
    wrapWithLogging('network:getStatus', wrapHandler(handleGetStatus))
  );

  // network:ping - Manual connectivity check
  ipcMain.handle(
    'network:ping',
    wrapWithLogging('network:ping', wrapHandler(handlePing))
  );

  // network:isOnline - Simple online check
  ipcMain.handle(
    'network:isOnline',
    wrapWithLogging('network:isOnline', wrapHandler(handleIsOnline))
  );
}

/**
 * Unregister all network-related IPC handlers
 */
export function unregisterNetworkHandlers(): void {
  ipcMain.removeHandler('network:getStatus');
  ipcMain.removeHandler('network:ping');
  ipcMain.removeHandler('network:isOnline');
}

/**
 * Cleanup function for app quit
 *
 * Should be called during app shutdown to:
 * - Stop network monitoring
 * - Clean up resources
 */
export function cleanupNetworkHandlers(): void {
  networkStatusService.cleanup();
}
