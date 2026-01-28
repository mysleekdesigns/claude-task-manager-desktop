/**
 * Sync Engine Service
 *
 * Handles initial/bootstrap sync and incremental sync between local SQLite and Supabase.
 *
 * Features:
 * - Full sync on first connect (bootstrap): fetches all user's projects and tasks
 * - Incremental sync after bootstrap: only fetches records updated since last sync
 * - Tracks sync state persistently using electron-store
 * - Maps Supabase snake_case to Prisma camelCase
 * - Handles local-first records (without supabaseId)
 *
 * @module electron/services/sync-engine
 * @phase 17 - Real-Time Sync Engine
 */

import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { supabaseService } from './supabase';
import { getPrismaClient } from './database';
import { syncQueueService } from './sync-queue';
import {
  conflictResolverService,
  type LocalRecord,
  type RemoteRecord,
  type ConflictTable,
} from './conflict-resolver';

// ============================================================================
// Types
// ============================================================================

/**
 * Sync state persisted to electron-store
 */
interface SyncState {
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  syncInProgress: boolean;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  projectsSynced: number;
  tasksSynced: number;
  projectMembersSynced: number;
  /** Number of conflicts detected during sync */
  conflictsDetected: number;
  /** Number of conflicts resolved with local winning */
  conflictsLocalWins: number;
  /** Number of conflicts resolved with remote winning */
  conflictsRemoteWins: number;
  errors: string[];
  duration: number;
}

/**
 * Sync progress callback type
 */
export type SyncProgressCallback = (message: string, progress: number) => void;

/**
 * Remote project structure from Supabase
 */
interface RemoteProject {
  id: string;
  name: string;
  description: string | null;
  target_path: string | null;
  github_repo: string | null;
  sync_version: number;
  deleted_at: string | null; // Soft delete timestamp
  created_at: string;
  updated_at: string;
}

/**
 * Remote task structure from Supabase
 */
interface RemoteTask {
  id: string;
  title: string;
  description: string | null;
  branch_name: string | null;
  status: string;
  priority: string;
  tags: string;
  project_id: string;
  assignee_id: string | null;
  parent_id: string | null;
  sync_version: number;
  deleted_at: string | null; // Soft delete timestamp
  created_at: string;
  updated_at: string;
}

/**
 * Remote project member structure from Supabase
 */
interface RemoteProjectMember {
  id: string;
  role: string;
  user_id: string;
  project_id: string;
  deleted_at: string | null; // Soft delete timestamp
  created_at: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYNC_BATCH_SIZE = 100;

// ============================================================================
// SyncEngineService Class
// ============================================================================

/**
 * Service for managing sync operations between local SQLite and Supabase
 *
 * Provides:
 * - Full sync (bootstrap) for initial data fetch
 * - Incremental sync for delta updates
 * - Sync state persistence
 * - Progress reporting to renderer
 */
class SyncEngineService {
  private store: Store<SyncState>;
  private mainWindow: BrowserWindow | null = null;
  private syncInProgress = false;
  private progressCallbacks: Set<SyncProgressCallback> = new Set();

  constructor() {
    this.store = new Store<SyncState>({
      name: 'sync-engine-state',
      defaults: {
        lastFullSyncAt: null,
        lastIncrementalSyncAt: null,
        syncInProgress: false,
      },
    });
  }

  // ============================================================================
  // Window Management
  // ============================================================================

  /**
   * Set the main window reference for IPC communication
   *
   * @param window - The main BrowserWindow instance
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    // Also set on conflict resolver for conflict event emission
    conflictResolverService.setMainWindow(window);
  }

  /**
   * Clear the main window reference
   */
  public clearMainWindow(): void {
    this.mainWindow = null;
    conflictResolverService.clearMainWindow();
  }

  // ============================================================================
  // Sync State Management
  // ============================================================================

  /**
   * Check if a full sync has ever been completed
   *
   * @returns True if full sync is needed
   */
  public needsFullSync(): boolean {
    return !this.store.get('lastFullSyncAt');
  }

  /**
   * Get the last full sync timestamp
   *
   * @returns ISO timestamp or null
   */
  public getLastFullSyncAt(): string | null {
    return this.store.get('lastFullSyncAt');
  }

  /**
   * Get the last incremental sync timestamp
   *
   * @returns ISO timestamp or null
   */
  public getLastIncrementalSyncAt(): string | null {
    return this.store.get('lastIncrementalSyncAt');
  }

  /**
   * Check if sync is currently in progress
   *
   * @returns True if sync is running
   */
  public isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Subscribe to sync progress updates
   *
   * @param callback - Function to call with progress updates
   * @returns Unsubscribe function
   */
  public onProgress(callback: SyncProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  // ============================================================================
  // Progress Reporting
  // ============================================================================

  /**
   * Report sync progress to all listeners and renderer
   *
   * @param message - Progress message
   * @param progress - Progress percentage (0-100)
   */
  private reportProgress(message: string, progress: number): void {
    console.log(`[SyncEngine] ${message} (${progress}%)`);

    // Notify callbacks
    this.progressCallbacks.forEach((cb) => {
      try {
        cb(message, progress);
      } catch (error) {
        console.error('[SyncEngine] Error in progress callback:', error);
      }
    });

    // Send to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:progress', { message, progress });
    }
  }

  // ============================================================================
  // Full Sync (Bootstrap)
  // ============================================================================

  /**
   * Perform a full sync from Supabase to local database
   *
   * Fetches all projects the user is a member of, along with all tasks
   * in those projects. This is called on first connect or for manual full sync.
   *
   * @param userId - The Supabase user ID
   * @returns SyncResult with counts and any errors
   */
  public async performFullSync(userId: string): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        projectsSynced: 0,
        tasksSynced: 0,
        projectMembersSynced: 0,
        conflictsDetected: 0,
        conflictsLocalWins: 0,
        conflictsRemoteWins: 0,
        errors: ['Sync already in progress'],
        duration: 0,
      };
    }

    // Check if Supabase is initialized
    if (!supabaseService.isInitialized()) {
      return {
        success: false,
        projectsSynced: 0,
        tasksSynced: 0,
        projectMembersSynced: 0,
        conflictsDetected: 0,
        conflictsLocalWins: 0,
        conflictsRemoteWins: 0,
        errors: ['Supabase not initialized'],
        duration: 0,
      };
    }

    const startTime = Date.now();
    this.syncInProgress = true;
    this.store.set('syncInProgress', true);

    const result: SyncResult = {
      success: true,
      projectsSynced: 0,
      tasksSynced: 0,
      projectMembersSynced: 0,
      conflictsDetected: 0,
      conflictsLocalWins: 0,
      conflictsRemoteWins: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.reportProgress('Starting full sync...', 0);

      const supabase = supabaseService.getClient();
      const prisma = getPrismaClient();

      // Step 1: Fetch all project memberships for the user
      this.reportProgress('Fetching project memberships...', 10);

      const { data: memberships, error: membershipsError } = await supabase
        .from('project_members')
        .select('*, projects(*)')
        .eq('user_id', userId);

      if (membershipsError) {
        throw new Error(`Failed to fetch memberships: ${membershipsError.message}`);
      }

      if (!memberships || memberships.length === 0) {
        this.reportProgress('No projects found', 100);
        this.store.set('lastFullSyncAt', new Date().toISOString());
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 2: Extract and sync projects
      this.reportProgress('Syncing projects...', 20);

      const remoteProjects = memberships
        .map((m) => m.projects as RemoteProject | null)
        .filter((p): p is RemoteProject => p !== null);

      for (const remoteProject of remoteProjects) {
        try {
          await this.upsertLocalProject(prisma, remoteProject, result);
          result.projectsSynced++;
        } catch (error) {
          result.errors.push(
            `Failed to sync project ${remoteProject.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this.reportProgress(`Synced ${result.projectsSynced} projects`, 40);

      // Step 3: Sync project memberships
      this.reportProgress('Syncing project memberships...', 50);

      for (const membership of memberships) {
        try {
          await this.upsertLocalProjectMember(prisma, membership as RemoteProjectMember, userId);
          result.projectMembersSynced++;
        } catch (error) {
          result.errors.push(
            `Failed to sync membership ${membership.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Step 4: Fetch and sync tasks for all projects
      this.reportProgress('Fetching tasks...', 60);

      const projectIds = remoteProjects.map((p) => p.id);

      // Fetch tasks in batches if many projects
      let allTasks: RemoteTask[] = [];

      for (let i = 0; i < projectIds.length; i += SYNC_BATCH_SIZE) {
        const batchIds = projectIds.slice(i, i + SYNC_BATCH_SIZE);
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('project_id', batchIds);

        if (tasksError) {
          result.errors.push(`Failed to fetch tasks batch: ${tasksError.message}`);
          continue;
        }

        if (tasks) {
          allTasks = allTasks.concat(tasks as RemoteTask[]);
        }
      }

      this.reportProgress(`Syncing ${allTasks.length} tasks...`, 70);

      // Step 5: Sync tasks
      for (const remoteTask of allTasks) {
        try {
          await this.upsertLocalTask(prisma, remoteTask, result);
          result.tasksSynced++;
        } catch (error) {
          result.errors.push(
            `Failed to sync task ${remoteTask.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this.reportProgress(`Synced ${result.tasksSynced} tasks`, 90);

      // Step 6: Process any pending outbound changes
      this.reportProgress('Processing outbound changes...', 95);
      await syncQueueService.processQueue();

      // Update sync state
      const now = new Date().toISOString();
      this.store.set('lastFullSyncAt', now);
      this.store.set('lastIncrementalSyncAt', now);

      this.reportProgress('Full sync complete', 100);

      if (result.errors.length > 0) {
        result.success = false;
      }
    } catch (error) {
      console.error('[SyncEngine] Full sync failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      this.syncInProgress = false;
      this.store.set('syncInProgress', false);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  // ============================================================================
  // Incremental Sync
  // ============================================================================

  /**
   * Perform an incremental sync, fetching only records updated since last sync
   *
   * @param userId - The Supabase user ID
   * @returns SyncResult with counts and any errors
   */
  public async performIncrementalSync(userId: string): Promise<SyncResult> {
    // If no previous sync, do a full sync instead
    if (this.needsFullSync()) {
      console.log('[SyncEngine] No previous sync found, performing full sync');
      return this.performFullSync(userId);
    }

    if (this.syncInProgress) {
      return {
        success: false,
        projectsSynced: 0,
        tasksSynced: 0,
        projectMembersSynced: 0,
        conflictsDetected: 0,
        conflictsLocalWins: 0,
        conflictsRemoteWins: 0,
        errors: ['Sync already in progress'],
        duration: 0,
      };
    }

    // Check if Supabase is initialized
    if (!supabaseService.isInitialized()) {
      return {
        success: false,
        projectsSynced: 0,
        tasksSynced: 0,
        projectMembersSynced: 0,
        conflictsDetected: 0,
        conflictsLocalWins: 0,
        conflictsRemoteWins: 0,
        errors: ['Supabase not initialized'],
        duration: 0,
      };
    }

    const startTime = Date.now();
    this.syncInProgress = true;
    this.store.set('syncInProgress', true);

    const result: SyncResult = {
      success: true,
      projectsSynced: 0,
      tasksSynced: 0,
      projectMembersSynced: 0,
      conflictsDetected: 0,
      conflictsLocalWins: 0,
      conflictsRemoteWins: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.reportProgress('Starting incremental sync...', 0);

      const supabase = supabaseService.getClient();
      const prisma = getPrismaClient();

      // Get the last sync timestamp
      const lastSync =
        this.store.get('lastIncrementalSyncAt') || this.store.get('lastFullSyncAt');

      if (!lastSync) {
        // Should not happen, but fallback to full sync
        return this.performFullSync(userId);
      }

      // Step 1: Fetch updated projects
      this.reportProgress('Fetching updated projects...', 20);

      const { data: updatedMemberships, error: membershipsError } = await supabase
        .from('project_members')
        .select('*, projects(*)')
        .eq('user_id', userId)
        .gt('projects.updated_at', lastSync);

      if (membershipsError) {
        // Non-fatal - continue with other syncs
        result.errors.push(`Failed to fetch updated projects: ${membershipsError.message}`);
      } else if (updatedMemberships) {
        const updatedProjects = updatedMemberships
          .map((m) => m.projects as RemoteProject | null)
          .filter((p): p is RemoteProject => p !== null);

        for (const remoteProject of updatedProjects) {
          try {
            await this.upsertLocalProject(prisma, remoteProject, result);
            result.projectsSynced++;
          } catch (error) {
            result.errors.push(
              `Failed to sync project ${remoteProject.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      this.reportProgress(`Synced ${result.projectsSynced} updated projects`, 40);

      // Step 2: Fetch updated tasks
      this.reportProgress('Fetching updated tasks...', 50);

      // Get all project IDs the user has access to
      const { data: allMemberships, error: allMembershipsError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      if (allMembershipsError) {
        result.errors.push(`Failed to fetch project IDs: ${allMembershipsError.message}`);
      } else if (allMemberships && allMemberships.length > 0) {
        const projectIds = allMemberships.map((m) => m.project_id);

        const { data: updatedTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('project_id', projectIds)
          .gt('updated_at', lastSync);

        if (tasksError) {
          result.errors.push(`Failed to fetch updated tasks: ${tasksError.message}`);
        } else if (updatedTasks) {
          for (const remoteTask of updatedTasks as RemoteTask[]) {
            try {
              await this.upsertLocalTask(prisma, remoteTask, result);
              result.tasksSynced++;
            } catch (error) {
              result.errors.push(
                `Failed to sync task ${remoteTask.id}: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      }

      this.reportProgress(`Synced ${result.tasksSynced} updated tasks`, 80);

      // Step 3: Process outbound changes
      this.reportProgress('Processing outbound changes...', 90);
      await syncQueueService.processQueue();

      // Update sync state
      this.store.set('lastIncrementalSyncAt', new Date().toISOString());

      this.reportProgress('Incremental sync complete', 100);

      if (result.errors.length > 0) {
        result.success = false;
      }
    } catch (error) {
      console.error('[SyncEngine] Incremental sync failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      this.syncInProgress = false;
      this.store.set('syncInProgress', false);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  // ============================================================================
  // Smart Sync
  // ============================================================================

  /**
   * Perform the appropriate sync based on current state
   *
   * Automatically chooses between full sync (if needed) or incremental sync.
   *
   * @param userId - The Supabase user ID
   * @returns SyncResult
   */
  public async performSync(userId: string): Promise<SyncResult> {
    if (this.needsFullSync()) {
      return this.performFullSync(userId);
    }
    return this.performIncrementalSync(userId);
  }

  // ============================================================================
  // Local Database Upsert Methods
  // ============================================================================

  /**
   * Upsert a project from Supabase into local SQLite with conflict detection
   *
   * @param prisma - Prisma client instance
   * @param remote - Remote project data from Supabase
   * @param syncResult - Optional SyncResult to update with conflict statistics
   */
  private async upsertLocalProject(
    prisma: ReturnType<typeof getPrismaClient>,
    remote: RemoteProject,
    syncResult?: SyncResult
  ): Promise<void> {
    // Check if we have a local record with this supabaseId
    const existing = await prisma.project.findFirst({
      where: { supabaseId: remote.id },
    });

    const localData = {
      name: remote.name,
      description: remote.description,
      targetPath: remote.target_path,
      githubRepo: remote.github_repo,
      syncVersion: remote.sync_version || 0,
      lastSyncedAt: new Date(),
      // Sync soft delete status from remote
      deletedAt: remote.deleted_at ? new Date(remote.deleted_at) : null,
    };

    if (existing) {
      // Use conflict resolver for existing records
      const localRecord: LocalRecord = {
        id: existing.id,
        syncVersion: existing.syncVersion || 0,
        updatedAt: existing.updatedAt,
        name: existing.name,
        description: existing.description,
        targetPath: existing.targetPath,
        githubRepo: existing.githubRepo,
      };

      const remoteRecord: RemoteRecord = {
        id: remote.id,
        sync_version: remote.sync_version || 0,
        updated_at: remote.updated_at,
        name: remote.name,
        description: remote.description,
        target_path: remote.target_path,
        github_repo: remote.github_repo,
      };

      const conflictResult = await conflictResolverService.handleConflict(
        'Project' as ConflictTable,
        localRecord,
        remoteRecord
      );

      // Update statistics
      if (syncResult && conflictResult.hasConflict) {
        syncResult.conflictsDetected++;
        if (conflictResult.decision === 'local_wins') {
          syncResult.conflictsLocalWins++;
        } else if (conflictResult.decision === 'remote_wins') {
          syncResult.conflictsRemoteWins++;
        }
      }

      // Apply resolution if remote wins or no conflict but remote is newer
      if (conflictResult.decision === 'remote_wins' || !conflictResult.hasConflict) {
        // Only update if there are actual changes
        if (remote.sync_version > (existing.syncVersion || 0) || conflictResult.hasConflict) {
          await prisma.project.update({
            where: { id: existing.id },
            data: {
              ...localData,
              syncVersion: (conflictResult.resolvedData['syncVersion'] as number) || localData.syncVersion,
            },
          });
          console.log(
            `[SyncEngine] Updated project: ${existing.id} (supabase: ${remote.id})` +
            (conflictResult.hasConflict ? ` [conflict resolved: ${conflictResult.decision}]` : '')
          );
        }
      } else {
        // Local wins - keep local data but note the resolution
        console.log(
          `[SyncEngine] Kept local project (conflict resolved: local_wins): ${existing.id}`
        );
      }
    } else {
      // Check if there's a local record without supabaseId that matches by name
      // This handles the local-first case
      const localByName = await prisma.project.findFirst({
        where: {
          name: remote.name,
          supabaseId: null,
        },
      });

      if (localByName) {
        // Link existing local record to remote
        await prisma.project.update({
          where: { id: localByName.id },
          data: {
            ...localData,
            supabaseId: remote.id,
          },
        });
        console.log(`[SyncEngine] Linked local project to remote: ${localByName.id} -> ${remote.id}`);
      } else {
        // Create new local record
        await prisma.project.create({
          data: {
            ...localData,
            supabaseId: remote.id,
            createdAt: new Date(remote.created_at),
          },
        });
        console.log(`[SyncEngine] Created local project from remote: ${remote.id}`);
      }
    }
  }

  /**
   * Upsert a task from Supabase into local SQLite with conflict detection
   *
   * @param prisma - Prisma client instance
   * @param remote - Remote task data from Supabase
   * @param syncResult - Optional SyncResult to update with conflict statistics
   */
  private async upsertLocalTask(
    prisma: ReturnType<typeof getPrismaClient>,
    remote: RemoteTask,
    syncResult?: SyncResult
  ): Promise<void> {
    // First, find the local project by supabaseId
    const localProject = await prisma.project.findFirst({
      where: { supabaseId: remote.project_id },
    });

    if (!localProject) {
      console.warn(
        `[SyncEngine] Cannot sync task ${remote.id}: project ${remote.project_id} not found locally`
      );
      return;
    }

    // Check if we have a local record with this supabaseId
    const existing = await prisma.task.findFirst({
      where: { supabaseId: remote.id },
    });

    // Handle parent task reference if present
    let localParentId: string | null = null;
    if (remote.parent_id) {
      const localParent = await prisma.task.findFirst({
        where: { supabaseId: remote.parent_id },
      });
      localParentId = localParent?.id ?? null;
    }

    const localData = {
      title: remote.title,
      description: remote.description,
      branchName: remote.branch_name,
      status: remote.status,
      priority: remote.priority,
      tags: remote.tags || '[]',
      projectId: localProject.id,
      parentId: localParentId,
      // Note: assigneeId mapping would require user sync, skip for now
      syncVersion: remote.sync_version || 0,
      lastSyncedAt: new Date(),
      // Sync soft delete status from remote
      deletedAt: remote.deleted_at ? new Date(remote.deleted_at) : null,
    };

    if (existing) {
      // Use conflict resolver for existing records
      const localRecord: LocalRecord = {
        id: existing.id,
        syncVersion: existing.syncVersion || 0,
        updatedAt: existing.updatedAt,
        title: existing.title,
        description: existing.description,
        branchName: existing.branchName,
        status: existing.status,
        priority: existing.priority,
        tags: existing.tags,
      };

      const remoteRecord: RemoteRecord = {
        id: remote.id,
        sync_version: remote.sync_version || 0,
        updated_at: remote.updated_at,
        title: remote.title,
        description: remote.description,
        branch_name: remote.branch_name,
        status: remote.status,
        priority: remote.priority,
        tags: remote.tags,
      };

      const conflictResult = await conflictResolverService.handleConflict(
        'Task' as ConflictTable,
        localRecord,
        remoteRecord
      );

      // Update statistics
      if (syncResult && conflictResult.hasConflict) {
        syncResult.conflictsDetected++;
        if (conflictResult.decision === 'local_wins') {
          syncResult.conflictsLocalWins++;
        } else if (conflictResult.decision === 'remote_wins') {
          syncResult.conflictsRemoteWins++;
        }
      }

      // Apply resolution if remote wins or no conflict but remote is newer
      if (conflictResult.decision === 'remote_wins' || !conflictResult.hasConflict) {
        // Only update if there are actual changes
        if (remote.sync_version > (existing.syncVersion || 0) || conflictResult.hasConflict) {
          await prisma.task.update({
            where: { id: existing.id },
            data: {
              ...localData,
              syncVersion: (conflictResult.resolvedData['syncVersion'] as number) || localData.syncVersion,
            },
          });
          console.log(
            `[SyncEngine] Updated task: ${existing.id} (supabase: ${remote.id})` +
            (conflictResult.hasConflict ? ` [conflict resolved: ${conflictResult.decision}]` : '')
          );
        }
      } else {
        // Local wins - keep local data but note the resolution
        console.log(
          `[SyncEngine] Kept local task (conflict resolved: local_wins): ${existing.id}`
        );
      }
    } else {
      // Check if there's a local task without supabaseId that matches
      const localByTitle = await prisma.task.findFirst({
        where: {
          title: remote.title,
          projectId: localProject.id,
          supabaseId: null,
        },
      });

      if (localByTitle) {
        // Link existing local task to remote
        await prisma.task.update({
          where: { id: localByTitle.id },
          data: {
            ...localData,
            supabaseId: remote.id,
          },
        });
        console.log(`[SyncEngine] Linked local task to remote: ${localByTitle.id} -> ${remote.id}`);
      } else {
        // Create new local task
        await prisma.task.create({
          data: {
            ...localData,
            supabaseId: remote.id,
            createdAt: new Date(remote.created_at),
          },
        });
        console.log(`[SyncEngine] Created local task from remote: ${remote.id}`);
      }
    }
  }

  /**
   * Upsert a project member from Supabase into local SQLite
   *
   * @param prisma - Prisma client instance
   * @param remote - Remote project member data from Supabase
   * @param localUserId - The local user ID (we map the Supabase user to local user)
   */
  private async upsertLocalProjectMember(
    prisma: ReturnType<typeof getPrismaClient>,
    remote: RemoteProjectMember,
    localUserId: string
  ): Promise<void> {
    // Find the local project by supabaseId
    const localProject = await prisma.project.findFirst({
      where: { supabaseId: remote.project_id },
    });

    if (!localProject) {
      console.warn(
        `[SyncEngine] Cannot sync membership ${remote.id}: project ${remote.project_id} not found locally`
      );
      return;
    }

    // For now, we only sync the current user's memberships
    // Check if membership already exists
    const existing = await prisma.projectMember.findFirst({
      where: {
        projectId: localProject.id,
        userId: localUserId,
      },
    });

    if (existing) {
      // Update role and deletedAt if changed
      const needsUpdate = existing.role !== remote.role ||
        (existing.deletedAt?.toISOString() ?? null) !== remote.deleted_at;

      if (needsUpdate) {
        await prisma.projectMember.update({
          where: { id: existing.id },
          data: {
            role: remote.role,
            deletedAt: remote.deleted_at ? new Date(remote.deleted_at) : null,
          },
        });
        console.log(`[SyncEngine] Updated membership: ${existing.id}`);
      }
    } else {
      // Create new membership
      await prisma.projectMember.create({
        data: {
          role: remote.role,
          userId: localUserId,
          projectId: localProject.id,
          deletedAt: remote.deleted_at ? new Date(remote.deleted_at) : null,
        },
      });
      console.log(`[SyncEngine] Created local membership for project: ${localProject.id}`);
    }
  }

  // ============================================================================
  // Manual Sync State Management
  // ============================================================================

  /**
   * Reset sync state (useful for debugging or forcing full re-sync)
   */
  public resetSyncState(): void {
    this.store.set('lastFullSyncAt', null);
    this.store.set('lastIncrementalSyncAt', null);
    console.log('[SyncEngine] Sync state reset');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up resources on app quit
   */
  public cleanup(): void {
    this.progressCallbacks.clear();
    this.mainWindow = null;
    conflictResolverService.cleanup();
    console.log('[SyncEngine] Cleanup complete');
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const syncEngineService = new SyncEngineService();
