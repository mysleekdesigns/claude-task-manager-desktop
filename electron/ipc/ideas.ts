/**
 * Ideas IPC Handlers
 *
 * Handlers for ideas-related IPC channels (CRUD operations, voting, convert to feature).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import { getSessionToken, clearSessionToken } from '../services/session-storage.js';
import { isSessionExpired } from '../services/auth.js';
import type { Idea, Feature } from '@prisma/client';

// Re-define enums as types to match Prisma's generated enums
type IdeaStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
type MoscowPriority = 'MUST' | 'SHOULD' | 'COULD' | 'WONT';

/**
 * Idea data types for IPC
 */
export interface CreateIdeaInput {
  title: string;
  description?: string;
  projectId: string;
}

export interface UpdateIdeaInput {
  title?: string;
  description?: string;
  status?: IdeaStatus;
}

export interface IdeaListFilters {
  status?: IdeaStatus;
}

export interface ConvertToFeatureInput {
  ideaId: string;
  priority: MoscowPriority;
  phaseId?: string;
}

/**
 * Idea with relations for API responses
 */
export type IdeaWithRelations = Idea & {
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  project?: {
    id: string;
    name: string;
  };
};

/**
 * Get current user ID from session token
 */
async function getCurrentUserId(): Promise<string> {
  const token = getSessionToken();

  if (!token) {
    throw IPCErrors.permissionDenied('Not authenticated');
  }

  const prisma = databaseService.getClient();

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    clearSessionToken();
    throw IPCErrors.permissionDenied('Invalid session');
  }

  if (isSessionExpired(session.expiresAt)) {
    await prisma.session.delete({
      where: { token },
    });
    clearSessionToken();
    throw IPCErrors.permissionDenied('Session expired');
  }

  return session.userId;
}

/**
 * List ideas for a project with optional filters
 */
async function handleListIdeas(
  _event: IpcMainInvokeEvent,
  projectId: string,
  filters?: IdeaListFilters
): Promise<IdeaWithRelations[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Build where clause with filters
  const where: {
    projectId: string;
    status?: IdeaStatus;
  } = { projectId };

  if (filters?.status) {
    where.status = filters.status;
  }

  const ideas = await prisma.idea.findMany({
    where,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { votes: 'desc' }, // Most voted first
      { createdAt: 'desc' }, // Then by creation date
    ],
  });

  return ideas;
}

/**
 * Get a single idea by ID
 */
async function handleGetIdea(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<IdeaWithRelations | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('Idea ID is required');
  }

  const prisma = databaseService.getClient();

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return idea;
}

/**
 * Create a new idea
 */
async function handleCreateIdea(
  _event: IpcMainInvokeEvent,
  data: CreateIdeaInput
): Promise<IdeaWithRelations> {
  if (!data.title || !data.projectId) {
    throw IPCErrors.invalidArguments('Title and project ID are required');
  }

  // Get current user ID from session
  const createdById = await getCurrentUserId();

  const prisma = databaseService.getClient();

  const idea = await prisma.idea.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      projectId: data.projectId,
      createdById,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return idea;
}

/**
 * Update an idea
 */
async function handleUpdateIdea(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateIdeaInput
): Promise<IdeaWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Idea ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const idea = await prisma.idea.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return idea;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Idea not found');
    }
    throw error;
  }
}

/**
 * Delete an idea
 */
async function handleDeleteIdea(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Idea ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.idea.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Idea not found');
    }
    throw error;
  }
}

/**
 * Vote on an idea (increment or decrement votes by delta)
 */
async function handleVoteIdea(
  _event: IpcMainInvokeEvent,
  id: string,
  delta: number
): Promise<IdeaWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Idea ID is required');
  }

  if (delta !== 1 && delta !== -1) {
    throw IPCErrors.invalidArguments('Delta must be +1 (upvote) or -1 (downvote)');
  }

  const prisma = databaseService.getClient();

  try {
    // Get current idea to ensure votes don't go below 0
    const currentIdea = await prisma.idea.findUnique({
      where: { id },
    });

    if (!currentIdea) {
      throw new Error('Idea not found');
    }

    const newVotes = Math.max(0, currentIdea.votes + delta);

    const idea = await prisma.idea.update({
      where: { id },
      data: {
        votes: newVotes,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return idea;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Idea not found');
    }
    throw error;
  }
}

/**
 * Convert an idea to a feature
 */
async function handleConvertToFeature(
  _event: IpcMainInvokeEvent,
  ideaId: string
): Promise<{ idea: Idea; feature: Feature }> {
  if (!ideaId) {
    throw IPCErrors.invalidArguments('Idea ID is required');
  }

  const prisma = databaseService.getClient();

  // Use transaction to update idea and create feature
  const result = await prisma.$transaction(async (tx) => {
    // Get the idea first
    const ideaToConvert = await tx.idea.findUnique({
      where: { id: ideaId },
    });

    if (!ideaToConvert) {
      throw new Error('Idea not found');
    }

    // Only approved ideas can be converted
    if (ideaToConvert.status !== 'APPROVED') {
      throw IPCErrors.invalidArguments('Only approved ideas can be converted to features');
    }

    // Update idea status to CONVERTED
    const idea = await tx.idea.update({
      where: { id: ideaId },
      data: { status: 'CONVERTED' },
    });

    // Create feature from idea with default priority
    const feature = await tx.feature.create({
      data: {
        title: ideaToConvert.title,
        description: ideaToConvert.description,
        priority: 'SHOULD' as MoscowPriority,
        projectId: ideaToConvert.projectId,
        status: 'planned',
      },
    });

    return { idea, feature };
  });

  return result;
}

/**
 * Register all idea-related IPC handlers
 */
export function registerIdeaHandlers(): void {
  // ideas:list - List ideas for a project with optional filters
  ipcMain.handle(
    'ideas:list',
    wrapWithLogging('ideas:list', wrapHandler(handleListIdeas))
  );

  // ideas:get - Get a single idea by ID
  ipcMain.handle(
    'ideas:get',
    wrapWithLogging('ideas:get', wrapHandler(handleGetIdea))
  );

  // ideas:create - Create a new idea
  ipcMain.handle(
    'ideas:create',
    wrapWithLogging('ideas:create', wrapHandler(handleCreateIdea))
  );

  // ideas:update - Update an idea
  ipcMain.handle(
    'ideas:update',
    wrapWithLogging('ideas:update', wrapHandler(handleUpdateIdea))
  );

  // ideas:delete - Delete an idea
  ipcMain.handle(
    'ideas:delete',
    wrapWithLogging('ideas:delete', wrapHandler(handleDeleteIdea))
  );

  // ideas:vote - Vote on an idea (upvote/downvote)
  ipcMain.handle(
    'ideas:vote',
    wrapWithLogging('ideas:vote', wrapHandler(handleVoteIdea))
  );

  // ideas:convertToFeature - Convert idea to feature
  ipcMain.handle(
    'ideas:convertToFeature',
    wrapWithLogging('ideas:convertToFeature', wrapHandler(handleConvertToFeature))
  );
}

/**
 * Unregister all idea-related IPC handlers
 */
export function unregisterIdeaHandlers(): void {
  ipcMain.removeHandler('ideas:list');
  ipcMain.removeHandler('ideas:get');
  ipcMain.removeHandler('ideas:create');
  ipcMain.removeHandler('ideas:update');
  ipcMain.removeHandler('ideas:delete');
  ipcMain.removeHandler('ideas:vote');
  ipcMain.removeHandler('ideas:convertToFeature');
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
