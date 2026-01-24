/**
 * Claude Code IPC Handlers
 *
 * Handlers for Claude Code task automation (start, resume, pause, status).
 * Integrates with ClaudeCodeService and TerminalManager.
 */

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { databaseService } from '../services/database.js';
import { claudeCodeService, type ClaudeCodeOptions } from '../services/claude-code.js';
import { prdParser } from '../services/prd-parser.js';
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
  /** @deprecated No longer used - resume uses SIGCONT on existing terminal */
  sessionId?: string;
  /** @deprecated No longer used - resume uses SIGCONT on existing terminal */
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
  if (claudeCodeService.hasActiveProcess(data.taskId)) {
    throw new Error('Claude Code is already running for this task');
  }

  // Detect PRD phase reference in task description
  let prdPhaseNumber: number | undefined;
  let prdPhaseName: string | undefined;
  let scopedPrdContent: string | undefined;

  const taskDescription = data.taskDescription || '';
  const detectedPhaseNumber = prdParser.detectPhaseReference(taskDescription);

  if (detectedPhaseNumber !== null) {
    console.log(`[claude:startTask] Detected phase reference: Phase ${detectedPhaseNumber}`);

    // Try to read PRD.md from the project path
    const prdPath = path.join(data.projectPath, 'PRD.md');
    try {
      const prdContent = await fs.readFile(prdPath, 'utf-8');
      const detectedPhase = prdParser.getPhase(prdContent, detectedPhaseNumber);

      if (detectedPhase) {
        prdPhaseNumber = detectedPhase.number;
        prdPhaseName = detectedPhase.name;
        scopedPrdContent = prdParser.formatPhaseAsPrompt(detectedPhase);

        console.log(`[claude:startTask] Extracted Phase ${prdPhaseNumber}: ${prdPhaseName}`);
        console.log(`[claude:startTask] Scoped PRD content length: ${scopedPrdContent.length} chars`);

        // Update the task in the database with phase info
        await prisma.task.update({
          where: { id: data.taskId },
          data: {
            prdPhaseNumber: detectedPhase.number,
            prdPhaseName: detectedPhase.name,
            scopedPrdContent: prdParser.formatPhaseAsPrompt(detectedPhase),
          },
        });
        console.log(`[claude:startTask] Updated task with PRD phase info`);
      } else {
        console.log(`[claude:startTask] Phase ${detectedPhaseNumber} not found in PRD.md`);
      }
    } catch (error) {
      // PRD.md not found or read error - continue without phase scoping
      console.log(`[claude:startTask] Could not read PRD.md: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Build options for Claude Code service
  const options: ClaudeCodeOptions = {
    taskId: data.taskId,
    taskTitle: data.taskTitle,
    taskDescription: taskDescription,
    projectPath: data.projectPath,
    sessionId: data.sessionId,
    worktreeId: data.worktreeId,
    maxTurns: data.maxTurns,
    maxBudget: data.maxBudget,
    allowedTools: data.allowedTools,
    appendSystemPrompt: data.appendSystemPrompt,
    prdPhaseNumber,
    prdPhaseName,
    scopedPrdContent,
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
        claudeTerminalId: terminalId,
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

    // Send started event to renderer (check window exists during shutdown)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`claude:started:${data.taskId}`, {
        taskId: data.taskId,
        terminalId,
        sessionId: data.sessionId,
      });
    }
  } catch (error) {
    // Rollback database status if terminal spawn fails
    await prisma.task.update({
      where: { id: data.taskId },
      data: {
        status: 'PENDING', // Rollback to PENDING since it never started
        claudeStatus: 'FAILED',
        claudeTerminalId: null,
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
 * Resume a Claude Code task by sending SIGCONT to the paused terminal.
 * This continues a process that was previously suspended with SIGSTOP.
 */
async function handleResumeTask(
  _event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow,
  data: ResumeTaskInput
): Promise<ResumeTaskResponse> {
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

  // Verify task is in PAUSED state
  if (task.claudeStatus !== 'PAUSED') {
    throw new Error(`Cannot resume task: task is not paused (current status: ${task.claudeStatus})`);
  }

  // Check that the process still exists (process was suspended, not killed)
  const terminalId = `claude-${data.taskId}`;
  if (!claudeCodeService.hasActiveProcess(data.taskId)) {
    throw new Error('Cannot resume task: Claude process no longer exists. The task may need to be restarted.');
  }

  // Resume the Claude Code task using SIGCONT
  const success = claudeCodeService.resumeTask(data.taskId, mainWindow);

  if (!success) {
    throw new Error('Failed to resume Claude Code: SIGCONT signal failed');
  }

  // Update task status to RUNNING on success
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      claudeStatus: 'RUNNING',
    },
  });

  // Add a log entry for resuming Claude Code
  await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      type: 'info',
      message: 'Resumed Claude Code session via SIGCONT',
      metadata: JSON.stringify({}),
    },
  });

  console.log(`[claude:resumeTask] Successfully resumed task ${data.taskId} via SIGCONT`);

  return {
    terminalId,
  };
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
  if (!claudeCodeService.hasActiveProcess(data.taskId)) {
    throw new Error('Claude Code is not running for this task');
  }

  // Try to pause the process (sends SIGSTOP)
  const success = claudeCodeService.pauseTask(data.taskId);

  if (!success) {
    throw new Error('Failed to pause Claude Code terminal');
  }

  // Only update database if pause succeeded
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      claudeStatus: 'PAUSED',
    },
  });

  // Add a log entry for pausing Claude Code
  await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      type: 'info',
      message: 'Paused Claude Code session via SIGSTOP',
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
    // Return graceful default response instead of throwing
    // This prevents status polling from crashing when task is deleted
    return {
      isRunning: false,
      terminalId: null,
      sessionId: null,
    };
  }

  // Check if Claude is running for this task
  const terminalId = `claude-${data.taskId}`;
  const isRunning = claudeCodeService.hasActiveProcess(data.taskId);

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
    // Return graceful default response instead of throwing
    // This prevents status polling from crashing when task is deleted
    return {
      isRunning: false,
      terminalId: null,
      sessionId: null,
      claudeStatus: 'IDLE' as ClaudeTaskStatus,
      startedAt: null,
      completedAt: null,
    };
  }

  // Check if Claude process is currently running
  const terminalId = `claude-${data.taskId}`;
  const isRunning = claudeCodeService.hasActiveProcess(data.taskId);

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
