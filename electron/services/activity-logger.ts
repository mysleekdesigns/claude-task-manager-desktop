/**
 * Activity Logger Service
 *
 * Manages batched recording of task activities for AI review workflows.
 * Uses debounced writes to minimize database operations during high-frequency
 * tool executions.
 */

import { databaseService } from './database.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type { TaskActivity } from '@prisma/client';

const logger = createIPCLogger('ActivityLogger');

/**
 * Activity entry to be recorded
 */
export interface ActivityEntry {
  /** Type of activity */
  type: 'tool_use' | 'text' | 'thinking' | 'error' | 'decision';
  /** Tool name if type is tool_use */
  toolName?: string;
  /** Human-readable summary of the activity */
  summary: string;
  /** Additional details as JSON-serializable object */
  details?: Record<string, unknown>;
  /** Duration in milliseconds */
  duration?: number;
  /** Timestamp when activity occurred */
  timestamp: number;
}

/**
 * Activity with database ID for API responses
 */
export interface ActivityWithId {
  id: string;
  type: 'tool_use' | 'text' | 'thinking' | 'error' | 'decision';
  /** Tool name if type is tool_use */
  toolName?: string | undefined;
  summary: string;
  details?: Record<string, unknown> | undefined;
  duration?: number | undefined;
  timestamp: number;
  createdAt: Date;
}

/**
 * Options for querying activities
 */
export interface GetActivitiesOptions {
  /** Maximum number of activities to return */
  limit?: number;
  /** Filter by activity type */
  type?: string;
  /** Offset for pagination */
  offset?: number;
}

/**
 * ActivityLoggerService manages activity recording with batched writes.
 *
 * Features:
 * - Batched writes to reduce database I/O
 * - Debounced flush (32ms delay by default)
 * - Per-task activity queuing
 * - Automatic cleanup on dispose
 */
class ActivityLoggerService {
  /** Pending activities per task, not yet written to database */
  private pendingBatch: Map<string, ActivityEntry[]> = new Map();

  /** Flush timers per task for debouncing */
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Delay before flushing activities to database (milliseconds) */
  private readonly BATCH_DELAY = 32;

  /**
   * Record an activity for a task.
   *
   * Activities are batched and written to the database after a short delay
   * to improve performance during rapid tool execution sequences.
   *
   * @param taskId - The task ID to record activity for
   * @param activity - The activity entry to record
   */
  recordActivity(taskId: string, activity: ActivityEntry): void {
    // Get or create the batch for this task
    let batch = this.pendingBatch.get(taskId);
    if (!batch) {
      batch = [];
      this.pendingBatch.set(taskId, batch);
    }

    // Add activity to batch
    batch.push(activity);
    logger.debug(`Recorded activity for task ${taskId}: ${activity.summary}`);

    // Clear existing timer for this task
    const existingTimer = this.flushTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced flush timer
    const timer = setTimeout(() => {
      void this.flushActivities(taskId);
    }, this.BATCH_DELAY);
    this.flushTimers.set(taskId, timer);
  }

  /**
   * Flush all pending activities for a task to the database.
   *
   * This is called automatically after the batch delay, but can also
   * be called manually before starting AI review to ensure all activities
   * are persisted.
   *
   * @param taskId - The task ID to flush activities for
   */
  async flushActivities(taskId: string): Promise<void> {
    const batch = this.pendingBatch.get(taskId);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear the batch and timer
    this.pendingBatch.delete(taskId);
    const timer = this.flushTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(taskId);
    }

    try {
      const prisma = databaseService.getClient();

      // Create all activities in a single batch operation
      await prisma.taskActivity.createMany({
        data: batch.map((activity) => ({
          taskId,
          type: activity.type,
          toolName: activity.toolName ?? null,
          summary: activity.summary,
          details: activity.details ? JSON.stringify(activity.details) : null,
          duration: activity.duration ?? null,
          createdAt: new Date(activity.timestamp),
        })),
      });

      logger.info(`Flushed ${String(batch.length)} activities for task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to flush activities for task ${taskId}:`, error);
      // Re-add activities to batch on failure for retry
      const currentBatch = this.pendingBatch.get(taskId) ?? [];
      this.pendingBatch.set(taskId, [...batch, ...currentBatch]);
      throw error;
    }
  }

  /**
   * Flush all pending activities for all tasks.
   *
   * Useful during shutdown or before major operations.
   */
  async flushAll(): Promise<void> {
    const taskIds = Array.from(this.pendingBatch.keys());

    for (const taskId of taskIds) {
      await this.flushActivities(taskId);
    }
  }

  /**
   * Get activities for a task from the database.
   *
   * @param taskId - The task ID to query
   * @param options - Query options (limit, type filter, offset)
   * @returns Array of activities
   */
  async getActivities(
    taskId: string,
    options?: GetActivitiesOptions
  ): Promise<ActivityWithId[]> {
    const prisma = databaseService.getClient();

    const whereClause: { taskId: string; type?: string } = { taskId };
    if (options?.type) {
      whereClause.type = options.type;
    }

    const activities = await prisma.taskActivity.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });

    return activities.map((activity: TaskActivity) => ({
      id: activity.id,
      type: activity.type as ActivityEntry['type'],
      toolName: activity.toolName ?? undefined,
      summary: activity.summary,
      details: activity.details
        ? (JSON.parse(activity.details) as Record<string, unknown>)
        : undefined,
      duration: activity.duration ?? undefined,
      timestamp: activity.createdAt.getTime(),
      createdAt: activity.createdAt,
    }));
  }

  /**
   * Get pending (unflushed) activities for a task.
   *
   * @param taskId - The task ID to query
   * @returns Array of pending activities
   */
  getPendingActivities(taskId: string): ActivityEntry[] {
    return this.pendingBatch.get(taskId) ?? [];
  }

  /**
   * Check if there are pending activities for a task.
   *
   * @param taskId - The task ID to check
   * @returns True if there are pending activities
   */
  hasPendingActivities(taskId: string): boolean {
    const batch = this.pendingBatch.get(taskId);
    return batch !== undefined && batch.length > 0;
  }

  /**
   * Dispose of the service, clearing all timers.
   *
   * Note: This does NOT flush pending activities. Call flushAll()
   * before dispose() if you need to persist pending activities.
   */
  dispose(): void {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer);
    }
    this.flushTimers.clear();

    // Clear pending batches
    this.pendingBatch.clear();

    logger.info('ActivityLoggerService disposed');
  }
}

// Export singleton instance
export const activityLogger = new ActivityLoggerService();
