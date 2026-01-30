/**
 * Context IPC Handlers
 *
 * Handlers for project context-related IPC channels (tech stack detection, etc.).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { notDeleted } from '../services/soft-delete.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import { detectTechStack } from '../services/techDetection.js';
import { claudeMdService } from '../services/claudeMd.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Serialized ProjectContext for IPC transport
 */
interface SerializedProjectContext {
  id: string;
  projectId: string;
  claudeMd: string | null;
  techStack: string[];
  keyFiles: string[];
  lastScanned: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for upserting a ProjectContext
 */
interface UpsertProjectContextInput {
  claudeMd?: string | null;
  techStack?: string[];
  keyFiles?: string[];
}

/**
 * Get the technology stack for a project.
 *
 * @param projectId - The ID of the project
 * @returns Array of lowercase technology names
 */
async function handleGetTechStack(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<string[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Get the project to retrieve the targetPath
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...notDeleted,
    },
    select: {
      id: true,
      targetPath: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.targetPath) {
    // Return empty array if no target path is set
    return [];
  }

  // Detect and return the tech stack
  return detectTechStack(project.targetPath);
}

/**
 * Get CLAUDE.md content for a project.
 *
 * Looks up the project by ID, gets its targetPath, and then
 * detects and returns the CLAUDE.md content if found.
 *
 * @param projectId - The ID of the project to get CLAUDE.md for
 * @returns The content of the CLAUDE.md file, or null if not found
 */
async function handleGetClaudeMd(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<string | null> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Get the project to find its targetPath
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...notDeleted,
    },
    select: {
      id: true,
      targetPath: true,
    },
  });

  if (!project) {
    throw IPCErrors.invalidArguments('Project not found');
  }

  if (!project.targetPath) {
    // Project has no target path configured, return null
    return null;
  }

  // Detect and read CLAUDE.md from the project path
  const content = await claudeMdService.detectClaudeMd(project.targetPath);

  return content;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Serialize a ProjectContext record for IPC transport.
 * Parses JSON strings back to arrays and converts dates to ISO strings.
 */
function serializeProjectContext(context: {
  id: string;
  projectId: string;
  claudeMd: string | null;
  techStack: string;
  keyFiles: string;
  lastScanned: Date;
  createdAt: Date;
  updatedAt: Date;
}): SerializedProjectContext {
  return {
    id: context.id,
    projectId: context.projectId,
    claudeMd: context.claudeMd,
    techStack: JSON.parse(context.techStack || '[]'),
    keyFiles: JSON.parse(context.keyFiles || '[]'),
    lastScanned: context.lastScanned.toISOString(),
    createdAt: context.createdAt.toISOString(),
    updatedAt: context.updatedAt.toISOString(),
  };
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Get the ProjectContext for a project.
 *
 * @param projectId - The ID of the project
 * @returns The ProjectContext or null if not found
 */
async function handleGetContext(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<SerializedProjectContext | null> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const context = await prisma.projectContext.findUnique({
    where: { projectId },
  });

  if (!context) {
    return null;
  }

  return serializeProjectContext(context);
}

/**
 * Upsert (create or update) a ProjectContext for a project.
 *
 * @param projectId - The ID of the project
 * @param data - The context data to upsert
 * @returns The upserted ProjectContext
 */
async function handleUpsertContext(
  _event: IpcMainInvokeEvent,
  projectId: string,
  data: UpsertProjectContextInput
): Promise<SerializedProjectContext> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify project exists
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...notDeleted,
    },
    select: { id: true },
  });

  if (!project) {
    throw IPCErrors.invalidArguments('Project not found');
  }

  // Prepare data for SQLite (stringify arrays)
  const updateData: {
    claudeMd?: string | null;
    techStack?: string;
    keyFiles?: string;
  } = {};

  if (data.claudeMd !== undefined) {
    updateData.claudeMd = data.claudeMd;
  }
  if (data.techStack !== undefined) {
    updateData.techStack = JSON.stringify(data.techStack);
  }
  if (data.keyFiles !== undefined) {
    updateData.keyFiles = JSON.stringify(data.keyFiles);
  }

  const context = await prisma.projectContext.upsert({
    where: { projectId },
    update: updateData,
    create: {
      projectId,
      claudeMd: data.claudeMd ?? null,
      techStack: JSON.stringify(data.techStack ?? []),
      keyFiles: JSON.stringify(data.keyFiles ?? []),
    },
  });

  return serializeProjectContext(context);
}

/**
 * Scan a project directory and update its ProjectContext.
 *
 * This function:
 * 1. Gets the project path from the database
 * 2. Detects CLAUDE.md content
 * 3. Detects the tech stack
 * 4. Upserts the ProjectContext with the results
 *
 * @param projectId - The ID of the project to scan
 * @returns The updated ProjectContext
 */
async function handleScanContext(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<SerializedProjectContext> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Get the project to retrieve the targetPath
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...notDeleted,
    },
    select: {
      id: true,
      targetPath: true,
    },
  });

  if (!project) {
    throw IPCErrors.invalidArguments('Project not found');
  }

  // Initialize results
  let claudeMdContent: string | null = null;
  let techStackArray: string[] = [];

  // Only scan if project has a target path
  if (project.targetPath) {
    // Detect CLAUDE.md content
    claudeMdContent = await claudeMdService.detectClaudeMd(project.targetPath);

    // Detect tech stack
    techStackArray = await detectTechStack(project.targetPath);
  }

  // Upsert the ProjectContext with scan results
  const context = await prisma.projectContext.upsert({
    where: { projectId },
    update: {
      claudeMd: claudeMdContent,
      techStack: JSON.stringify(techStackArray),
      lastScanned: new Date(),
    },
    create: {
      projectId,
      claudeMd: claudeMdContent,
      techStack: JSON.stringify(techStackArray),
      keyFiles: JSON.stringify([]),
      lastScanned: new Date(),
    },
  });

  return serializeProjectContext(context);
}

/**
 * Register all context-related IPC handlers
 */
export function registerContextHandlers(): void {
  // context:getTechStack - Get the technology stack for a project
  ipcMain.handle(
    'context:getTechStack',
    wrapWithLogging('context:getTechStack', wrapHandler(handleGetTechStack))
  );

  // context:getClaudeMd - Get CLAUDE.md content for a project
  ipcMain.handle(
    'context:getClaudeMd',
    wrapWithLogging('context:getClaudeMd', wrapHandler(handleGetClaudeMd))
  );

  // context:get - Get ProjectContext for a project
  ipcMain.handle(
    'context:get',
    wrapWithLogging('context:get', wrapHandler(handleGetContext))
  );

  // context:upsert - Create or update ProjectContext
  ipcMain.handle(
    'context:upsert',
    wrapWithLogging('context:upsert', wrapHandler(handleUpsertContext))
  );

  // context:scan - Scan project and update context
  ipcMain.handle(
    'context:scan',
    wrapWithLogging('context:scan', wrapHandler(handleScanContext))
  );
}

/**
 * Unregister all context-related IPC handlers
 */
export function unregisterContextHandlers(): void {
  ipcMain.removeHandler('context:getTechStack');
  ipcMain.removeHandler('context:getClaudeMd');
  ipcMain.removeHandler('context:get');
  ipcMain.removeHandler('context:upsert');
  ipcMain.removeHandler('context:scan');
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
