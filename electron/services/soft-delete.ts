/**
 * Soft Delete Service
 *
 * Provides soft delete functionality for synced models (Project, Task, ProjectMember).
 * Instead of permanently deleting records, this service marks them with a deletedAt timestamp.
 *
 * Features:
 * - softDelete: Marks a record as deleted without removing it
 * - restore: Restores a soft-deleted record
 * - permanentDelete: Actually removes the record from the database
 * - cleanupOldDeleted: Removes records deleted more than N days ago
 *
 * @module electron/services/soft-delete
 * @phase 18.6 - Soft Deletes Implementation
 */

import { getPrismaClient } from './database';
import { syncQueueService, type SyncTable, type SyncOperation } from './sync-queue';

// ============================================================================
// Types
// ============================================================================

/**
 * Tables that support soft deletes
 */
export type SoftDeleteTable = 'Project' | 'Task' | 'ProjectMember';

/**
 * Result of a soft delete operation
 */
export interface SoftDeleteResult {
  success: boolean;
  recordId: string;
  table: SoftDeleteTable;
  deletedAt?: Date;
  error?: string;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  success: boolean;
  recordId: string;
  table: SoftDeleteTable;
  error?: string;
}

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  errors: string[];
}

/**
 * Options for listing soft-deleted records
 */
export interface ListDeletedOptions {
  table?: SoftDeleteTable;
  olderThanDays?: number;
  limit?: number;
}

/**
 * A soft-deleted record summary
 */
export interface DeletedRecordSummary {
  id: string;
  table: SoftDeleteTable;
  deletedAt: Date;
  name?: string; // Project name or Task title
}

// ============================================================================
// SoftDeleteService Class
// ============================================================================

/**
 * Service for managing soft deletes across synced tables.
 *
 * Soft deletes allow:
 * - Undo functionality for accidental deletes
 * - Proper sync conflict resolution (delete vs edit)
 * - Data recovery before permanent deletion
 * - Audit trail of deleted records
 */
class SoftDeleteService {
  // ============================================================================
  // Soft Delete Operations
  // ============================================================================

  /**
   * Soft delete a record by setting its deletedAt timestamp.
   *
   * This does NOT remove the record from the database. Instead, it marks it
   * as deleted so queries can filter it out while maintaining sync capability.
   *
   * @param table - The table containing the record
   * @param recordId - The ID of the record to soft delete
   * @param syncToCloud - Whether to sync this delete to Supabase (default: true)
   * @returns Result indicating success or failure
   */
  async softDelete(
    table: SoftDeleteTable,
    recordId: string,
    syncToCloud = true
  ): Promise<SoftDeleteResult> {
    const prisma = getPrismaClient();
    const deletedAt = new Date();

    try {
      switch (table) {
        case 'Project': {
          // Check if project exists and isn't already deleted
          const project = await prisma.project.findUnique({
            where: { id: recordId },
          });

          if (!project) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project not found',
            };
          }

          if (project.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project is already deleted',
            };
          }

          // Soft delete the project
          await prisma.project.update({
            where: { id: recordId },
            data: { deletedAt },
          });

          // Also soft delete all tasks in the project
          await prisma.task.updateMany({
            where: { projectId: recordId, deletedAt: null },
            data: { deletedAt },
          });

          // Also soft delete all project members
          await prisma.projectMember.updateMany({
            where: { projectId: recordId, deletedAt: null },
            data: { deletedAt },
          });

          break;
        }

        case 'Task': {
          const task = await prisma.task.findUnique({
            where: { id: recordId },
          });

          if (!task) {
            return {
              success: false,
              recordId,
              table,
              error: 'Task not found',
            };
          }

          if (task.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Task is already deleted',
            };
          }

          // Soft delete the task and its subtasks
          await prisma.task.update({
            where: { id: recordId },
            data: { deletedAt },
          });

          // Also soft delete subtasks
          await prisma.task.updateMany({
            where: { parentId: recordId, deletedAt: null },
            data: { deletedAt },
          });

          break;
        }

        case 'ProjectMember': {
          const member = await prisma.projectMember.findUnique({
            where: { id: recordId },
          });

          if (!member) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project member not found',
            };
          }

          if (member.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project member is already deleted',
            };
          }

          await prisma.projectMember.update({
            where: { id: recordId },
            data: { deletedAt },
          });

          break;
        }
      }

      // Queue sync operation if enabled
      if (syncToCloud) {
        // For soft deletes, we send an UPDATE with the deletedAt field
        // This allows other clients to see the deletion and handle conflicts
        syncQueueService.enqueue({
          table: table as SyncTable,
          recordId,
          operation: 'UPDATE' as SyncOperation,
          data: { deleted_at: deletedAt.toISOString() },
        });
      }

      console.log(`[SoftDelete] Soft deleted ${table}:${recordId}`);

      return {
        success: true,
        recordId,
        table,
        deletedAt,
      };
    } catch (error) {
      console.error(`[SoftDelete] Failed to soft delete ${table}:${recordId}:`, error);
      return {
        success: false,
        recordId,
        table,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Restore Operations
  // ============================================================================

  /**
   * Restore a soft-deleted record by clearing its deletedAt timestamp.
   *
   * @param table - The table containing the record
   * @param recordId - The ID of the record to restore
   * @param syncToCloud - Whether to sync this restore to Supabase (default: true)
   * @returns Result indicating success or failure
   */
  async restore(
    table: SoftDeleteTable,
    recordId: string,
    syncToCloud = true
  ): Promise<RestoreResult> {
    const prisma = getPrismaClient();

    try {
      switch (table) {
        case 'Project': {
          const project = await prisma.project.findUnique({
            where: { id: recordId },
          });

          if (!project) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project not found',
            };
          }

          if (!project.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project is not deleted',
            };
          }

          // Restore the project
          await prisma.project.update({
            where: { id: recordId },
            data: { deletedAt: null },
          });

          // Also restore all tasks that were deleted at the same time
          await prisma.task.updateMany({
            where: {
              projectId: recordId,
              deletedAt: project.deletedAt,
            },
            data: { deletedAt: null },
          });

          // Also restore project members deleted at the same time
          await prisma.projectMember.updateMany({
            where: {
              projectId: recordId,
              deletedAt: project.deletedAt,
            },
            data: { deletedAt: null },
          });

          break;
        }

        case 'Task': {
          const task = await prisma.task.findUnique({
            where: { id: recordId },
          });

          if (!task) {
            return {
              success: false,
              recordId,
              table,
              error: 'Task not found',
            };
          }

          if (!task.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Task is not deleted',
            };
          }

          // Check if parent project is also deleted
          const project = await prisma.project.findUnique({
            where: { id: task.projectId },
          });

          if (project?.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Cannot restore task: parent project is deleted',
            };
          }

          // Restore the task
          await prisma.task.update({
            where: { id: recordId },
            data: { deletedAt: null },
          });

          // Also restore subtasks deleted at the same time
          await prisma.task.updateMany({
            where: {
              parentId: recordId,
              deletedAt: task.deletedAt,
            },
            data: { deletedAt: null },
          });

          break;
        }

        case 'ProjectMember': {
          const member = await prisma.projectMember.findUnique({
            where: { id: recordId },
          });

          if (!member) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project member not found',
            };
          }

          if (!member.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Project member is not deleted',
            };
          }

          // Check if parent project is also deleted
          const project = await prisma.project.findUnique({
            where: { id: member.projectId },
          });

          if (project?.deletedAt) {
            return {
              success: false,
              recordId,
              table,
              error: 'Cannot restore member: project is deleted',
            };
          }

          await prisma.projectMember.update({
            where: { id: recordId },
            data: { deletedAt: null },
          });

          break;
        }
      }

      // Queue sync operation if enabled
      if (syncToCloud) {
        syncQueueService.enqueue({
          table: table as SyncTable,
          recordId,
          operation: 'UPDATE' as SyncOperation,
          data: { deleted_at: null },
        });
      }

      console.log(`[SoftDelete] Restored ${table}:${recordId}`);

      return {
        success: true,
        recordId,
        table,
      };
    } catch (error) {
      console.error(`[SoftDelete] Failed to restore ${table}:${recordId}:`, error);
      return {
        success: false,
        recordId,
        table,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Permanent Delete Operations
  // ============================================================================

  /**
   * Permanently delete a record from the database.
   *
   * WARNING: This cannot be undone. Use softDelete for normal deletion.
   * This is intended for cleanup of old soft-deleted records.
   *
   * @param table - The table containing the record
   * @param recordId - The ID of the record to permanently delete
   * @param syncToCloud - Whether to sync this delete to Supabase (default: true)
   * @returns Result indicating success or failure
   */
  async permanentDelete(
    table: SoftDeleteTable,
    recordId: string,
    syncToCloud = true
  ): Promise<SoftDeleteResult> {
    const prisma = getPrismaClient();

    try {
      switch (table) {
        case 'Project':
          // Cascade delete is handled by Prisma schema
          await prisma.project.delete({
            where: { id: recordId },
          });
          break;

        case 'Task':
          await prisma.task.delete({
            where: { id: recordId },
          });
          break;

        case 'ProjectMember':
          await prisma.projectMember.delete({
            where: { id: recordId },
          });
          break;
      }

      // Queue sync operation if enabled
      if (syncToCloud) {
        syncQueueService.enqueue({
          table: table as SyncTable,
          recordId,
          operation: 'DELETE' as SyncOperation,
          data: {},
        });
      }

      console.log(`[SoftDelete] Permanently deleted ${table}:${recordId}`);

      return {
        success: true,
        recordId,
        table,
      };
    } catch (error) {
      console.error(`[SoftDelete] Failed to permanently delete ${table}:${recordId}:`, error);
      return {
        success: false,
        recordId,
        table,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Cleanup Operations
  // ============================================================================

  /**
   * Clean up records that have been soft-deleted for longer than the specified number of days.
   *
   * This permanently removes old deleted records to prevent database bloat.
   * Should be run periodically (e.g., daily or weekly).
   *
   * @param daysOld - Delete records older than this many days (default: 30)
   * @param syncToCloud - Whether to sync deletions to Supabase (default: true)
   * @returns Result with count of deleted records and any errors
   */
  async cleanupOldDeleted(daysOld = 30, syncToCloud = true): Promise<CleanupResult> {
    const prisma = getPrismaClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result: CleanupResult = {
      success: true,
      deletedCount: 0,
      errors: [],
    };

    console.log(`[SoftDelete] Cleaning up records deleted before ${cutoffDate.toISOString()}`);

    try {
      // First, get all records to be deleted (for sync purposes)
      const oldProjects = await prisma.project.findMany({
        where: {
          deletedAt: { lt: cutoffDate },
        },
        select: { id: true },
      });

      const oldTasks = await prisma.task.findMany({
        where: {
          deletedAt: { lt: cutoffDate },
          // Don't include tasks from projects being deleted (cascade handles them)
          project: { deletedAt: null },
        },
        select: { id: true },
      });

      const oldMembers = await prisma.projectMember.findMany({
        where: {
          deletedAt: { lt: cutoffDate },
          // Don't include members from projects being deleted (cascade handles them)
          project: { deletedAt: null },
        },
        select: { id: true },
      });

      // Delete in correct order to respect foreign key constraints
      // 1. Delete standalone project members (not part of deleted projects)
      if (oldMembers.length > 0) {
        const memberResult = await prisma.projectMember.deleteMany({
          where: {
            deletedAt: { lt: cutoffDate },
            project: { deletedAt: null },
          },
        });
        result.deletedCount += memberResult.count;

        // Queue sync for each deleted member
        if (syncToCloud) {
          for (const member of oldMembers) {
            syncQueueService.enqueue({
              table: 'ProjectMember',
              recordId: member.id,
              operation: 'DELETE',
              data: {},
            });
          }
        }
      }

      // 2. Delete standalone tasks (not part of deleted projects)
      if (oldTasks.length > 0) {
        const taskResult = await prisma.task.deleteMany({
          where: {
            deletedAt: { lt: cutoffDate },
            project: { deletedAt: null },
          },
        });
        result.deletedCount += taskResult.count;

        // Queue sync for each deleted task
        if (syncToCloud) {
          for (const task of oldTasks) {
            syncQueueService.enqueue({
              table: 'Task',
              recordId: task.id,
              operation: 'DELETE',
              data: {},
            });
          }
        }
      }

      // 3. Delete projects (cascades to members and tasks)
      if (oldProjects.length > 0) {
        // Count tasks and members that will be cascade deleted
        const cascadeTaskCount = await prisma.task.count({
          where: { project: { deletedAt: { lt: cutoffDate } } },
        });
        const cascadeMemberCount = await prisma.projectMember.count({
          where: { project: { deletedAt: { lt: cutoffDate } } },
        });

        const projectResult = await prisma.project.deleteMany({
          where: { deletedAt: { lt: cutoffDate } },
        });
        result.deletedCount += projectResult.count + cascadeTaskCount + cascadeMemberCount;

        // Queue sync for each deleted project
        if (syncToCloud) {
          for (const project of oldProjects) {
            syncQueueService.enqueue({
              table: 'Project',
              recordId: project.id,
              operation: 'DELETE',
              data: {},
            });
          }
        }
      }

      console.log(`[SoftDelete] Cleanup complete: ${result.deletedCount} records permanently deleted`);
    } catch (error) {
      console.error('[SoftDelete] Cleanup failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  // ============================================================================
  // Query Helpers
  // ============================================================================

  /**
   * List all soft-deleted records.
   *
   * @param options - Options for filtering the list
   * @returns Array of deleted record summaries
   */
  async listDeleted(options: ListDeletedOptions = {}): Promise<DeletedRecordSummary[]> {
    const prisma = getPrismaClient();
    const { table, olderThanDays, limit = 100 } = options;

    const results: DeletedRecordSummary[] = [];

    // Calculate cutoff date if filtering by age
    let cutoffDate: Date | undefined;
    if (olderThanDays !== undefined) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    }

    const whereClause = {
      deletedAt: cutoffDate
        ? { not: null, lt: cutoffDate }
        : { not: null },
    };

    // Fetch deleted projects
    if (!table || table === 'Project') {
      const projects = await prisma.project.findMany({
        where: whereClause as { deletedAt: { not: null; lt?: Date } },
        select: { id: true, name: true, deletedAt: true },
        take: limit,
        orderBy: { deletedAt: 'desc' },
      });

      for (const p of projects) {
        if (p.deletedAt) {
          results.push({
            id: p.id,
            table: 'Project',
            deletedAt: p.deletedAt,
            name: p.name,
          });
        }
      }
    }

    // Fetch deleted tasks
    if (!table || table === 'Task') {
      const tasks = await prisma.task.findMany({
        where: whereClause as { deletedAt: { not: null; lt?: Date } },
        select: { id: true, title: true, deletedAt: true },
        take: limit,
        orderBy: { deletedAt: 'desc' },
      });

      for (const t of tasks) {
        if (t.deletedAt) {
          results.push({
            id: t.id,
            table: 'Task',
            deletedAt: t.deletedAt,
            name: t.title,
          });
        }
      }
    }

    // Fetch deleted project members
    if (!table || table === 'ProjectMember') {
      const members = await prisma.projectMember.findMany({
        where: whereClause as { deletedAt: { not: null; lt?: Date } },
        select: { id: true, deletedAt: true, user: { select: { email: true } } },
        take: limit,
        orderBy: { deletedAt: 'desc' },
      });

      for (const m of members) {
        if (m.deletedAt) {
          results.push({
            id: m.id,
            table: 'ProjectMember',
            deletedAt: m.deletedAt,
            name: m.user?.email,
          });
        }
      }
    }

    // Sort by deletedAt descending and limit
    return results
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Check if a record is soft-deleted.
   *
   * @param table - The table to check
   * @param recordId - The record ID
   * @returns True if the record is soft-deleted
   */
  async isDeleted(table: SoftDeleteTable, recordId: string): Promise<boolean> {
    const prisma = getPrismaClient();

    try {
      switch (table) {
        case 'Project': {
          const project = await prisma.project.findUnique({
            where: { id: recordId },
            select: { deletedAt: true },
          });
          return project?.deletedAt !== null && project?.deletedAt !== undefined;
        }

        case 'Task': {
          const task = await prisma.task.findUnique({
            where: { id: recordId },
            select: { deletedAt: true },
          });
          return task?.deletedAt !== null && task?.deletedAt !== undefined;
        }

        case 'ProjectMember': {
          const member = await prisma.projectMember.findUnique({
            where: { id: recordId },
            select: { deletedAt: true },
          });
          return member?.deletedAt !== null && member?.deletedAt !== undefined;
        }
      }
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Soft Delete Query Filters
// ============================================================================

/**
 * Common filter to exclude soft-deleted records.
 * Use this in Prisma queries to filter out deleted records.
 *
 * @example
 * const activeProjects = await prisma.project.findMany({
 *   where: {
 *     ...notDeleted,
 *     userId: someUserId,
 *   },
 * });
 */
export const notDeleted = { deletedAt: null } as const;

/**
 * Common filter to include only soft-deleted records.
 * Use this to query the "trash" or deleted items.
 *
 * @example
 * const deletedProjects = await prisma.project.findMany({
 *   where: onlyDeleted,
 * });
 */
export const onlyDeleted = { deletedAt: { not: null } } as const;

/**
 * Create a filter that includes both active and deleted records.
 * Use this when you need to see all records regardless of deletion status.
 *
 * @example
 * const allProjects = await prisma.project.findMany({
 *   where: includeDeleted,
 * });
 */
export const includeDeleted = {} as const;

// ============================================================================
// Export Singleton
// ============================================================================

export const softDeleteService = new SoftDeleteService();
