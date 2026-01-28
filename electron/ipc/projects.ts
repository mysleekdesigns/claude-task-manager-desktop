/**
 * Project IPC Handlers
 *
 * Handlers for project-related IPC channels (CRUD operations and member management).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { softDeleteService, notDeleted } from '../services/soft-delete.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Project, ProjectMember } from '@prisma/client';

// Re-define ProjectRole as a type to match Prisma's generated enum
type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Project data types for IPC
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
  ownerId: string; // The user who creates the project becomes the owner
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
}

/**
 * Project with relations for API responses
 */
export type ProjectWithMembers = Project & {
  members?: (ProjectMember & {
    user?: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
    };
  })[];
};

/**
 * List all projects for a user
 */
async function handleListProjects(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<ProjectWithMembers[]> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  const prisma = databaseService.getClient();
  const projectMembers = await prisma.projectMember.findMany({
    where: {
      userId,
      ...notDeleted, // Exclude soft-deleted memberships
      project: notDeleted, // Exclude soft-deleted projects
    },
    include: {
      project: {
        include: {
          members: {
            where: notDeleted, // Only include non-deleted members
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      project: {
        createdAt: 'desc',
      },
    },
  });

  return projectMembers.map((pm) => pm.project);
}

/**
 * Create a new project
 */
async function handleCreateProject(
  _event: IpcMainInvokeEvent,
  data: CreateProjectInput
): Promise<ProjectWithMembers> {
  if (!data.name || !data.ownerId) {
    throw IPCErrors.invalidArguments('Project name and owner ID are required');
  }

  const prisma = databaseService.getClient();

  // Use transaction to create project and add owner as member
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        targetPath: data.targetPath ?? null,
        githubRepo: data.githubRepo ?? null,
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: data.ownerId,
        role: 'OWNER',
      },
    });

    // Fetch project with members
    const projectWithMembers = await tx.project.findUnique({
      where: { id: project.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!projectWithMembers) {
      throw new Error('Failed to create project');
    }

    return projectWithMembers;
  });

  return result;
}

/**
 * Get project by ID
 */
async function handleGetProject(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<ProjectWithMembers | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();
  const project = await prisma.project.findFirst({
    where: {
      id,
      ...notDeleted, // Exclude soft-deleted projects
    },
    include: {
      members: {
        where: notDeleted, // Only include non-deleted members
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  return project;
}

/**
 * Update project
 */
async function handleUpdateProject(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateProjectInput
): Promise<ProjectWithMembers> {
  if (!id) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.targetPath !== undefined && { targetPath: data.targetPath }),
        ...(data.githubRepo !== undefined && { githubRepo: data.githubRepo }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return project;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Project not found');
    }
    throw error;
  }
}

/**
 * Delete project (soft delete)
 *
 * Uses soft delete instead of hard delete to support sync and undo functionality.
 * The project and its tasks/members are marked with a deletedAt timestamp.
 */
async function handleDeleteProject(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const result = await softDeleteService.softDelete('Project', id);

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete project');
  }
}

/**
 * Add member to project
 */
async function handleAddMember(
  _event: IpcMainInvokeEvent,
  projectId: string,
  userId: string,
  role: ProjectRole = 'MEMBER'
): Promise<ProjectMember & {
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}> {
  if (!projectId || !userId) {
    throw IPCErrors.invalidArguments('Project ID and user ID are required');
  }

  const prisma = databaseService.getClient();

  try {
    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return member;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      throw new Error('User is already a member of this project');
    }
    throw error;
  }
}

/**
 * Remove member from project (soft delete)
 *
 * Uses soft delete instead of hard delete to support sync and undo functionality.
 */
async function handleRemoveMember(
  _event: IpcMainInvokeEvent,
  projectId: string,
  userId: string
): Promise<void> {
  if (!projectId || !userId) {
    throw IPCErrors.invalidArguments('Project ID and user ID are required');
  }

  const prisma = databaseService.getClient();

  // Find the membership record
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      ...notDeleted,
    },
  });

  if (!member) {
    throw new Error('Project member not found');
  }

  const result = await softDeleteService.softDelete('ProjectMember', member.id);

  if (!result.success) {
    throw new Error(result.error || 'Failed to remove member');
  }
}

/**
 * Update member role
 */
async function handleUpdateMemberRole(
  _event: IpcMainInvokeEvent,
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<ProjectMember & {
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}> {
  if (!projectId || !userId || !role) {
    throw IPCErrors.invalidArguments(
      'Project ID, user ID, and role are required'
    );
  }

  const prisma = databaseService.getClient();

  try {
    // Find the member first
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (!existingMember) {
      throw new Error('Project member not found');
    }

    // Update the role
    const member = await prisma.projectMember.update({
      where: {
        id: existingMember.id,
      },
      data: {
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return member;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Project member not found');
    }
    throw error;
  }
}

/**
 * Register all project-related IPC handlers
 */
export function registerProjectHandlers(): void {
  // projects:list - List all projects for a user
  ipcMain.handle(
    'projects:list',
    wrapWithLogging('projects:list', wrapHandler(handleListProjects))
  );

  // projects:create - Create a new project
  ipcMain.handle(
    'projects:create',
    wrapWithLogging('projects:create', wrapHandler(handleCreateProject))
  );

  // projects:get - Get project by ID
  ipcMain.handle(
    'projects:get',
    wrapWithLogging('projects:get', wrapHandler(handleGetProject))
  );

  // projects:update - Update project
  ipcMain.handle(
    'projects:update',
    wrapWithLogging('projects:update', wrapHandler(handleUpdateProject))
  );

  // projects:delete - Delete project
  ipcMain.handle(
    'projects:delete',
    wrapWithLogging('projects:delete', wrapHandler(handleDeleteProject))
  );

  // projects:addMember - Add member to project
  ipcMain.handle(
    'projects:addMember',
    wrapWithLogging('projects:addMember', wrapHandler(handleAddMember))
  );

  // projects:removeMember - Remove member from project
  ipcMain.handle(
    'projects:removeMember',
    wrapWithLogging('projects:removeMember', wrapHandler(handleRemoveMember))
  );

  // projects:updateMemberRole - Update member role
  ipcMain.handle(
    'projects:updateMemberRole',
    wrapWithLogging(
      'projects:updateMemberRole',
      wrapHandler(handleUpdateMemberRole)
    )
  );
}

/**
 * Unregister all project-related IPC handlers
 */
export function unregisterProjectHandlers(): void {
  ipcMain.removeHandler('projects:list');
  ipcMain.removeHandler('projects:create');
  ipcMain.removeHandler('projects:get');
  ipcMain.removeHandler('projects:update');
  ipcMain.removeHandler('projects:delete');
  ipcMain.removeHandler('projects:addMember');
  ipcMain.removeHandler('projects:removeMember');
  ipcMain.removeHandler('projects:updateMemberRole');
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
