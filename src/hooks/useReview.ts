/**
 * React Hooks for AI Review Workflow
 *
 * Provides hooks for managing AI code review workflows on tasks.
 * Integrates with the review store for state management.
 */

import { useCallback, useEffect, useState } from 'react';
import { useReviewStore } from '@/store/useReviewStore';
import { invoke } from '@/lib/ipc';
import type {
  ReviewProgressResponse,
  TaskHistoryResponse,
  ReviewType,
} from '@/types/ipc';

// ============================================================================
// Review Workflow Hook
// ============================================================================

/**
 * Hook for starting and managing review workflows on a task
 *
 * @param taskId - The ID of the task to review
 * @returns Functions and state for managing the review workflow
 *
 * @example
 * ```tsx
 * function ReviewButton({ taskId }: { taskId: string }) {
 *   const { startReview, cancelReview, isStarting } = useReviewWorkflow(taskId);
 *
 *   return (
 *     <button onClick={() => startReview()} disabled={isStarting}>
 *       {isStarting ? 'Starting...' : 'Start Review'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useReviewWorkflow(taskId: string) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { resetReviewProgress } = useReviewStore();

  const startReview = useCallback(
    async (reviewTypes?: ReviewType[]) => {
      setIsStarting(true);
      setError(null);

      // Reset the review progress to 'in_progress' immediately to prevent
      // stale 'completed' status from showing when restarting a review
      resetReviewProgress(taskId);

      try {
        // Only include reviewTypes if it's defined
        const input = reviewTypes
          ? { taskId, reviewTypes }
          : { taskId };
        await invoke('review:start', input);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to start review');
        setError(error);
        throw error;
      } finally {
        setIsStarting(false);
      }
    },
    [taskId, resetReviewProgress]
  );

  const cancelReview = useCallback(async () => {
    try {
      await invoke('review:cancel', taskId);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to cancel review');
      setError(error);
      throw error;
    }
  }, [taskId]);

  return { startReview, cancelReview, isStarting, error };
}

// ============================================================================
// Review Progress Hook
// ============================================================================

/**
 * Hook for subscribing to review progress updates
 *
 * @param taskId - The ID of the task to track (null to disable)
 * @returns Current review progress or undefined
 *
 * @example
 * ```tsx
 * function ReviewProgressDisplay({ taskId }: { taskId: string }) {
 *   const progress = useReviewProgress(taskId);
 *
 *   if (!progress) return <div>No review in progress</div>;
 *
 *   return (
 *     <div>
 *       {progress.status}: {progress.reviews.filter(r => r.status === 'COMPLETED').length}/
 *       {progress.reviews.length} reviews complete
 *     </div>
 *   );
 * }
 * ```
 */
export function useReviewProgress(
  taskId: string | null
): ReviewProgressResponse | undefined {
  const { activeReviews, setReviewProgress } = useReviewStore();
  const progress = taskId ? activeReviews.get(taskId) : undefined;

  useEffect(() => {
    if (!taskId) return;

    // Subscribe to progress updates via IPC event
    const unsubscribe = window.electron.on(
      `review:progress:${taskId}`,
      (...args: unknown[]) => {
        // The event data is passed as the first argument
        const data = args[0] as ReviewProgressResponse;
        if (data) {
          setReviewProgress(taskId, data);
        }
      }
    );

    // Fetch initial progress
    invoke('review:getProgress', taskId)
      .then((data) => {
        if (data) {
          setReviewProgress(taskId, data);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch review progress:', err);
      });

    return unsubscribe;
  }, [taskId, setReviewProgress]);

  return progress;
}

// ============================================================================
// Task History Hook
// ============================================================================

/**
 * Hook for fetching task activity history
 *
 * @param taskId - The ID of the task to get history for
 * @returns History data, loading state, and refetch function
 *
 * @example
 * ```tsx
 * function TaskHistoryDisplay({ taskId }: { taskId: string }) {
 *   const { history, isLoading, refetch } = useTaskHistory(taskId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!history) return <div>No history available</div>;
 *
 *   return (
 *     <ul>
 *       {history.activities.map(activity => (
 *         <li key={activity.id}>{activity.summary}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useTaskHistory(taskId: string) {
  const [history, setHistory] = useState<TaskHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke('review:getHistory', taskId);
      setHistory(data);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to fetch history');
      setError(error);
      console.error('Failed to fetch task history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}

// ============================================================================
// Combined Review Hook
// ============================================================================

/**
 * Combined hook for complete review management
 *
 * @param taskId - The ID of the task
 * @returns Complete review state and actions
 */
export function useReviewManager(taskId: string) {
  const workflow = useReviewWorkflow(taskId);
  const progress = useReviewProgress(taskId);
  const { history, isLoading: historyLoading, refetch: refetchHistory } = useTaskHistory(taskId);
  const { hasActiveReview, removeReview } = useReviewStore();

  const isReviewActive = hasActiveReview(taskId);

  const clearReview = useCallback(() => {
    removeReview(taskId);
  }, [taskId, removeReview]);

  return {
    // Workflow actions
    startReview: workflow.startReview,
    cancelReview: workflow.cancelReview,
    clearReview,
    isStarting: workflow.isStarting,
    workflowError: workflow.error,

    // Progress state
    progress,
    isReviewActive,

    // History state
    history,
    historyLoading,
    refetchHistory,
  };
}
