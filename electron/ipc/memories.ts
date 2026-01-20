/**
 * Memory IPC Handlers
 *
 * Handlers for memory-related IPC channels (Phase 10: Memory System).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Memory } from '@prisma/client';

/**
 * Memory data types for IPC
 */
export interface CreateMemoryInput {
  projectId: string;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ListMemoriesInput {
  projectId: string;
  type?: string;
}

export interface SearchMemoriesInput {
  projectId: string;
  query: string;
  type?: string;
}

/**
 * Memory with parsed metadata for API responses
 */
export type MemoryWithMetadata = Omit<Memory, 'metadata'> & {
  metadata: Record<string, unknown>;
};

// ============================================================================
// Memory Handlers
// ============================================================================

/**
 * List memories for a project with optional type filter
 */
async function handleListMemories(
  _event: IpcMainInvokeEvent,
  input: ListMemoriesInput
): Promise<MemoryWithMetadata[]> {
  if (!input.projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Build where clause with optional type filter
  const where: {
    projectId: string;
    type?: string;
  } = {
    projectId: input.projectId,
  };

  if (input.type) {
    where.type = input.type;
  }

  const memories = await prisma.memory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Parse metadata for each memory
  return memories.map((memory) => ({
    ...memory,
    metadata: JSON.parse(memory.metadata || '{}'),
  }));
}

/**
 * Create a new memory
 */
async function handleCreateMemory(
  _event: IpcMainInvokeEvent,
  data: CreateMemoryInput
): Promise<MemoryWithMetadata> {
  if (!data.projectId || !data.type || !data.title || !data.content) {
    throw IPCErrors.invalidArguments(
      'Project ID, type, title, and content are required'
    );
  }

  const prisma = databaseService.getClient();

  const memory = await prisma.memory.create({
    data: {
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      content: data.content,
      metadata: JSON.stringify(data.metadata || {}),
    },
  });

  return {
    ...memory,
    metadata: data.metadata || {},
  };
}

/**
 * Get a single memory by ID
 */
async function handleGetMemory(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<MemoryWithMetadata | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('Memory ID is required');
  }

  const prisma = databaseService.getClient();

  const memory = await prisma.memory.findUnique({
    where: { id },
  });

  if (!memory) {
    return null;
  }

  return {
    ...memory,
    metadata: JSON.parse(memory.metadata || '{}'),
  };
}

/**
 * Delete a memory by ID
 */
async function handleDeleteMemory(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<{ success: boolean }> {
  if (!id) {
    throw IPCErrors.invalidArguments('Memory ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.memory.delete({
      where: { id },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Memory not found');
    }
    throw error;
  }
}

/**
 * Full-text search memories by title and content
 */
async function handleSearchMemories(
  _event: IpcMainInvokeEvent,
  input: SearchMemoriesInput
): Promise<MemoryWithMetadata[]> {
  if (!input.projectId || !input.query) {
    throw IPCErrors.invalidArguments('Project ID and query are required');
  }

  const prisma = databaseService.getClient();

  // Build where clause with search and optional type filter
  const where: {
    projectId: string;
    type?: string;
    OR?: Array<{
      title?: { contains: string; mode: 'insensitive' };
      content?: { contains: string; mode: 'insensitive' };
    }>;
  } = {
    projectId: input.projectId,
  };

  if (input.type) {
    where.type = input.type;
  }

  // SQLite doesn't support case-insensitive search with Prisma,
  // so we'll use a simpler approach with OR
  where.OR = [
    { title: { contains: input.query, mode: 'insensitive' } },
    { content: { contains: input.query, mode: 'insensitive' } },
  ];

  const memories = await prisma.memory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Parse metadata for each memory
  return memories.map((memory) => ({
    ...memory,
    metadata: JSON.parse(memory.metadata || '{}'),
  }));
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all memory-related IPC handlers
 */
export function registerMemoryHandlers(): void {
  // memories:list - List memories for a project with optional type filter
  ipcMain.handle(
    'memories:list',
    wrapWithLogging('memories:list', wrapHandler(handleListMemories))
  );

  // memories:create - Create a new memory
  ipcMain.handle(
    'memories:create',
    wrapWithLogging('memories:create', wrapHandler(handleCreateMemory))
  );

  // memories:get - Get a single memory by ID
  ipcMain.handle(
    'memories:get',
    wrapWithLogging('memories:get', wrapHandler(handleGetMemory))
  );

  // memories:delete - Delete a memory by ID
  ipcMain.handle(
    'memories:delete',
    wrapWithLogging('memories:delete', wrapHandler(handleDeleteMemory))
  );

  // memories:search - Full-text search memories
  ipcMain.handle(
    'memories:search',
    wrapWithLogging('memories:search', wrapHandler(handleSearchMemories))
  );
}

/**
 * Unregister all memory-related IPC handlers
 */
export function unregisterMemoryHandlers(): void {
  ipcMain.removeHandler('memories:list');
  ipcMain.removeHandler('memories:create');
  ipcMain.removeHandler('memories:get');
  ipcMain.removeHandler('memories:delete');
  ipcMain.removeHandler('memories:search');
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
