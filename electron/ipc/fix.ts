/**
 * Fix IPC Handlers
 *
 * Handlers for fix workflow IPC channels.
 * Allows the renderer to start, monitor, and cancel fix operations.
 */

import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { fixService } from '../services/fix-service.js';
import type { FixType } from '../../src/types/ipc.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type {
  StartFixInput,
  FixProgressResponse,
} from '../../src/types/ipc.js';

/**
 * Start a fix operation for specified findings
 */
async function handleStartFix(
  _event: IpcMainInvokeEvent,
  data: StartFixInput
): Promise<void> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  if (!data.fixType) {
    throw IPCErrors.invalidArguments('Fix type is required');
  }

  if (!data.findings || !Array.isArray(data.findings)) {
    throw IPCErrors.invalidArguments('Findings array is required');
  }

  await fixService.startFix(data.taskId, data.fixType, data.findings);
}

/**
 * Get fix progress for a task and fix type
 */
async function handleGetFixProgress(
  _event: IpcMainInvokeEvent,
  data: { taskId: string; fixType: FixType }
): Promise<FixProgressResponse | null> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  if (!data.fixType) {
    throw IPCErrors.invalidArguments('Fix type is required');
  }

  return fixService.getFixProgress(data.taskId, data.fixType);
}

/**
 * Cancel a fix operation
 */
async function handleCancelFix(
  _event: IpcMainInvokeEvent,
  data: { taskId: string; fixType: FixType }
): Promise<void> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  if (!data.fixType) {
    throw IPCErrors.invalidArguments('Fix type is required');
  }

  await fixService.cancelFix(data.taskId, data.fixType);
}

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

/**
 * Register all fix-related IPC handlers
 *
 * @param mainWindow - The main BrowserWindow for IPC events
 */
export function registerFixHandlers(mainWindow: BrowserWindow): void {
  // Set the main window for the fix service
  fixService.setMainWindow(mainWindow);

  // fix:start - Start a fix operation for specified findings
  ipcMain.handle(
    'fix:start',
    wrapWithLogging('fix:start', wrapHandler(handleStartFix))
  );

  // fix:getProgress - Get fix progress for a task and fix type
  ipcMain.handle(
    'fix:getProgress',
    wrapWithLogging('fix:getProgress', wrapHandler(handleGetFixProgress))
  );

  // fix:cancel - Cancel a fix operation
  ipcMain.handle(
    'fix:cancel',
    wrapWithLogging('fix:cancel', wrapHandler(handleCancelFix))
  );
}

/**
 * Unregister all fix-related IPC handlers
 */
export function unregisterFixHandlers(): void {
  ipcMain.removeHandler('fix:start');
  ipcMain.removeHandler('fix:getProgress');
  ipcMain.removeHandler('fix:cancel');
}
