/**
 * Notification IPC Handlers
 *
 * Handlers for notification-related IPC channels.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { notificationService } from '../services/notifications.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * Notification data types for IPC
 */
export interface ShowNotificationInput {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

export interface TaskCompletedNotificationInput {
  taskId: string;
  taskTitle: string;
  projectName?: string;
}

export interface TerminalErrorNotificationInput {
  terminalName: string;
  error: string;
}

export interface AssignmentNotificationInput {
  taskId: string;
  taskTitle: string;
  projectName?: string;
  assignerName: string;
}

/**
 * Check if notifications are supported
 */
async function handleIsSupported(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  return notificationService.isAvailable();
}

/**
 * Request notification permission
 */
async function handleRequestPermission(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  return notificationService.requestPermission();
}

/**
 * Show a generic notification
 */
async function handleShow(
  _event: IpcMainInvokeEvent,
  data: ShowNotificationInput
): Promise<void> {
  if (!data.title || !data.body) {
    throw IPCErrors.invalidArguments('Title and body are required');
  }

  notificationService.showNotification(data.title, data.body, {
    ...(data.silent !== undefined && { silent: data.silent }),
    ...(data.urgency !== undefined && { urgency: data.urgency }),
  });
}

/**
 * Show task completed notification
 */
async function handleTaskCompleted(
  _event: IpcMainInvokeEvent,
  data: TaskCompletedNotificationInput
): Promise<void> {
  if (!data.taskId || !data.taskTitle) {
    throw IPCErrors.invalidArguments('Task ID and title are required');
  }

  notificationService.showTaskCompleted({
    id: data.taskId,
    title: data.taskTitle,
    ...(data.projectName !== undefined && { projectName: data.projectName }),
  });
}

/**
 * Show terminal error notification
 */
async function handleTerminalError(
  _event: IpcMainInvokeEvent,
  data: TerminalErrorNotificationInput
): Promise<void> {
  if (!data.terminalName || !data.error) {
    throw IPCErrors.invalidArguments('Terminal name and error are required');
  }

  notificationService.showTerminalError(data.terminalName, data.error);
}

/**
 * Show assignment notification
 */
async function handleAssignment(
  _event: IpcMainInvokeEvent,
  data: AssignmentNotificationInput
): Promise<void> {
  if (!data.taskId || !data.taskTitle || !data.assignerName) {
    throw IPCErrors.invalidArguments('Task ID, title, and assigner name are required');
  }

  notificationService.showAssignment(
    {
      id: data.taskId,
      title: data.taskTitle,
      ...(data.projectName !== undefined && { projectName: data.projectName }),
    },
    data.assignerName
  );
}

/**
 * Register all notification-related IPC handlers
 */
export function registerNotificationHandlers(): void {
  // notifications:isSupported - Check if notifications are supported
  ipcMain.handle(
    'notifications:isSupported',
    wrapWithLogging('notifications:isSupported', wrapHandler(handleIsSupported))
  );

  // notifications:requestPermission - Request notification permission
  ipcMain.handle(
    'notifications:requestPermission',
    wrapWithLogging('notifications:requestPermission', wrapHandler(handleRequestPermission))
  );

  // notifications:show - Show a generic notification
  ipcMain.handle(
    'notifications:show',
    wrapWithLogging('notifications:show', wrapHandler(handleShow))
  );

  // notifications:taskCompleted - Show task completed notification
  ipcMain.handle(
    'notifications:taskCompleted',
    wrapWithLogging('notifications:taskCompleted', wrapHandler(handleTaskCompleted))
  );

  // notifications:terminalError - Show terminal error notification
  ipcMain.handle(
    'notifications:terminalError',
    wrapWithLogging('notifications:terminalError', wrapHandler(handleTerminalError))
  );

  // notifications:assignment - Show assignment notification
  ipcMain.handle(
    'notifications:assignment',
    wrapWithLogging('notifications:assignment', wrapHandler(handleAssignment))
  );
}

/**
 * Unregister all notification-related IPC handlers
 */
export function unregisterNotificationHandlers(): void {
  ipcMain.removeHandler('notifications:isSupported');
  ipcMain.removeHandler('notifications:requestPermission');
  ipcMain.removeHandler('notifications:show');
  ipcMain.removeHandler('notifications:taskCompleted');
  ipcMain.removeHandler('notifications:terminalError');
  ipcMain.removeHandler('notifications:assignment');
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
