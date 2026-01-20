/**
 * Terminal IPC Handlers
 *
 * Handlers for terminal-related IPC channels (create, write, resize, close, list).
 * Integrates with TerminalManager for node-pty process management and streams output
 * via webContents to the renderer process.
 */

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { terminalManager } from '../services/terminal.js';
import { captureSessionInsight } from '../services/session-capture.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Terminal } from '@prisma/client';

/**
 * Terminal data types for IPC
 */
export interface CreateTerminalInput {
  projectId: string;
  name?: string;
  cwd?: string;
}

export interface WriteTerminalInput {
  id: string;
  data: string;
}

export interface ResizeTerminalInput {
  id: string;
  cols: number;
  rows: number;
}

export interface CreateTerminalResponse {
  id: string;
  name: string;
  pid: number;
}

/**
 * Create a new terminal
 */
async function handleCreateTerminal(
  _event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow,
  data: CreateTerminalInput
): Promise<CreateTerminalResponse> {
  if (!data.projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Generate terminal name if not provided
  const terminalName = data.name || `Terminal ${Date.now()}`;

  // Create database record first
  const terminal = await prisma.terminal.create({
    data: {
      name: terminalName,
      projectId: data.projectId,
      status: 'running',
    },
  });

  try {
    // Determine working directory
    const cwd = data.cwd || project.targetPath;

    // Spawn the terminal process
    const { id, pid } = terminalManager.spawn(terminal.id, terminalName, {
      ...(cwd && { cwd }),
      onData: (outputData: string) => {
        // Stream output to renderer process
        mainWindow.webContents.send(`terminal:output:${terminal.id}`, outputData);
      },
      onExit: (code: number) => {
        // Notify renderer of terminal exit
        mainWindow.webContents.send(`terminal:exit:${terminal.id}`, code);

        // Delete terminal from database when process exits
        // This handles both manual close (where terminal:close already deleted it)
        // and natural exit (where the process terminated on its own)
        prisma.terminal
          .deleteMany({
            where: { id: terminal.id },
          })
          .catch((error) => {
            // Log any unexpected errors (deleteMany doesn't throw P2025)
            console.error(
              `[Terminal IPC] Failed to delete terminal on exit:`,
              error
            );
          });
      },
    });

    // Update database with PID
    await prisma.terminal.update({
      where: { id: terminal.id },
      data: { pid },
    });

    return {
      id,
      name: terminalName,
      pid,
    };
  } catch (error) {
    // Clean up database record if terminal spawn failed
    await prisma.terminal.deleteMany({
      where: { id: terminal.id },
    }).catch((deleteError) => {
      console.error(
        `[Terminal IPC] Failed to clean up terminal record:`,
        deleteError
      );
    });

    throw error;
  }
}

/**
 * Write data to a terminal
 */
async function handleWriteTerminal(
  _event: IpcMainInvokeEvent,
  data: WriteTerminalInput
): Promise<void> {
  if (!data.id || data.data === undefined) {
    throw IPCErrors.invalidArguments('Terminal ID and data are required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists in database
  const terminal = await prisma.terminal.findUnique({
    where: { id: data.id },
  });

  if (!terminal) {
    throw new Error('Terminal not found');
  }

  if (terminal.status !== 'running') {
    throw new Error(`Terminal is not running (status: ${terminal.status})`);
  }

  // Write to the terminal process
  terminalManager.write(data.id, data.data);
}

/**
 * Resize a terminal
 */
async function handleResizeTerminal(
  _event: IpcMainInvokeEvent,
  data: ResizeTerminalInput
): Promise<void> {
  if (!data.id || !data.cols || !data.rows) {
    throw IPCErrors.invalidArguments('Terminal ID, cols, and rows are required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists in database
  const terminal = await prisma.terminal.findUnique({
    where: { id: data.id },
  });

  if (!terminal) {
    // Gracefully handle the case where terminal was already deleted
    // This can happen during component unmount when resize events fire
    // after the terminal has been closed
    console.debug(`[Terminal IPC] Resize event for non-existent terminal ${data.id} - ignoring`);
    return;
  }

  // Resize the terminal process
  terminalManager.resize(data.id, data.cols, data.rows);
}

/**
 * Close a terminal
 */
async function handleCloseTerminal(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Terminal ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists in database
  const terminal = await prisma.terminal.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!terminal) {
    throw new Error('Terminal not found');
  }

  // Capture session output before closing (if buffer has content)
  try {
    const output = terminalManager.getBuffer(id);
    if (output.trim().length > 0) {
      await captureSessionInsight(
        id,
        output,
        terminal.projectId,
        terminal.name
      );
      console.log(`[Terminal IPC] Captured session insight for terminal ${id}`);
    }
  } catch (error) {
    // Log error but don't fail the close operation
    console.error(`[Terminal IPC] Failed to capture session insight:`, error);
  }

  // Kill the terminal process
  try {
    terminalManager.kill(id);
  } catch (error) {
    // Log error but continue to delete from database
    console.error(`[Terminal IPC] Failed to kill terminal process:`, error);
  }

  // Delete terminal from database (instead of just updating status)
  // Use deleteMany to avoid P2025 error if terminal was already deleted
  await prisma.terminal.deleteMany({
    where: { id },
  });
}

/**
 * List all terminals for a project
 */
async function handleListTerminals(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<Terminal[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const terminals = await prisma.terminal.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return terminals;
}

/**
 * Manually capture a terminal session insight
 */
async function handleCaptureSession(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<{ memoryId: string }> {
  if (!id) {
    throw IPCErrors.invalidArguments('Terminal ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists
  const terminal = await prisma.terminal.findUnique({
    where: { id },
  });

  if (!terminal) {
    throw new Error('Terminal not found');
  }

  // Get the output buffer
  const output = terminalManager.getBuffer(id);

  if (output.trim().length === 0) {
    throw new Error('No output to capture');
  }

  // Capture the session
  const memoryId = await captureSessionInsight(
    id,
    output,
    terminal.projectId,
    terminal.name
  );

  if (!memoryId) {
    throw new Error('No meaningful activity to capture');
  }

  // Clear the buffer after successful capture
  terminalManager.clearBuffer(id);

  return { memoryId };
}

/**
 * Pause a terminal process
 */
async function handlePauseTerminal(
  _event: IpcMainInvokeEvent,
  terminalId: string
): Promise<boolean> {
  if (!terminalId) {
    throw IPCErrors.invalidArguments('Terminal ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists in database
  const terminal = await prisma.terminal.findUnique({
    where: { id: terminalId },
  });

  if (!terminal) {
    throw new Error('Terminal not found');
  }

  if (terminal.status !== 'running') {
    throw new Error(`Terminal is not running (status: ${terminal.status})`);
  }

  // Pause the terminal process
  const success = terminalManager.pauseTerminal(terminalId);

  if (!success) {
    throw new Error('Failed to pause terminal process');
  }

  // Update terminal status in database
  await prisma.terminal.update({
    where: { id: terminalId },
    data: { status: 'suspended' },
  });

  return success;
}

/**
 * Resume a paused terminal process
 */
async function handleResumeTerminal(
  _event: IpcMainInvokeEvent,
  terminalId: string
): Promise<boolean> {
  if (!terminalId) {
    throw IPCErrors.invalidArguments('Terminal ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify terminal exists in database
  const terminal = await prisma.terminal.findUnique({
    where: { id: terminalId },
  });

  if (!terminal) {
    throw new Error('Terminal not found');
  }

  if (terminal.status !== 'suspended') {
    throw new Error(`Terminal is not paused (status: ${terminal.status})`);
  }

  // Resume the terminal process
  const success = terminalManager.resumeTerminal(terminalId);

  if (!success) {
    throw new Error('Failed to resume terminal process');
  }

  // Update terminal status in database
  await prisma.terminal.update({
    where: { id: terminalId },
    data: { status: 'running' },
  });

  return success;
}

/**
 * Register all terminal-related IPC handlers.
 * Requires mainWindow reference for output streaming.
 *
 * @param mainWindow - The main BrowserWindow instance for output streaming
 */
export function registerTerminalHandlers(mainWindow: BrowserWindow): void {
  // terminal:create - Create a new terminal
  ipcMain.handle(
    'terminal:create',
    wrapWithLogging('terminal:create', wrapHandler(async (event, data: CreateTerminalInput) => {
      return handleCreateTerminal(event, mainWindow, data);
    }))
  );

  // terminal:write - Write input to a terminal
  ipcMain.handle(
    'terminal:write',
    wrapWithLogging('terminal:write', wrapHandler(handleWriteTerminal))
  );

  // terminal:resize - Resize a terminal
  ipcMain.handle(
    'terminal:resize',
    wrapWithLogging('terminal:resize', wrapHandler(handleResizeTerminal))
  );

  // terminal:close - Close a terminal
  ipcMain.handle(
    'terminal:close',
    wrapWithLogging('terminal:close', wrapHandler(handleCloseTerminal))
  );

  // terminal:list - List all terminals for a project
  ipcMain.handle(
    'terminal:list',
    wrapWithLogging('terminal:list', wrapHandler(handleListTerminals))
  );

  // terminal:captureSession - Manually capture terminal session insights
  ipcMain.handle(
    'terminal:captureSession',
    wrapWithLogging('terminal:captureSession', wrapHandler(handleCaptureSession))
  );

  // terminal:pause - Pause a terminal process
  ipcMain.handle(
    'terminal:pause',
    wrapWithLogging('terminal:pause', wrapHandler(handlePauseTerminal))
  );

  // terminal:resume - Resume a paused terminal process
  ipcMain.handle(
    'terminal:resume',
    wrapWithLogging('terminal:resume', wrapHandler(handleResumeTerminal))
  );
}

/**
 * Unregister all terminal-related IPC handlers
 */
export function unregisterTerminalHandlers(): void {
  ipcMain.removeHandler('terminal:create');
  ipcMain.removeHandler('terminal:write');
  ipcMain.removeHandler('terminal:resize');
  ipcMain.removeHandler('terminal:close');
  ipcMain.removeHandler('terminal:list');
  ipcMain.removeHandler('terminal:captureSession');
  ipcMain.removeHandler('terminal:pause');
  ipcMain.removeHandler('terminal:resume');
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
