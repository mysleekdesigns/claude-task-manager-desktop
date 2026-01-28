/**
 * Optimistic Update Hook
 *
 * Provides a pattern for optimistic UI updates that:
 * 1. Updates local state immediately for instant feedback
 * 2. Queues changes for background sync
 * 3. Rolls back on sync failure with toast notification
 *
 * @module hooks/useOptimisticUpdate
 */

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNetworkStore, selectEffectiveStatus } from '@/stores/network-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the optimistic update hook
 */
export interface UseOptimisticUpdateOptions<T> {
  /**
   * Async function to persist the change to the server
   * @param data - The new data to persist
   * @returns Promise resolving to the server response
   */
  mutationFn: (data: T) => Promise<T>;

  /**
   * Optional callback when mutation succeeds
   * @param data - The response from the server
   */
  onSuccess?: (data: T) => void;

  /**
   * Optional callback when mutation fails
   * @param error - The error that occurred
   * @param previousData - The data before the optimistic update
   */
  onError?: (error: Error, previousData: T) => void;

  /**
   * Optional callback to handle rollback
   * @param previousData - The data to restore
   */
  onRollback?: (previousData: T) => void;

  /**
   * Entity type for pending change tracking (e.g., 'task', 'project')
   */
  entityType: string;

  /**
   * Generate a description for the pending change
   * @param data - The data being changed
   */
  getDescription?: (data: T) => string;

  /**
   * Whether to show toast notifications (default: true)
   */
  showToasts?: boolean;

  /**
   * Number of retry attempts before giving up (default: 3)
   */
  maxRetries?: number;

  /**
   * Delay between retries in ms (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Return type for the optimistic update hook
 */
export interface UseOptimisticUpdateResult<T> {
  /**
   * Execute an optimistic update
   * @param entityId - ID of the entity being updated
   * @param optimisticData - New data for immediate UI update
   * @returns Promise resolving to the final data (server response or optimistic)
   */
  execute: (entityId: string, optimisticData: T) => Promise<T>;

  /**
   * Whether a mutation is in progress
   */
  isPending: boolean;

  /**
   * Current error if mutation failed
   */
  error: Error | null;

  /**
   * Reset the error state
   */
  resetError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for handling optimistic UI updates with automatic rollback.
 *
 * This hook implements the optimistic update pattern:
 * 1. Immediately returns optimistic data for UI rendering
 * 2. Queues the change in the network store for sync tracking
 * 3. Attempts to persist the change to the server
 * 4. On failure, triggers rollback callback with previous data
 *
 * @example
 * ```typescript
 * function TaskCard({ task }: { task: Task }) {
 *   const [localTask, setLocalTask] = useState(task);
 *   const updateTask = useIPCMutation('tasks:update');
 *
 *   const { execute, isPending } = useOptimisticUpdate<Task>({
 *     mutationFn: (data) => updateTask.mutate(task.id, data),
 *     entityType: 'task',
 *     getDescription: (data) => `Update task "${data.title}"`,
 *     onRollback: (previousData) => setLocalTask(previousData),
 *     onSuccess: (data) => setLocalTask(data),
 *   });
 *
 *   const handleStatusChange = async (newStatus: TaskStatus) => {
 *     const optimisticTask = { ...localTask, status: newStatus };
 *     setLocalTask(optimisticTask); // Immediate UI update
 *     await execute(task.id, optimisticTask);
 *   };
 *
 *   return (
 *     <TaskCardUI
 *       task={localTask}
 *       onStatusChange={handleStatusChange}
 *       disabled={isPending}
 *     />
 *   );
 * }
 * ```
 */
export function useOptimisticUpdate<T>(
  options: UseOptimisticUpdateOptions<T>
): UseOptimisticUpdateResult<T> {
  const {
    mutationFn,
    onSuccess,
    onError,
    onRollback,
    entityType,
    getDescription = () => `Update ${entityType}`,
    showToasts = true,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Store previous data for rollback
  const previousDataRef = useRef<T | null>(null);

  // Get network store actions
  const addPendingChange = useNetworkStore((state) => state.addPendingChange);
  const removePendingChange = useNetworkStore((state) => state.removePendingChange);
  const updatePendingChange = useNetworkStore((state) => state.updatePendingChange);
  const networkStatus = useNetworkStore(selectEffectiveStatus);

  /**
   * Sleep helper for retry delays
   */
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Execute the optimistic update
   */
  const execute = useCallback(
    async (entityId: string, optimisticData: T): Promise<T> => {
      // Store previous data for potential rollback
      previousDataRef.current = optimisticData;

      setIsPending(true);
      setError(null);

      // Add to pending changes queue
      addPendingChange({
        entityType,
        entityId,
        operation: 'update',
        description: getDescription(optimisticData),
      });

      // If offline, return optimistic data immediately
      // (the change is queued and will sync when online)
      if (networkStatus === 'offline') {
        setIsPending(false);
        if (showToasts) {
          toast.info('Change saved locally - will sync when online');
        }
        return optimisticData;
      }

      // Attempt mutation with retries
      let lastError: Error | null = null;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          const result = await mutationFn(optimisticData);

          // Success - remove from pending queue
          // Note: We find the change by entityId and entityType
          const pendingChanges = useNetworkStore.getState().pendingChanges;
          const change = pendingChanges.find(
            (c) => c.entityId === entityId && c.entityType === entityType
          );
          if (change) {
            removePendingChange(change.id);
          }

          setIsPending(false);

          if (onSuccess) {
            onSuccess(result);
          }

          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // Update retry count in pending change
          const pendingChanges = useNetworkStore.getState().pendingChanges;
          const change = pendingChanges.find(
            (c) => c.entityId === entityId && c.entityType === entityType
          );
          if (change) {
            updatePendingChange(change.id, {
              retryCount: retryCount + 1,
              lastError: lastError.message,
            });
          }

          // If we have retries left, wait and try again
          if (retryCount < maxRetries) {
            retryCount++;
            await sleep(retryDelay * retryCount); // Exponential backoff
            continue;
          }

          break;
        }
      }

      // All retries exhausted - rollback
      setIsPending(false);
      setError(lastError);

      if (showToasts) {
        toast.error(
          `Failed to save changes: ${lastError?.message ?? 'Unknown error'}`,
          {
            description: 'Your changes have been reverted.',
            action: {
              label: 'Retry',
              onClick: () => execute(entityId, optimisticData),
            },
          }
        );
      }

      if (onError && previousDataRef.current && lastError) {
        onError(lastError, previousDataRef.current);
      }

      if (onRollback && previousDataRef.current) {
        onRollback(previousDataRef.current);
      }

      // Return the optimistic data even on failure
      // (the component should have already rolled back via onRollback)
      return optimisticData;
    },
    [
      mutationFn,
      onSuccess,
      onError,
      onRollback,
      entityType,
      getDescription,
      showToasts,
      maxRetries,
      retryDelay,
      networkStatus,
      addPendingChange,
      removePendingChange,
      updatePendingChange,
    ]
  );

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    isPending,
    error,
    resetError,
  };
}

// ============================================================================
// Higher-Level Hooks
// ============================================================================

/**
 * Options for the optimistic list update hook
 */
export interface UseOptimisticListOptions<T> {
  /**
   * Get the unique identifier for an item
   */
  getItemId: (item: T) => string;

  /**
   * Async function to persist the change
   */
  mutationFn: (operation: 'create' | 'update' | 'delete', item: T) => Promise<T | void>;

  /**
   * Entity type for pending change tracking
   */
  entityType: string;

  /**
   * Whether to show toast notifications
   */
  showToasts?: boolean;
}

/**
 * Result type for optimistic list operations
 */
export interface UseOptimisticListResult<T> {
  /**
   * Optimistically add an item to the list
   */
  optimisticAdd: (items: T[], newItem: T) => { items: T[]; rollback: () => T[] };

  /**
   * Optimistically update an item in the list
   */
  optimisticUpdate: (
    items: T[],
    itemId: string,
    updates: Partial<T>
  ) => { items: T[]; rollback: () => T[] };

  /**
   * Optimistically remove an item from the list
   */
  optimisticRemove: (items: T[], itemId: string) => { items: T[]; rollback: () => T[] };
}

/**
 * Hook for optimistic list operations (add, update, remove).
 *
 * Provides helpers for common list manipulations with automatic
 * rollback support.
 *
 * @example
 * ```typescript
 * function TaskList() {
 *   const [tasks, setTasks] = useState<Task[]>([]);
 *
 *   const { optimisticAdd, optimisticUpdate, optimisticRemove } = useOptimisticList({
 *     getItemId: (task) => task.id,
 *     mutationFn: async (op, task) => {
 *       if (op === 'create') return invoke('tasks:create', task);
 *       if (op === 'update') return invoke('tasks:update', task.id, task);
 *       if (op === 'delete') return invoke('tasks:delete', task.id);
 *     },
 *     entityType: 'task',
 *   });
 *
 *   const handleAddTask = async (newTask: Task) => {
 *     const { items, rollback } = optimisticAdd(tasks, newTask);
 *     setTasks(items);
 *
 *     try {
 *       await createTask(newTask);
 *     } catch {
 *       setTasks(rollback());
 *     }
 *   };
 *
 *   return <TaskListUI tasks={tasks} onAdd={handleAddTask} />;
 * }
 * ```
 */
export function useOptimisticList<T>(
  options: UseOptimisticListOptions<T>
): UseOptimisticListResult<T> {
  const { getItemId } = options;

  const optimisticAdd = useCallback(
    (items: T[], newItem: T) => {
      const previousItems = [...items];
      const newItems = [...items, newItem];

      return {
        items: newItems,
        rollback: () => previousItems,
      };
    },
    []
  );

  const optimisticUpdate = useCallback(
    (items: T[], itemId: string, updates: Partial<T>) => {
      const previousItems = [...items];
      const newItems = items.map((item) =>
        getItemId(item) === itemId ? { ...item, ...updates } : item
      );

      return {
        items: newItems,
        rollback: () => previousItems,
      };
    },
    [getItemId]
  );

  const optimisticRemove = useCallback(
    (items: T[], itemId: string) => {
      const previousItems = [...items];
      const newItems = items.filter((item) => getItemId(item) !== itemId);

      return {
        items: newItems,
        rollback: () => previousItems,
      };
    },
    [getItemId]
  );

  return {
    optimisticAdd,
    optimisticUpdate,
    optimisticRemove,
  };
}

export default useOptimisticUpdate;
