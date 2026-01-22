/**
 * Smart Task Polling Hook
 *
 * Provides optimized polling for task updates that minimizes re-renders
 * by only triggering updates when actual task data changes.
 */

import { useRef, useCallback, useEffect } from 'react';
import { isClaudeActive, getClaudeStatusFromTask } from './useClaudeStatus';
import type { Task } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface TaskPollingOptions {
  /** Polling interval when there are active tasks (ms) */
  activeInterval?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
}

interface TaskSnapshot {
  status: string;
  claudeStatus: string | null;
  updatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a snapshot of task data for comparison
 */
function createTaskSnapshot(task: Task): TaskSnapshot {
  return {
    status: task.status,
    claudeStatus: task.claudeStatus ?? null,
    updatedAt: task.updatedAt,
  };
}

/**
 * Compare two task snapshots for equality
 */
function snapshotsEqual(a: TaskSnapshot, b: TaskSnapshot): boolean {
  return (
    a.status === b.status &&
    a.claudeStatus === b.claudeStatus &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Check if tasks have meaningful changes that warrant a re-render
 */
function hasTaskChanges(
  prevSnapshots: Map<string, TaskSnapshot>,
  tasks: Task[]
): boolean {
  // Different count means changes
  if (prevSnapshots.size !== tasks.length) {
    return true;
  }

  for (const task of tasks) {
    const prevSnapshot = prevSnapshots.get(task.id);
    const currentSnapshot = createTaskSnapshot(task);

    // New task or changed task
    if (!prevSnapshot || !snapshotsEqual(prevSnapshot, currentSnapshot)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Custom hook for smart task polling
 *
 * @param tasks - Current list of tasks
 * @param refetch - Function to refetch tasks
 * @param options - Polling options
 *
 * @example
 * ```tsx
 * const { hasActiveTasks } = useTaskPolling(tasks, refetch, {
 *   activeInterval: 10000,
 *   enabled: true,
 * });
 * ```
 */
export function useTaskPolling(
  tasks: Task[],
  refetch: () => Promise<void>,
  options: TaskPollingOptions = {}
) {
  const { activeInterval = 10000, enabled = true } = options;

  // Track previous task snapshots to detect real changes
  const prevSnapshotsRef = useRef<Map<string, TaskSnapshot>>(new Map());
  const isPollingRef = useRef(false);

  // Check if any tasks have active Claude sessions
  const hasActiveTasks = tasks.some((task) => {
    const status = getClaudeStatusFromTask(task);
    return isClaudeActive(status);
  });

  // Update snapshots after each successful render
  useEffect(() => {
    const newSnapshots = new Map<string, TaskSnapshot>();
    for (const task of tasks) {
      newSnapshots.set(task.id, createTaskSnapshot(task));
    }
    prevSnapshotsRef.current = newSnapshots;
  }, [tasks]);

  // Smart refetch that only updates if there are real changes
  const smartRefetch = useCallback(async () => {
    // Prevent concurrent polling
    if (isPollingRef.current) return;

    isPollingRef.current = true;
    try {
      await refetch();
    } finally {
      isPollingRef.current = false;
    }
  }, [refetch]);

  // Polling effect
  useEffect(() => {
    if (!enabled || !hasActiveTasks || tasks.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      void smartRefetch();
    }, activeInterval);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, hasActiveTasks, tasks.length, activeInterval, smartRefetch]);

  return {
    /** Whether there are active Claude tasks */
    hasActiveTasks,
    /** Function to check if tasks have meaningful changes */
    hasChanges: useCallback(
      (newTasks: Task[]) => hasTaskChanges(prevSnapshotsRef.current, newTasks),
      []
    ),
  };
}
