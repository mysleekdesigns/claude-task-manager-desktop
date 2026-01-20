/**
 * IPC Handler Registration
 *
 * Central registration point for all IPC handlers.
 * Each domain module exports a register function that sets up its handlers.
 */

import { registerAppHandlers, unregisterAppHandlers } from './app.js';
import { registerDialogHandlers, unregisterDialogHandlers } from './dialog.js';
import { registerUserHandlers, unregisterUserHandlers } from './users.js';
import { registerProjectHandlers, unregisterProjectHandlers } from './projects.js';
import { registerAuthHandlers, unregisterAuthHandlers } from './auth.js';
import { registerTaskHandlers, unregisterTaskHandlers } from './tasks.js';
import { registerTerminalHandlers, unregisterTerminalHandlers } from './terminals.js';
import { registerWorktreeHandlers, unregisterWorktreeHandlers } from './worktrees.js';
import { registerRoadmapHandlers, unregisterRoadmapHandlers } from './roadmap.js';
import { registerMemoryHandlers, unregisterMemoryHandlers } from './memories.js';
import { registerMcpHandlers, unregisterMcpHandlers } from './mcp.js';
import { registerGitHubHandlers, unregisterGitHubHandlers } from './github.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type { BrowserWindow } from 'electron';

const logger = createIPCLogger('IPC');

/**
 * Registration status tracking
 */
let isRegistered = false;

/**
 * Register all IPC handlers.
 *
 * This function should be called once during app initialization.
 * It registers handlers for all domains (app, dialog, tasks, etc.)
 *
 * @param mainWindow - The main BrowserWindow instance for terminal output streaming
 * @throws Error if handlers are already registered
 */
export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  if (isRegistered) {
    logger.warn(
      'IPC handlers are already registered. Skipping re-registration.'
    );
    return;
  }

  logger.info('Registering IPC handlers...');

  try {
    // Register handlers by domain
    registerAppHandlers();
    registerDialogHandlers();
    registerUserHandlers();
    registerProjectHandlers();
    registerAuthHandlers();
    registerTaskHandlers();
    registerTerminalHandlers(mainWindow);
    registerWorktreeHandlers();
    registerRoadmapHandlers();
    registerMemoryHandlers();
    registerMcpHandlers();
    registerGitHubHandlers();

    isRegistered = true;
    logger.info('IPC handlers registered successfully.');
  } catch (error) {
    logger.error('Failed to register IPC handlers:', error);
    throw error;
  }
}

/**
 * Unregister all IPC handlers.
 *
 * This is primarily useful for testing or hot reloading scenarios.
 */
export function unregisterIPCHandlers(): void {
  if (!isRegistered) {
    logger.warn('IPC handlers are not registered. Nothing to unregister.');
    return;
  }

  logger.info('Unregistering IPC handlers...');

  try {
    unregisterAppHandlers();
    unregisterDialogHandlers();
    unregisterUserHandlers();
    unregisterProjectHandlers();
    unregisterAuthHandlers();
    unregisterTaskHandlers();
    unregisterTerminalHandlers();
    unregisterWorktreeHandlers();
    unregisterRoadmapHandlers();
    unregisterMemoryHandlers();
    unregisterMcpHandlers();
    unregisterGitHubHandlers();

    isRegistered = false;
    logger.info('IPC handlers unregistered successfully.');
  } catch (error) {
    logger.error('Failed to unregister IPC handlers:', error);
    throw error;
  }
}

/**
 * Check if IPC handlers are registered
 */
export function isIPCRegistered(): boolean {
  return isRegistered;
}

// Re-export types and utilities that might be needed elsewhere
export {
  IPCError,
  IPCErrors,
  serializeError,
  wrapHandler,
} from '../utils/ipc-error.js';
export {
  createIPCLogger,
  logIPCRequest,
  logIPCResponse,
  logIPCError,
  logIPCEvent,
} from '../utils/ipc-logger.js';
