/**
 * App IPC Handlers
 *
 * Handlers for application-level IPC channels (version, platform, paths).
 */

import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import os from 'node:os';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * App version response type
 */
export interface AppVersion {
  version: string;
  name: string;
  isDev: boolean;
}

/**
 * Combined app info response type
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
  isDev: boolean;
}

/**
 * App platform response type
 */
export interface AppPlatform {
  platform: NodeJS.Platform;
  arch: string;
  osVersion: string;
}

/**
 * Valid app path names
 */
type AppPathName =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | 'logs';

/**
 * Validate that a path name is valid
 */
function isValidPathName(name: string): name is AppPathName {
  const validPaths: AppPathName[] = [
    'home',
    'appData',
    'userData',
    'temp',
    'desktop',
    'documents',
    'downloads',
    'music',
    'pictures',
    'videos',
    'logs',
  ];
  return validPaths.includes(name as AppPathName);
}

/**
 * Get app version information
 */
function handleGetVersion(): Promise<AppVersion> {
  return Promise.resolve({
    version: app.getVersion(),
    name: app.getName(),
    isDev: !app.isPackaged,
  });
}

/**
 * Get combined app info
 */
function handleGetInfo(): Promise<AppInfo> {
  return Promise.resolve({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isDev: !app.isPackaged,
  });
}

/**
 * Get platform information
 */
function handleGetPlatform(): Promise<AppPlatform> {
  return Promise.resolve({
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
  });
}

/**
 * Get an app path
 */
function handleGetPath(
  _event: IpcMainInvokeEvent,
  name: string
): Promise<string> {
  if (!isValidPathName(name)) {
    return Promise.reject(IPCErrors.invalidArguments(`Invalid path name: ${name}`));
  }

  return Promise.resolve(app.getPath(name));
}

/**
 * Register all app-related IPC handlers
 */
export function registerAppHandlers(): void {
  // app:getInfo - Get combined app info
  ipcMain.handle(
    'app:getInfo',
    wrapWithLogging('app:getInfo', wrapHandler(handleGetInfo))
  );

  // app:getVersion - Get app version info
  ipcMain.handle(
    'app:getVersion',
    wrapWithLogging('app:getVersion', wrapHandler(handleGetVersion))
  );

  // app:getPlatform - Get platform info
  ipcMain.handle(
    'app:getPlatform',
    wrapWithLogging('app:getPlatform', wrapHandler(handleGetPlatform))
  );

  // app:getPath - Get a specific app path
  ipcMain.handle(
    'app:getPath',
    wrapWithLogging('app:getPath', wrapHandler(handleGetPath))
  );
}

/**
 * Unregister all app-related IPC handlers (useful for testing)
 */
export function unregisterAppHandlers(): void {
  ipcMain.removeHandler('app:getInfo');
  ipcMain.removeHandler('app:getVersion');
  ipcMain.removeHandler('app:getPlatform');
  ipcMain.removeHandler('app:getPath');
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
