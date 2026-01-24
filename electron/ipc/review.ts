/**
 * Review IPC Handlers
 *
 * Handlers for AI review workflow IPC channels.
 */

import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { reviewService } from '../services/review-service.js';
import type { ReviewType } from '../services/review-agent-pool.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * Input for starting a review
 */
interface StartReviewInput {
  taskId: string;
  reviewTypes?: ReviewType[];
}

/**
 * Start AI reviews for a task
 */
async function handleStartReview(
  _event: IpcMainInvokeEvent,
  data: StartReviewInput
): Promise<void> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  await reviewService.startReview(data.taskId, data.reviewTypes);
}

/**
 * Get review progress for a task
 */
async function handleGetProgress(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<ReturnType<typeof reviewService.getReviewProgress>> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  return reviewService.getReviewProgress(taskId);
}

/**
 * Cancel reviews for a task
 */
async function handleCancelReview(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<void> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  await reviewService.cancelReview(taskId);
}

/**
 * Get task history (activities and summary)
 */
async function handleGetHistory(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<ReturnType<typeof reviewService.getTaskHistory>> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  return reviewService.getTaskHistory(taskId);
}

/**
 * Get findings for a specific review
 */
async function handleGetFindings(
  _event: IpcMainInvokeEvent,
  data: { taskId: string; reviewType: ReviewType }
): Promise<unknown[] | null> {
  if (!data.taskId || !data.reviewType) {
    throw IPCErrors.invalidArguments('Task ID and review type are required');
  }

  return reviewService.getReviewFindings(data.taskId, data.reviewType);
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
 * Register all review-related IPC handlers
 *
 * @param mainWindow - The main BrowserWindow for IPC events
 */
export function registerReviewHandlers(mainWindow: BrowserWindow): void {
  // Set the main window for the review service
  reviewService.setMainWindow(mainWindow);

  // review:start - Start AI reviews for a task
  ipcMain.handle(
    'review:start',
    wrapWithLogging('review:start', wrapHandler(handleStartReview))
  );

  // review:getProgress - Get review progress for a task
  ipcMain.handle(
    'review:getProgress',
    wrapWithLogging('review:getProgress', wrapHandler(handleGetProgress))
  );

  // review:cancel - Cancel reviews for a task
  ipcMain.handle(
    'review:cancel',
    wrapWithLogging('review:cancel', wrapHandler(handleCancelReview))
  );

  // review:getHistory - Get task history (activities and summary)
  ipcMain.handle(
    'review:getHistory',
    wrapWithLogging('review:getHistory', wrapHandler(handleGetHistory))
  );

  // review:getFindings - Get findings for a specific review
  ipcMain.handle(
    'review:getFindings',
    wrapWithLogging('review:getFindings', wrapHandler(handleGetFindings))
  );
}

/**
 * Unregister all review-related IPC handlers
 */
export function unregisterReviewHandlers(): void {
  ipcMain.removeHandler('review:start');
  ipcMain.removeHandler('review:getProgress');
  ipcMain.removeHandler('review:cancel');
  ipcMain.removeHandler('review:getHistory');
  ipcMain.removeHandler('review:getFindings');
}
