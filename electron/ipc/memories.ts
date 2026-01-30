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
  taskId?: string;
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
 * Filter options for listing memories
 */
interface MemoryListFilters {
  type?: string;
  search?: string;
  source?: string;
  taskId?: string;
  isArchived?: boolean;
}

/**
 * List memories for a project with optional filters
 */
async function handleListMemories(
  _event: IpcMainInvokeEvent,
  projectId: string,
  filters?: MemoryListFilters
): Promise<MemoryWithMetadata[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Build where clause with all filter options
  const where: {
    projectId: string;
    type?: string;
    source?: string;
    taskId?: string | null;
    isArchived?: boolean;
  } = {
    projectId,
  };

  // Apply type filter
  if (filters?.type) {
    where.type = filters.type;
  }

  // Apply source filter
  if (filters?.source) {
    where.source = filters.source;
  }

  // Apply task filter
  if (filters?.taskId !== undefined) {
    // Special case: empty string means unlinked memories
    if (filters.taskId === '') {
      where.taskId = null;
    } else {
      where.taskId = filters.taskId;
    }
  }

  // Apply archived filter (default to showing active only if not specified)
  if (filters?.isArchived !== undefined) {
    where.isArchived = filters.isArchived;
  }

  const memories = await prisma.memory.findMany({
    where,
    include: {
      task: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Parse metadata for each memory
  return memories.map((memory) => ({
    ...memory,
    metadata: JSON.parse(memory.metadata || '{}') as Record<string, unknown>,
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
      taskId: data.taskId || null,
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
    metadata: JSON.parse(memory.metadata || '{}') as Record<string, unknown>,
  };
}

/**
 * Update memory input data
 */
export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  isArchived?: boolean;
  taskId?: string | null;
}

/**
 * Update an existing memory
 */
async function handleUpdateMemory(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateMemoryInput
): Promise<MemoryWithMetadata> {
  if (!id) {
    throw IPCErrors.invalidArguments('Memory ID is required');
  }

  const prisma = databaseService.getClient();

  // Build the update data, converting metadata to JSON string if provided
  const updateData: {
    title?: string;
    content?: string;
    type?: string;
    metadata?: string;
    isArchived?: boolean;
    taskId?: string | null;
  } = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);
  if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
  if (data.taskId !== undefined) updateData.taskId = data.taskId;

  try {
    const memory = await prisma.memory.update({
      where: { id },
      data: updateData,
    });

    return {
      ...memory,
      metadata: JSON.parse(memory.metadata || '{}') as Record<string, unknown>,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Memory not found');
    }
    throw error;
  }
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
    OR?: {
      title?: { contains: string; mode: 'insensitive' };
      content?: { contains: string; mode: 'insensitive' };
    }[];
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
    metadata: JSON.parse(memory.metadata || '{}') as Record<string, unknown>,
  }));
}

/**
 * Clean up memories with bad/gibberish content from terminal capture issues.
 * Only affects auto_session memories, not manually created ones.
 */
async function handleCleanupBadMemories(
  _event: IpcMainInvokeEvent
): Promise<{ deleted: number; checked: number }> {
  const prisma = databaseService.getClient();

  // Get all auto-session memories
  const memories = await prisma.memory.findMany({
    where: {
      source: 'auto_session',
    },
    select: {
      id: true,
      content: true,
    },
  });

  // Patterns that indicate bad content
  const badPatterns = [
    /\[\?2004[hl]/,           // Bracketed paste mode
    /\[20[01]~/,              // Paste markers
    /\x1b/,                   // Raw escape chars
    // Repeated prompt pattern (same text 3+ times)
    /(.{20,})\1{2,}/,
  ];

  const idsToDelete: string[] = [];

  for (const memory of memories) {
    const hasBadContent = badPatterns.some(pattern => pattern.test(memory.content));
    if (hasBadContent) {
      idsToDelete.push(memory.id);
    }
  }

  // Delete bad memories
  if (idsToDelete.length > 0) {
    await prisma.memory.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });
  }

  return {
    deleted: idsToDelete.length,
    checked: memories.length,
  };
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

  // memories:update - Update an existing memory
  ipcMain.handle(
    'memories:update',
    wrapWithLogging('memories:update', wrapHandler(handleUpdateMemory))
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

  // memories:cleanup - Clean up bad/gibberish memories from terminal capture
  ipcMain.handle(
    'memories:cleanup',
    wrapWithLogging('memories:cleanup', wrapHandler(handleCleanupBadMemories))
  );
}

/**
 * Unregister all memory-related IPC handlers
 */
export function unregisterMemoryHandlers(): void {
  ipcMain.removeHandler('memories:list');
  ipcMain.removeHandler('memories:create');
  ipcMain.removeHandler('memories:get');
  ipcMain.removeHandler('memories:update');
  ipcMain.removeHandler('memories:delete');
  ipcMain.removeHandler('memories:search');
  ipcMain.removeHandler('memories:cleanup');
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
