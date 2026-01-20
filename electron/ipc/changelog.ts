/**
 * Changelog IPC Handlers
 *
 * Handlers for changelog-related IPC channels (CRUD operations, auto-generation, export).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { ChangelogEntry } from '@prisma/client';

// Re-define enum as type to match Prisma's generated enum
type ChangelogEntryType = 'FEATURE' | 'FIX' | 'IMPROVEMENT' | 'BREAKING';

/**
 * Changelog data types for IPC
 */
export interface CreateChangelogEntryInput {
  title: string;
  description?: string;
  version?: string;
  type?: ChangelogEntryType;
  projectId: string;
  taskId?: string;
}

export interface UpdateChangelogEntryInput {
  title?: string;
  description?: string;
  version?: string;
  type?: ChangelogEntryType;
}

/**
 * Changelog entry with relations for API responses
 */
export type ChangelogEntryWithRelations = ChangelogEntry & {
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
  project?: {
    id: string;
    name: string;
  };
};

/**
 * List changelog entries for a project
 */
async function handleListChangelog(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<ChangelogEntryWithRelations[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const entries = await prisma.changelogEntry.findMany({
    where: { projectId },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return entries;
}

/**
 * Create a manual changelog entry
 */
async function handleCreateChangelog(
  _event: IpcMainInvokeEvent,
  data: CreateChangelogEntryInput
): Promise<ChangelogEntryWithRelations> {
  if (!data.title || !data.projectId) {
    throw IPCErrors.invalidArguments('Title and project ID are required');
  }

  const prisma = databaseService.getClient();

  const entry = await prisma.changelogEntry.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      version: data.version ?? null,
      type: data.type ?? 'FEATURE',
      projectId: data.projectId,
      taskId: data.taskId ?? null,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
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

  return entry;
}

/**
 * Update a changelog entry
 */
async function handleUpdateChangelog(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateChangelogEntryInput
): Promise<ChangelogEntryWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Changelog entry ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const entry = await prisma.changelogEntry.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.version !== undefined && { version: data.version }),
        ...(data.type !== undefined && { type: data.type }),
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
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

    return entry;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Changelog entry not found');
    }
    throw error;
  }
}

/**
 * Delete a changelog entry
 */
async function handleDeleteChangelog(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Changelog entry ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.changelogEntry.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Changelog entry not found');
    }
    throw error;
  }
}

/**
 * Auto-generate a changelog entry from a completed task
 */
async function handleGenerateFromTask(
  _event: IpcMainInvokeEvent,
  taskId: string,
  version?: string
): Promise<ChangelogEntryWithRelations> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Get the task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      changelogEntry: true,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if changelog entry already exists for this task
  if (task.changelogEntry) {
    throw new Error('Changelog entry already exists for this task');
  }

  // Determine changelog type from task tags or priority
  const tags = JSON.parse(task.tags || '[]') as string[];
  let type: ChangelogEntryType = 'FEATURE';

  if (tags.includes('bug') || tags.includes('fix')) {
    type = 'FIX';
  } else if (tags.includes('breaking') || tags.includes('breaking-change')) {
    type = 'BREAKING';
  } else if (tags.includes('improvement') || tags.includes('enhancement')) {
    type = 'IMPROVEMENT';
  }

  // Create changelog entry
  const entry = await prisma.changelogEntry.create({
    data: {
      title: task.title,
      description: task.description,
      version: version ?? null,
      type,
      projectId: task.projectId,
      taskId: task.id,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
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

  return entry;
}

/**
 * Export changelog entries as markdown
 */
async function handleExportChangelog(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<{ markdown: string; entries: ChangelogEntryWithRelations[] }> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const entries = await prisma.changelogEntry.findMany({
    where: { projectId },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get project name
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  // Generate markdown
  let markdown = `# Changelog\n\n`;

  if (project) {
    markdown += `Project: **${project.name}**\n\n`;
  }

  // Group entries by version or date
  const grouped: Record<string, ChangelogEntryWithRelations[]> = {};

  entries.forEach((entry) => {
    const key: string = entry.version ?? (new Date(entry.createdAt).toISOString().split('T')[0] || 'Unknown');
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(entry);
  });

  // Generate markdown grouped by version/date
  Object.keys(grouped)
    .sort()
    .reverse()
    .forEach((key) => {
      markdown += `## ${key}\n\n`;

      // Group by type within each version/date
      const groupedEntries: Record<ChangelogEntryType, ChangelogEntryWithRelations[]> = {
        BREAKING: [],
        FEATURE: [],
        IMPROVEMENT: [],
        FIX: [],
      };

      grouped[key]?.forEach((entry) => {
        groupedEntries[entry.type].push(entry);
      });

      // Add entries by type
      const typeLabels: Record<ChangelogEntryType, string> = {
        BREAKING: '🚨 Breaking Changes',
        FEATURE: '✨ Features',
        IMPROVEMENT: '⚡ Improvements',
        FIX: '🐛 Bug Fixes',
      };

      (['BREAKING', 'FEATURE', 'IMPROVEMENT', 'FIX'] as ChangelogEntryType[]).forEach((type) => {
        const typeEntries = groupedEntries[type];
        if (typeEntries.length > 0) {
          markdown += `### ${typeLabels[type]}\n\n`;
          typeEntries.forEach((entry) => {
            markdown += `- **${entry.title}**`;
            if (entry.description) {
              markdown += `\n  ${entry.description}`;
            }
            if (entry.task) {
              markdown += ` ([${entry.task.title}])`;
            }
            markdown += '\n';
          });
          markdown += '\n';
        }
      });
    });

  if (entries.length === 0) {
    markdown += '_No changelog entries found._\n';
  }

  return { markdown, entries };
}

/**
 * Register all changelog-related IPC handlers
 */
export function registerChangelogHandlers(): void {
  // changelog:list - List changelog entries for a project
  ipcMain.handle(
    'changelog:list',
    wrapWithLogging('changelog:list', wrapHandler(handleListChangelog))
  );

  // changelog:create - Create a manual changelog entry
  ipcMain.handle(
    'changelog:create',
    wrapWithLogging('changelog:create', wrapHandler(handleCreateChangelog))
  );

  // changelog:update - Update a changelog entry
  ipcMain.handle(
    'changelog:update',
    wrapWithLogging('changelog:update', wrapHandler(handleUpdateChangelog))
  );

  // changelog:delete - Delete a changelog entry
  ipcMain.handle(
    'changelog:delete',
    wrapWithLogging('changelog:delete', wrapHandler(handleDeleteChangelog))
  );

  // changelog:generateFromTask - Auto-generate entry from completed task
  ipcMain.handle(
    'changelog:generateFromTask',
    wrapWithLogging('changelog:generateFromTask', wrapHandler(handleGenerateFromTask))
  );

  // changelog:export - Export changelog as markdown
  ipcMain.handle(
    'changelog:export',
    wrapWithLogging('changelog:export', wrapHandler(handleExportChangelog))
  );
}

/**
 * Unregister all changelog-related IPC handlers
 */
export function unregisterChangelogHandlers(): void {
  ipcMain.removeHandler('changelog:list');
  ipcMain.removeHandler('changelog:create');
  ipcMain.removeHandler('changelog:update');
  ipcMain.removeHandler('changelog:delete');
  ipcMain.removeHandler('changelog:generateFromTask');
  ipcMain.removeHandler('changelog:export');
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
