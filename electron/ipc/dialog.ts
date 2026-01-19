/**
 * Dialog IPC Handlers
 *
 * Handlers for native dialog IPC channels (file/directory selection, alerts, etc).
 */

import {
  dialog,
  ipcMain,
  BrowserWindow,
  type IpcMainInvokeEvent,
} from 'electron';
import { wrapHandler } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * Options for opening a directory dialog
 */
export interface OpenDirectoryOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  message?: string; // macOS only
}

/**
 * Result from opening a directory dialog
 */
export interface OpenDirectoryResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * Handle opening a directory selection dialog
 */
async function handleOpenDirectory(
  event: IpcMainInvokeEvent,
  options?: OpenDirectoryOptions
): Promise<OpenDirectoryResult> {
  // Get the window that triggered this request
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);

  // Build dialog options - only include defined values to avoid TypeScript exactOptionalPropertyTypes issues
  const dialogOptions: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  };

  if (options?.title) {
    dialogOptions.title = options.title;
  }
  if (options?.defaultPath) {
    dialogOptions.defaultPath = options.defaultPath;
  }
  if (options?.buttonLabel) {
    dialogOptions.buttonLabel = options.buttonLabel;
  }
  if (options?.message) {
    dialogOptions.message = options.message;
  }

  // Show the dialog
  let result: Electron.OpenDialogReturnValue;
  if (window) {
    // Show as a sheet attached to the window (better UX on macOS)
    result = await dialog.showOpenDialog(window, dialogOptions);
  } else {
    // Fallback to showing without a parent window
    result = await dialog.showOpenDialog(dialogOptions);
  }

  return {
    canceled: result.canceled,
    filePaths: result.filePaths,
  };
}

/**
 * Register all dialog-related IPC handlers
 */
export function registerDialogHandlers(): void {
  // dialog:openDirectory - Open a directory selection dialog
  ipcMain.handle(
    'dialog:openDirectory',
    wrapWithLogging('dialog:openDirectory', wrapHandler(handleOpenDirectory))
  );
}

/**
 * Unregister all dialog-related IPC handlers (useful for testing)
 */
export function unregisterDialogHandlers(): void {
  ipcMain.removeHandler('dialog:openDirectory');
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
