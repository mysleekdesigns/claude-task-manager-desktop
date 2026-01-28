/**
 * Soft Delete IPC Handlers
 *
 * Handlers for soft delete operations (soft delete, restore, permanent delete, cleanup).
 *
 * @module electron/ipc/soft-delete
 * @phase 18.6 - Soft Deletes Implementation
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import {
  softDeleteService,
  type SoftDeleteTable,
  type SoftDeleteResult,
  type RestoreResult,
  type CleanupResult,
  type ListDeletedOptions,
  type DeletedRecordSummary,
} from '../services/soft-delete.js';

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Soft delete a record
 */
async function handleSoftDelete(
  _event: IpcMainInvokeEvent,
  table: SoftDeleteTable,
  recordId: string,
  syncToCloud?: boolean
): Promise<SoftDeleteResult> {
  if (!table || !recordId) {
    throw IPCErrors.invalidArguments('Table and record ID are required');
  }

  const validTables: SoftDeleteTable[] = ['Project', 'Task', 'ProjectMember'];
  if (!validTables.includes(table)) {
    throw IPCErrors.invalidArguments(`Invalid table: ${table}. Must be one of: ${validTables.join(', ')}`);
  }

  return softDeleteService.softDelete(table, recordId, syncToCloud ?? true);
}

/**
 * Restore a soft-deleted record
 */
async function handleRestore(
  _event: IpcMainInvokeEvent,
  table: SoftDeleteTable,
  recordId: string,
  syncToCloud?: boolean
): Promise<RestoreResult> {
  if (!table || !recordId) {
    throw IPCErrors.invalidArguments('Table and record ID are required');
  }

  const validTables: SoftDeleteTable[] = ['Project', 'Task', 'ProjectMember'];
  if (!validTables.includes(table)) {
    throw IPCErrors.invalidArguments(`Invalid table: ${table}. Must be one of: ${validTables.join(', ')}`);
  }

  return softDeleteService.restore(table, recordId, syncToCloud ?? true);
}

/**
 * Permanently delete a record
 */
async function handlePermanentDelete(
  _event: IpcMainInvokeEvent,
  table: SoftDeleteTable,
  recordId: string,
  syncToCloud?: boolean
): Promise<SoftDeleteResult> {
  if (!table || !recordId) {
    throw IPCErrors.invalidArguments('Table and record ID are required');
  }

  const validTables: SoftDeleteTable[] = ['Project', 'Task', 'ProjectMember'];
  if (!validTables.includes(table)) {
    throw IPCErrors.invalidArguments(`Invalid table: ${table}. Must be one of: ${validTables.join(', ')}`);
  }

  return softDeleteService.permanentDelete(table, recordId, syncToCloud ?? true);
}

/**
 * Clean up old deleted records
 */
async function handleCleanupOldDeleted(
  _event: IpcMainInvokeEvent,
  daysOld?: number,
  syncToCloud?: boolean
): Promise<CleanupResult> {
  return softDeleteService.cleanupOldDeleted(daysOld ?? 30, syncToCloud ?? true);
}

/**
 * List soft-deleted records
 */
async function handleListDeleted(
  _event: IpcMainInvokeEvent,
  options?: ListDeletedOptions
): Promise<DeletedRecordSummary[]> {
  return softDeleteService.listDeleted(options ?? {});
}

/**
 * Check if a record is soft-deleted
 */
async function handleIsDeleted(
  _event: IpcMainInvokeEvent,
  table: SoftDeleteTable,
  recordId: string
): Promise<boolean> {
  if (!table || !recordId) {
    throw IPCErrors.invalidArguments('Table and record ID are required');
  }

  const validTables: SoftDeleteTable[] = ['Project', 'Task', 'ProjectMember'];
  if (!validTables.includes(table)) {
    throw IPCErrors.invalidArguments(`Invalid table: ${table}. Must be one of: ${validTables.join(', ')}`);
  }

  return softDeleteService.isDeleted(table, recordId);
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all soft delete IPC handlers
 */
export function registerSoftDeleteHandlers(): void {
  // softDelete:delete - Soft delete a record
  ipcMain.handle(
    'softDelete:delete',
    wrapWithLogging('softDelete:delete', wrapHandler(handleSoftDelete))
  );

  // softDelete:restore - Restore a soft-deleted record
  ipcMain.handle(
    'softDelete:restore',
    wrapWithLogging('softDelete:restore', wrapHandler(handleRestore))
  );

  // softDelete:permanentDelete - Permanently delete a record
  ipcMain.handle(
    'softDelete:permanentDelete',
    wrapWithLogging('softDelete:permanentDelete', wrapHandler(handlePermanentDelete))
  );

  // softDelete:cleanup - Clean up old deleted records
  ipcMain.handle(
    'softDelete:cleanup',
    wrapWithLogging('softDelete:cleanup', wrapHandler(handleCleanupOldDeleted))
  );

  // softDelete:list - List soft-deleted records
  ipcMain.handle(
    'softDelete:list',
    wrapWithLogging('softDelete:list', wrapHandler(handleListDeleted))
  );

  // softDelete:isDeleted - Check if a record is soft-deleted
  ipcMain.handle(
    'softDelete:isDeleted',
    wrapWithLogging('softDelete:isDeleted', wrapHandler(handleIsDeleted))
  );
}

/**
 * Unregister all soft delete IPC handlers
 */
export function unregisterSoftDeleteHandlers(): void {
  ipcMain.removeHandler('softDelete:delete');
  ipcMain.removeHandler('softDelete:restore');
  ipcMain.removeHandler('softDelete:permanentDelete');
  ipcMain.removeHandler('softDelete:cleanup');
  ipcMain.removeHandler('softDelete:list');
  ipcMain.removeHandler('softDelete:isDeleted');
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
