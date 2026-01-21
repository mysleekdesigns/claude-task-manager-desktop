/**
 * Task IPC Handlers
 *
 * Handlers for task-related IPC channels (CRUD operations, status updates, phases, logs, files).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Task, TaskPhase, TaskLog, TaskFile } from '@prisma/client';

// Re-define enums as types to match Prisma's generated enums
type TaskStatus = 'PENDING' | 'PLANNING' | 'IN_PROGRESS' | 'AI_REVIEW' | 'HUMAN_REVIEW' | 'COMPLETED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Task data types for IPC
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  branchName?: string;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  branchName?: string;
  status?: TaskStatus;
  assigneeId?: string;
}

export interface TaskListFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
}

export interface AddPhaseInput {
  taskId: string;
  name: string;
  model?: string;
}

export interface AddLogInput {
  taskId: string;
  phaseId?: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AddFileInput {
  taskId: string;
  path: string;
  action: string;
}

/**
 * Task with relations for API responses
 * Note: Omit 'tags' from Prisma Task type since we deserialize it from JSON string to string[]
 */
export type TaskWithRelations = Omit<Task, 'tags'> & {
  tags: string[]; // Deserialized from JSON string
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  } | null;
  phases?: TaskPhase[];
  logs?: TaskLog[];
  files?: TaskFile[];
  subtasks?: Omit<Task, 'tags'>[];
  parent?: Omit<Task, 'tags'> | null;
};

/**
 * List tasks for a project with optional filters
 */
async function handleListTasks(
  _event: IpcMainInvokeEvent,
  projectId: string,
  filters?: TaskListFilters
): Promise<TaskWithRelations[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Build where clause with filters
  const where: {
    projectId: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string;
  } = { projectId };
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.priority) {
    where.priority = filters.priority;
  }
  if (filters?.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      phases: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform tags from JSON string to array
  return tasks.map((task) => ({
    ...task,
    tags: JSON.parse(task.tags || '[]') as string[],
  }));
}

/**
 * Create a new task
 */
async function handleCreateTask(
  _event: IpcMainInvokeEvent,
  data: CreateTaskInput
): Promise<TaskWithRelations> {
  if (!data.title || !data.projectId) {
    throw IPCErrors.invalidArguments('Task title and project ID are required');
  }

  const prisma = databaseService.getClient();

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'MEDIUM',
      tags: JSON.stringify(data.tags || []),
      branchName: data.branchName ?? null,
      projectId: data.projectId,
      assigneeId: data.assigneeId ?? null,
      parentId: data.parentId ?? null,
    },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      phases: true,
    },
  });

  // Return with deserialized tags
  return {
    ...task,
    tags: data.tags || [],
  } as unknown as TaskWithRelations;
}

/**
 * Get a single task by ID with all relations
 */
async function handleGetTask(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<TaskWithRelations | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      phases: {
        include: {
          logs: true,
        },
      },
      logs: true,
      files: true,
      subtasks: true,
      parent: true,
    },
  });

  if (!task) {
    return null;
  }

  return {
    ...task,
    tags: JSON.parse(task.tags || '[]') as string[],
  };
}

/**
 * Update task fields
 */
async function handleUpdateTask(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateTaskInput
): Promise<TaskWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
        ...(data.branchName !== undefined && { branchName: data.branchName }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        phases: true,
      },
    });

    return {
      ...task,
      tags: JSON.parse(task.tags || '[]') as string[],
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Task not found');
    }
    throw error;
  }
}

/**
 * Update only the task status (optimized for drag-drop)
 */
async function handleUpdateTaskStatus(
  _event: IpcMainInvokeEvent,
  id: string,
  status: TaskStatus
): Promise<TaskWithRelations> {
  if (!id || !status) {
    throw IPCErrors.invalidArguments('Task ID and status are required');
  }

  const prisma = databaseService.getClient();

  try {
    const task = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        phases: true,
      },
    });

    return {
      ...task,
      tags: JSON.parse(task.tags || '[]') as string[],
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Task not found');
    }
    throw error;
  }
}

/**
 * Delete a task
 */
async function handleDeleteTask(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.task.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Task not found');
    }
    throw error;
  }
}

/**
 * Add a phase to a task
 */
async function handleAddPhase(
  _event: IpcMainInvokeEvent,
  data: AddPhaseInput
): Promise<TaskPhase> {
  if (!data.taskId || !data.name) {
    throw IPCErrors.invalidArguments('Task ID and phase name are required');
  }

  const prisma = databaseService.getClient();

  const phase = await prisma.taskPhase.create({
    data: {
      taskId: data.taskId,
      name: data.name,
      model: data.model ?? null,
    },
  });

  return phase;
}

/**
 * Add a log entry to a task
 */
async function handleAddLog(
  _event: IpcMainInvokeEvent,
  data: AddLogInput
): Promise<TaskLog> {
  if (!data.taskId || !data.type || !data.message) {
    throw IPCErrors.invalidArguments('Task ID, type, and message are required');
  }

  const prisma = databaseService.getClient();

  const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null;

  const log = await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      phaseId: data.phaseId ?? null,
      type: data.type,
      message: data.message,
      ...(metadataStr !== null && { metadata: metadataStr }),
    },
  });

  return log;
}

/**
 * Add a file record to a task
 */
async function handleAddFile(
  _event: IpcMainInvokeEvent,
  data: AddFileInput
): Promise<TaskFile> {
  if (!data.taskId || !data.path || !data.action) {
    throw IPCErrors.invalidArguments('Task ID, path, and action are required');
  }

  const prisma = databaseService.getClient();

  const file = await prisma.taskFile.create({
    data: {
      taskId: data.taskId,
      path: data.path,
      action: data.action,
    },
  });

  return file;
}

/**
 * Get subtasks for a parent task
 */
async function handleGetSubtasks(
  _event: IpcMainInvokeEvent,
  parentId: string
): Promise<TaskWithRelations[]> {
  if (!parentId) {
    throw IPCErrors.invalidArguments('Parent task ID is required');
  }

  const prisma = databaseService.getClient();

  const subtasks = await prisma.task.findMany({
    where: { parentId },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      phases: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return subtasks.map((task) => ({
    ...task,
    tags: JSON.parse(task.tags || '[]') as string[],
  }));
}

/**
 * Register all task-related IPC handlers
 */
export function registerTaskHandlers(): void {
  // tasks:list - List tasks for a project with optional filters
  ipcMain.handle(
    'tasks:list',
    wrapWithLogging('tasks:list', wrapHandler(handleListTasks))
  );

  // tasks:create - Create a new task
  ipcMain.handle(
    'tasks:create',
    wrapWithLogging('tasks:create', wrapHandler(handleCreateTask))
  );

  // tasks:get - Get a single task by ID
  ipcMain.handle(
    'tasks:get',
    wrapWithLogging('tasks:get', wrapHandler(handleGetTask))
  );

  // tasks:update - Update task fields
  ipcMain.handle(
    'tasks:update',
    wrapWithLogging('tasks:update', wrapHandler(handleUpdateTask))
  );

  // tasks:updateStatus - Update only the task status (for drag-drop)
  ipcMain.handle(
    'tasks:updateStatus',
    wrapWithLogging('tasks:updateStatus', wrapHandler(handleUpdateTaskStatus))
  );

  // tasks:delete - Delete a task
  ipcMain.handle(
    'tasks:delete',
    wrapWithLogging('tasks:delete', wrapHandler(handleDeleteTask))
  );

  // tasks:addPhase - Add a phase to a task
  ipcMain.handle(
    'tasks:addPhase',
    wrapWithLogging('tasks:addPhase', wrapHandler(handleAddPhase))
  );

  // tasks:addLog - Add a log entry to a task
  ipcMain.handle(
    'tasks:addLog',
    wrapWithLogging('tasks:addLog', wrapHandler(handleAddLog))
  );

  // tasks:addFile - Add a file record to a task
  ipcMain.handle(
    'tasks:addFile',
    wrapWithLogging('tasks:addFile', wrapHandler(handleAddFile))
  );

  // tasks:getSubtasks - Get subtasks for a parent task
  ipcMain.handle(
    'tasks:getSubtasks',
    wrapWithLogging('tasks:getSubtasks', wrapHandler(handleGetSubtasks))
  );
}

/**
 * Unregister all task-related IPC handlers
 */
export function unregisterTaskHandlers(): void {
  ipcMain.removeHandler('tasks:list');
  ipcMain.removeHandler('tasks:create');
  ipcMain.removeHandler('tasks:get');
  ipcMain.removeHandler('tasks:update');
  ipcMain.removeHandler('tasks:updateStatus');
  ipcMain.removeHandler('tasks:delete');
  ipcMain.removeHandler('tasks:addPhase');
  ipcMain.removeHandler('tasks:addLog');
  ipcMain.removeHandler('tasks:addFile');
  ipcMain.removeHandler('tasks:getSubtasks');
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
