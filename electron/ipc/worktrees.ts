/**
 * Worktree and Git IPC Handlers
 *
 * Handlers for worktree-related IPC channels (list, create, delete, sync) and
 * git operations (branches, status). Integrates with GitService for git command
 * execution and database for worktree record management.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { gitService } from '../services/git.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Worktree } from '@prisma/client';
import type { WorktreeInfo, BranchInfo, GitStatus } from '../services/git.js';

/**
 * Worktree data types for IPC
 */
export interface CreateWorktreeInput {
  projectId: string;
  name: string;
  branch: string;
  path: string;
  createBranch?: boolean;
}

export interface DeleteWorktreeInput {
  id: string;
  force?: boolean;
}

export interface SyncWorktreesInput {
  projectId: string;
}

export interface SyncWorktreesResult {
  added: number;
  removed: number;
}

/**
 * Worktree with git status information
 */
export interface WorktreeWithStatus extends Worktree {
  gitStatus?: {
    current: string | null;
    ahead: number;
    behind: number;
    staged: number;
    modified: number;
    untracked: number;
  };
}

/**
 * List all worktrees for a project, combining database records with live git data.
 */
async function handleListWorktrees(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<WorktreeWithStatus[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify project exists and has a target path
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.targetPath) {
    throw new Error('Project does not have a target path configured');
  }

  // Check if target path is a valid git repository
  const isGitRepo = await gitService.isGitRepo(project.targetPath);
  if (!isGitRepo) {
    throw new Error('Project target path is not a valid git repository');
  }

  // Get database records
  const dbWorktrees = await prisma.worktree.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  // Get live git worktree data
  let gitWorktrees: WorktreeInfo[] = [];
  try {
    gitWorktrees = await gitService.listWorktrees(project.targetPath);
  } catch (error) {
    console.error('[Worktrees IPC] Failed to list git worktrees:', error);
    // Return database records only if git fails
    return dbWorktrees;
  }

  // Enhance database records with git status
  const worktreesWithStatus: WorktreeWithStatus[] = [];

  for (const dbWorktree of dbWorktrees) {
    const gitWorktree = gitWorktrees.find((gw) => gw.path === dbWorktree.path);

    if (gitWorktree) {
      try {
        const status = await gitService.getStatus(gitWorktree.path);
        worktreesWithStatus.push({
          ...dbWorktree,
          gitStatus: {
            current: status.current,
            ahead: status.ahead,
            behind: status.behind,
            staged: status.staged.length,
            modified: status.modified.length,
            untracked: status.untracked.length,
          },
        });
      } catch {
        // Failed to get status - worktree may not exist anymore
        worktreesWithStatus.push({
          ...dbWorktree,
        });
      }
    } else {
      // No git worktree found - just include database record
      worktreesWithStatus.push({
        ...dbWorktree,
      });
    }
  }

  return worktreesWithStatus;
}

/**
 * Create a new worktree (both git and database).
 */
async function handleCreateWorktree(
  _event: IpcMainInvokeEvent,
  data: CreateWorktreeInput
): Promise<Worktree> {
  if (!data.projectId || !data.name || !data.branch || !data.path) {
    throw IPCErrors.invalidArguments(
      'Project ID, name, branch, and path are required'
    );
  }

  const prisma = databaseService.getClient();

  // Verify project exists and has a target path
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.targetPath) {
    throw new Error('Project does not have a target path configured');
  }

  // Check if target path is a valid git repository
  const isGitRepo = await gitService.isGitRepo(project.targetPath);
  if (!isGitRepo) {
    throw new Error('Project target path is not a valid git repository');
  }

  try {
    // Create the git worktree
    await gitService.addWorktree(
      project.targetPath,
      data.branch,
      data.path,
      data.createBranch ?? false
    );

    // Get the current branch to determine if this is main
    let isMain = false;
    try {
      const currentBranch = await gitService.getCurrentBranch(data.path);
      isMain = currentBranch === 'main' || currentBranch === 'master';
    } catch {
      // Failed to get current branch - assume not main
      isMain = false;
    }

    // Create database record
    const worktree = await prisma.worktree.create({
      data: {
        name: data.name,
        path: data.path,
        branch: data.branch,
        isMain,
        projectId: data.projectId,
      },
    });

    return worktree;
  } catch (error) {
    throw new Error(
      `Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete a worktree (both git and database).
 */
async function handleDeleteWorktree(
  _event: IpcMainInvokeEvent,
  data: DeleteWorktreeInput
): Promise<boolean> {
  if (!data.id) {
    throw IPCErrors.invalidArguments('Worktree ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify worktree exists
  const worktree = await prisma.worktree.findUnique({
    where: { id: data.id },
    include: { project: true },
  });

  if (!worktree) {
    throw new Error('Worktree not found');
  }

  if (!worktree.project.targetPath) {
    throw new Error('Project does not have a target path configured');
  }

  try {
    // Remove the git worktree
    await gitService.removeWorktree(
      worktree.project.targetPath,
      worktree.path,
      data.force ?? false
    );

    // Delete database record
    await prisma.worktree.delete({
      where: { id: data.id },
    });

    return true;
  } catch (error) {
    throw new Error(
      `Failed to delete worktree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Sync database records with actual git worktrees (discovers new, removes orphaned).
 */
async function handleSyncWorktrees(
  _event: IpcMainInvokeEvent,
  data: SyncWorktreesInput
): Promise<SyncWorktreesResult> {
  if (!data.projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify project exists and has a target path
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.targetPath) {
    throw new Error('Project does not have a target path configured');
  }

  // Check if target path is a valid git repository
  const isGitRepo = await gitService.isGitRepo(project.targetPath);
  if (!isGitRepo) {
    throw new Error('Project target path is not a valid git repository');
  }

  // Get git worktrees
  const gitWorktrees = await gitService.listWorktrees(project.targetPath);

  // Get database worktrees
  const dbWorktrees = await prisma.worktree.findMany({
    where: { projectId: data.projectId },
  });

  let added = 0;
  let removed = 0;

  // Add new worktrees found in git but not in database
  for (const gitWorktree of gitWorktrees) {
    const existsInDb = dbWorktrees.some((db) => db.path === gitWorktree.path);

    if (!existsInDb) {
      await prisma.worktree.create({
        data: {
          name: `${gitWorktree.branch} (synced)`,
          path: gitWorktree.path,
          branch: gitWorktree.branch,
          isMain: gitWorktree.isMain,
          projectId: data.projectId,
        },
      });
      added++;
    }
  }

  // Remove database records for worktrees that no longer exist in git
  for (const dbWorktree of dbWorktrees) {
    const existsInGit = gitWorktrees.some((git) => git.path === dbWorktree.path);

    if (!existsInGit) {
      await prisma.worktree.delete({
        where: { id: dbWorktree.id },
      });
      removed++;
    }
  }

  return { added, removed };
}

/**
 * List all branches for a project's repository.
 */
async function handleListBranches(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<BranchInfo[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify project exists and has a target path
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.targetPath) {
    throw new Error('Project does not have a target path configured');
  }

  // Check if target path is a valid git repository
  const isGitRepo = await gitService.isGitRepo(project.targetPath);
  if (!isGitRepo) {
    throw new Error('Project target path is not a valid git repository');
  }

  // Get branches
  const branches = await gitService.listBranches(project.targetPath);

  return branches;
}

/**
 * Get git status for a specific path.
 */
async function handleGetGitStatus(
  _event: IpcMainInvokeEvent,
  path: string
): Promise<GitStatus> {
  if (!path) {
    throw IPCErrors.invalidArguments('Path is required');
  }

  // Check if path is a valid git repository
  const isGitRepo = await gitService.isGitRepo(path);
  if (!isGitRepo) {
    throw new Error('Path is not a valid git repository');
  }

  // Get status
  const status = await gitService.getStatus(path);

  return status;
}

/**
 * Register all worktree and git-related IPC handlers.
 */
export function registerWorktreeHandlers(): void {
  // worktrees:list - List all worktrees for a project
  ipcMain.handle(
    'worktrees:list',
    wrapWithLogging('worktrees:list', wrapHandler(handleListWorktrees))
  );

  // worktrees:create - Create a new worktree
  ipcMain.handle(
    'worktrees:create',
    wrapWithLogging('worktrees:create', wrapHandler(handleCreateWorktree))
  );

  // worktrees:delete - Delete a worktree
  ipcMain.handle(
    'worktrees:delete',
    wrapWithLogging('worktrees:delete', wrapHandler(handleDeleteWorktree))
  );

  // worktrees:sync - Sync database with git worktrees
  ipcMain.handle(
    'worktrees:sync',
    wrapWithLogging('worktrees:sync', wrapHandler(handleSyncWorktrees))
  );

  // branches:list - List all branches for a project
  ipcMain.handle(
    'branches:list',
    wrapWithLogging('branches:list', wrapHandler(handleListBranches))
  );

  // git:status - Get git status for a path
  ipcMain.handle(
    'git:status',
    wrapWithLogging('git:status', wrapHandler(handleGetGitStatus))
  );
}

/**
 * Unregister all worktree and git-related IPC handlers.
 */
export function unregisterWorktreeHandlers(): void {
  ipcMain.removeHandler('worktrees:list');
  ipcMain.removeHandler('worktrees:create');
  ipcMain.removeHandler('worktrees:delete');
  ipcMain.removeHandler('worktrees:sync');
  ipcMain.removeHandler('branches:list');
  ipcMain.removeHandler('git:status');
}

/**
 * Wrap a handler with logging.
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
