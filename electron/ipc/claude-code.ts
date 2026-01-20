/**
 * Claude Code IPC Handlers
 *
 * Handlers for Claude Code task automation (start, resume, pause, status).
 * Integrates with ClaudeCodeService and TerminalManager.
 */

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { claudeCodeService, type ClaudeCodeOptions } from '../services/claude-code.js';
import { terminalManager } from '../services/terminal.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * Input types for IPC handlers
 */
export interface StartTaskInput {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  projectPath: string;
  sessionId: string;
  worktreeId?: string;
  maxTurns?: number;
  maxBudget?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
}

export interface ResumeTaskInput {
  taskId: string;
  sessionId: string;
  prompt?: string;
}

export interface PauseTaskInput {
  taskId: string;
}

export interface GetTaskStatusInput {
  taskId: string;
}

/**
 * Response types for IPC handlers
 */
export interface StartTaskResponse {
  terminalId: string;
  sessionId: string;
}

export interface ResumeTaskResponse {
  terminalId: string;
}

export interface TaskStatusResponse {
  isRunning: boolean;
  terminalId: string | null;
  sessionId: string | null;
}

export interface ActiveTaskResponse {
  isRunning: boolean;
  terminalId: string | null;
  sessionId: string | null;
  claudeStatus: ClaudeTaskStatus;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Import ClaudeTaskStatus from types
 */
type ClaudeTaskStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'AWAITING_INPUT';

/**
 * Start a Claude Code task
 */
async function handleStartTask(
  _event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow,
  data: StartTaskInput
): Promise<StartTaskResponse> {
  // Validate required fields
  if (!data.taskId || !data.taskTitle || !data.projectPath || !data.sessionId) {
    console.error('claude:startTask validation failed. Received data:', {
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      projectPath: data.projectPath,
      sessionId: data.sessionId,
      taskDescription: data.taskDescription,
    });
    throw IPCErrors.invalidArguments(
      'Task ID, title, project path, and session ID are required'
    );
  }

  const prisma = databaseService.getClient();

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { project: true },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if Claude is already running for this task
  const terminalId = `claude-${data.taskId}`;
  if (terminalManager.has(terminalId)) {
    throw new Error('Claude Code is already running for this task');
  }

  // Build options for Claude Code service
  const options: ClaudeCodeOptions = {
    taskId: data.taskId,
    taskTitle: data.taskTitle,
    taskDescription: data.taskDescription || '',
    projectPath: data.projectPath,
    sessionId: data.sessionId,
    worktreeId: data.worktreeId,
    maxTurns: data.maxTurns,
    maxBudget: data.maxBudget,
    allowedTools: data.allowedTools,
    appendSystemPrompt: data.appendSystemPrompt,
  };

  // Update task status to STARTING before spawning terminal
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      claudeStatus: 'STARTING',
      claudeSessionId: data.sessionId,
    },
  });

  let result;
  try {
    // Start the Claude Code task
    result = await claudeCodeService.startTask(options, mainWindow);

    // Update task with all Claude-related fields after successful spawn
    await prisma.task.update({
      where: { id: data.taskId },
      data: {
        status: 'IN_PROGRESS',
        claudeStatus: 'RUNNING',
        claudeStartedAt: new Date(),
      },
    });

    // Add a log entry for starting Claude Code
    await prisma.taskLog.create({
      data: {
        taskId: data.taskId,
        type: 'info',
        message: 'Starting Claude Code automation',
        metadata: JSON.stringify({
          sessionId: data.sessionId,
          terminalId,
          maxTurns: data.maxTurns,
          maxBudget: data.maxBudget,
        }),
      },
    });

    // Send started event to renderer
    mainWindow.webContents.send(`claude:started:${data.taskId}`, {
      taskId: data.taskId,
      terminalId,
      sessionId: data.sessionId,
    });
  } catch (error) {
    // Rollback database status if terminal spawn fails
    await prisma.task.update({
      where: { id: data.taskId },
      data: {
        status: 'PENDING', // Rollback to PENDING since it never started
        claudeStatus: 'FAILED',
        claudeCompletedAt: new Date(),
      },
    });

    // Log the error
    await prisma.taskLog.create({
      data: {
        taskId: data.taskId,
        type: 'error',
        message: 'Failed to start Claude Code automation',
        metadata: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: data.sessionId,
        }),
      },
    });

    console.error('[claude:startTask] Failed to start Claude Code:', error);
    throw new Error(
      `Failed to start Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Resume a Claude Code task
 */
async function handleResumeTask(
  _event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow,
  data: ResumeTaskInput
): Promise<ResumeTaskResponse> {
  // Validate required fields
  if (!data.taskId || !data.sessionId) {
    throw IPCErrors.invalidArguments('Task ID and session ID are required');
  }

  const prisma = databaseService.getClient();

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { project: true },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (!task.project.targetPath) {
    throw new Error('Project has no target path configured');
  }

  // Check if Claude is already running for this task
  const terminalId = `claude-${data.taskId}`;
  if (terminalManager.has(terminalId)) {
    throw new Error('Claude Code is already running for this task');
  }

  // Update task status to IN_PROGRESS and RUNNING
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      status: 'IN_PROGRESS',
      claudeStatus: 'RUNNING',
      claudeStartedAt: new Date(),
    },
  });

  // Add a log entry for resuming Claude Code
  await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      type: 'info',
      message: 'Resuming Claude Code session',
      metadata: JSON.stringify({
        sessionId: data.sessionId,
      }),
    },
  });

  let result;
  try {
    // Resume the Claude Code task
    result = await claudeCodeService.resumeTask(
      {
        taskId: data.taskId,
        sessionId: data.sessionId,
        projectPath: task.project.targetPath,
        prompt: data.prompt,
      },
      mainWindow
    );
  } catch (error) {
    // Rollback database status if resume fails
    await prisma.task.update({
      where: { id: data.taskId },
      data: {
        status: 'PENDING', // Rollback to PENDING since resume failed
        claudeStatus: 'FAILED',
        claudeCompletedAt: new Date(),
      },
    });

    // Log the error
    await prisma.taskLog.create({
      data: {
        taskId: data.taskId,
        type: 'error',
        message: 'Failed to resume Claude Code session',
        metadata: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: data.sessionId,
        }),
      },
    });

    console.error('[claude:resumeTask] Failed to resume Claude Code:', error);
    throw new Error(
      `Failed to resume Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Pause a Claude Code task
 */
async function handlePauseTask(
  _event: IpcMainInvokeEvent,
  data: PauseTaskInput
): Promise<void> {
  // Validate required fields
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if Claude is running for this task
  const terminalId = `claude-${data.taskId}`;
  if (!terminalManager.has(terminalId)) {
    throw new Error('Claude Code is not running for this task');
  }

  // Pause the Claude Code task (sends Ctrl+C)
  claudeCodeService.pauseTask(data.taskId);

  // Add a log entry for pausing Claude Code
  await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      type: 'info',
      message: 'Pausing Claude Code session',
      metadata: JSON.stringify({}),
    },
  });
}

/**
 * Get Claude Code task status
 */
async function handleGetTaskStatus(
  _event: IpcMainInvokeEvent,
  data: GetTaskStatusInput
): Promise<TaskStatusResponse> {
  // Validate required fields
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if Claude is running for this task
  const terminalId = `claude-${data.taskId}`;
  const isRunning = terminalManager.has(terminalId);

  // For simplicity, we use the task ID as session ID
  // In a real implementation, you might want to store the session ID in the database
  const sessionId = isRunning ? terminalId : null;

  return {
    isRunning,
    terminalId: isRunning ? terminalId : null,
    sessionId,
  };
}

/**
 * Get active Claude task information including runtime status
 */
async function handleGetActiveTask(
  _event: IpcMainInvokeEvent,
  data: GetTaskStatusInput
): Promise<ActiveTaskResponse> {
  // Validate required fields
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Get task with Claude-related fields
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    select: {
      id: true,
      claudeSessionId: true,
      claudeStatus: true,
      claudeStartedAt: true,
      claudeCompletedAt: true,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if Claude terminal is currently running
  const terminalId = `claude-${data.taskId}`;
  const isRunning = terminalManager.has(terminalId);

  return {
    isRunning,
    terminalId: isRunning ? terminalId : null,
    sessionId: task.claudeSessionId,
    claudeStatus: task.claudeStatus as ClaudeTaskStatus,
    startedAt: task.claudeStartedAt?.toISOString() || null,
    completedAt: task.claudeCompletedAt?.toISOString() || null,
  };
}

/**
 * Register all Claude Code IPC handlers.
 *
 * @param mainWindow - The main BrowserWindow instance for output streaming
 */
export function registerClaudeCodeHandlers(mainWindow: BrowserWindow): void {
  // claude:startTask - Start Claude Code for a task
  ipcMain.handle(
    'claude:startTask',
    wrapWithLogging(
      'claude:startTask',
      wrapHandler(async (event, data: StartTaskInput) => {
        return handleStartTask(event, mainWindow, data);
      })
    )
  );

  // claude:resumeTask - Resume an existing Claude session
  ipcMain.handle(
    'claude:resumeTask',
    wrapWithLogging(
      'claude:resumeTask',
      wrapHandler(async (event, data: ResumeTaskInput) => {
        return handleResumeTask(event, mainWindow, data);
      })
    )
  );

  // claude:pauseTask - Pause Claude session
  ipcMain.handle(
    'claude:pauseTask',
    wrapWithLogging('claude:pauseTask', wrapHandler(handlePauseTask))
  );

  // claude:getTaskStatus - Get current Claude status for task
  ipcMain.handle(
    'claude:getTaskStatus',
    wrapWithLogging('claude:getTaskStatus', wrapHandler(handleGetTaskStatus))
  );

  // claude:getActiveTask - Get detailed active task information
  ipcMain.handle(
    'claude:getActiveTask',
    wrapWithLogging('claude:getActiveTask', wrapHandler(handleGetActiveTask))
  );
}

/**
 * Unregister all Claude Code IPC handlers
 */
export function unregisterClaudeCodeHandlers(): void {
  ipcMain.removeHandler('claude:startTask');
  ipcMain.removeHandler('claude:resumeTask');
  ipcMain.removeHandler('claude:pauseTask');
  ipcMain.removeHandler('claude:getTaskStatus');
  ipcMain.removeHandler('claude:getActiveTask');
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
