/**
 * Real-Time Task Updates Hook
 *
 * Subscribes to task changes and provides information about recently
 * updated tasks, including who edited them and what type of change occurred.
 *
 * This is a mock implementation that will be connected to Supabase
 * real-time subscriptions in a future phase.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a user who edited a task
 */
export interface TaskEditor {
  id: string;
  name: string;
  avatar?: string | undefined;
}

/**
 * Types of task updates that can occur
 */
export type TaskUpdateType = 'created' | 'updated' | 'deleted' | 'moved';

/**
 * A real-time task update event
 */
export interface TaskUpdate {
  taskId: string;
  type: TaskUpdateType;
  editedBy: TaskEditor;
  timestamp: Date;
  previousStatus?: string;
  newStatus?: string;
}

/**
 * Information about a recently changed task
 */
export interface RecentChange {
  taskId: string;
  type: TaskUpdateType;
  editedBy: TaskEditor;
  timestamp: Date;
  previousStatus?: string;
  newStatus?: string;
}

/**
 * Return type for the useTaskRealtimeUpdates hook
 */
export interface UseTaskRealtimeUpdatesResult {
  /** Set of task IDs that were recently changed */
  recentlyChangedTaskIds: Set<string>;
  /** Map of task ID to editor information */
  taskEditors: Map<string, TaskEditor>;
  /** Map of task ID to update type */
  taskUpdateTypes: Map<string, TaskUpdateType>;
  /** Map of task ID to previous status (for move animations) */
  taskPreviousStatus: Map<string, string>;
  /** Clear a specific task from recent changes */
  clearRecentChange: (taskId: string) => void;
  /** Manually trigger a task update (for optimistic updates) */
  triggerUpdate: (update: TaskUpdate) => void;
  /** Whether real-time connection is active */
  isConnected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Duration in milliseconds before a recent change expires */
const RECENT_CHANGE_DURATION = 3000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for subscribing to real-time task updates.
 *
 * @param projectId - The project ID to subscribe to updates for
 * @param tasks - Current list of tasks (used for change detection)
 * @param currentUserId - The current user's ID (to filter out own changes)
 * @returns Real-time update state and utilities
 *
 * @example
 * ```tsx
 * function KanbanBoard({ projectId, tasks }) {
 *   const {
 *     recentlyChangedTaskIds,
 *     taskEditors,
 *     clearRecentChange,
 *   } = useTaskRealtimeUpdates(projectId, tasks, currentUserId);
 *
 *   return tasks.map(task => (
 *     <TaskCardHighlight
 *       key={task.id}
 *       isHighlighted={recentlyChangedTaskIds.has(task.id)}
 *       onHighlightEnd={() => clearRecentChange(task.id)}
 *     >
 *       <TaskCard task={task} />
 *       {taskEditors.has(task.id) && (
 *         <EditedByIndicator editor={taskEditors.get(task.id)!} />
 *       )}
 *     </TaskCardHighlight>
 *   ));
 * }
 * ```
 */
export function useTaskRealtimeUpdates(
  projectId: string | undefined,
  tasks: Task[],
  currentUserId?: string
): UseTaskRealtimeUpdatesResult {
  // State for tracking recent changes
  const [recentlyChangedTaskIds, setRecentlyChangedTaskIds] = useState<Set<string>>(
    new Set()
  );
  const [taskEditors, setTaskEditors] = useState<Map<string, TaskEditor>>(
    new Map()
  );
  const [taskUpdateTypes, setTaskUpdateTypes] = useState<Map<string, TaskUpdateType>>(
    new Map()
  );
  const [taskPreviousStatus, setTaskPreviousStatus] = useState<Map<string, string>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);

  // Refs for cleanup timers
  const cleanupTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Track previous tasks for change detection
  const prevTasksRef = useRef<Map<string, Task>>(new Map());

  /**
   * Clear a specific task from recent changes
   */
  const clearRecentChange = useCallback((taskId: string) => {
    setRecentlyChangedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setTaskEditors((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    setTaskUpdateTypes((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    setTaskPreviousStatus((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });

    // Clear any pending timer for this task
    const timer = cleanupTimersRef.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      cleanupTimersRef.current.delete(taskId);
    }
  }, []);

  /**
   * Manually trigger a task update
   */
  const triggerUpdate = useCallback(
    (update: TaskUpdate) => {
      // Don't show updates from the current user
      if (currentUserId && update.editedBy.id === currentUserId) {
        return;
      }

      // Add to recent changes
      setRecentlyChangedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(update.taskId);
        return next;
      });

      setTaskEditors((prev) => {
        const next = new Map(prev);
        next.set(update.taskId, update.editedBy);
        return next;
      });

      setTaskUpdateTypes((prev) => {
        const next = new Map(prev);
        next.set(update.taskId, update.type);
        return next;
      });

      if (update.previousStatus) {
        setTaskPreviousStatus((prev) => {
          const next = new Map(prev);
          next.set(update.taskId, update.previousStatus!);
          return next;
        });
      }

      // Clear any existing timer for this task
      const existingTimer = cleanupTimersRef.current.get(update.taskId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set auto-cleanup timer
      const timer = setTimeout(() => {
        clearRecentChange(update.taskId);
      }, RECENT_CHANGE_DURATION);

      cleanupTimersRef.current.set(update.taskId, timer);
    },
    [currentUserId, clearRecentChange]
  );

  /**
   * Detect changes in tasks and trigger updates
   * This is a local change detection that works without real-time connection
   */
  useEffect(() => {
    const prevTasks = prevTasksRef.current;
    const currentTasks = new Map(tasks.map((t) => [t.id, t]));

    // Detect new tasks
    for (const task of tasks) {
      const prevTask = prevTasks.get(task.id);

      if (!prevTask) {
        // New task - only show if we have previous state (not initial load)
        if (prevTasks.size > 0) {
          const editor: TaskEditor = task.assignee
            ? {
                id: task.assignee.id,
                name: task.assignee.name ?? task.assignee.email,
                avatar: task.assignee.avatar ?? undefined,
              }
            : { id: 'system', name: 'System', avatar: undefined };
          triggerUpdate({
            taskId: task.id,
            type: 'created',
            editedBy: editor,
            timestamp: new Date(),
          });
        }
      } else if (prevTask.status !== task.status) {
        // Status changed - this is a move
        const editor: TaskEditor = task.assignee
          ? {
              id: task.assignee.id,
              name: task.assignee.name ?? task.assignee.email,
              avatar: task.assignee.avatar ?? undefined,
            }
          : { id: 'system', name: 'System', avatar: undefined };
        triggerUpdate({
          taskId: task.id,
          type: 'moved',
          editedBy: editor,
          timestamp: new Date(),
          previousStatus: prevTask.status,
          newStatus: task.status,
        });
      } else if (prevTask.updatedAt !== task.updatedAt) {
        // Task updated (other fields changed)
        const editor: TaskEditor = task.assignee
          ? {
              id: task.assignee.id,
              name: task.assignee.name ?? task.assignee.email,
              avatar: task.assignee.avatar ?? undefined,
            }
          : { id: 'system', name: 'System', avatar: undefined };
        triggerUpdate({
          taskId: task.id,
          type: 'updated',
          editedBy: editor,
          timestamp: new Date(),
        });
      }
    }

    // Detect deleted tasks
    for (const [taskId, _prevTask] of prevTasks) {
      if (!currentTasks.has(taskId)) {
        // Task was deleted - we can't show much for deleted tasks
        // but we track it for potential undo scenarios
        triggerUpdate({
          taskId,
          type: 'deleted',
          editedBy: { id: 'system', name: 'System', avatar: undefined },
          timestamp: new Date(),
        });
      }
    }

    // Update previous tasks ref
    prevTasksRef.current = currentTasks;
  }, [tasks, triggerUpdate]);

  /**
   * Mock real-time connection status
   * This will be replaced with actual Supabase connection status
   */
  useEffect(() => {
    if (!projectId) {
      setIsConnected(false);
      return;
    }

    // Simulate connection delay
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 500);

    return () => {
      clearTimeout(connectTimer);
      setIsConnected(false);
    };
  }, [projectId]);

  /**
   * Cleanup all timers on unmount
   */
  useEffect(() => {
    return () => {
      for (const timer of cleanupTimersRef.current.values()) {
        clearTimeout(timer);
      }
      cleanupTimersRef.current.clear();
    };
  }, []);

  return {
    recentlyChangedTaskIds,
    taskEditors,
    taskUpdateTypes,
    taskPreviousStatus,
    clearRecentChange,
    triggerUpdate,
    isConnected,
  };
}

export default useTaskRealtimeUpdates;
