/**
 * React Hooks for AI Fix Workflow
 *
 * Provides hooks for managing AI code fix workflows on tasks.
 * Integrates with the fix store for state management.
 *
 * Subscribes to IPC events:
 * - fix:progress:${taskId}:${fixType} - progress updates during fix
 * - fix:complete:${taskId} - notification when all fixes are complete
 */

import { useCallback, useEffect } from 'react';
import { useFixStore, type FixOperationState } from '@/store/useFixStore';
import { invoke } from '@/lib/ipc';
import type { FixType, ReviewFinding, FixProgressResponse, FixVerificationResult, AllEventChannels } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

/**
 * All fixable review types
 */
const FIX_TYPES: FixType[] = ['performance', 'quality', 'security'];

// ============================================================================
// Fix Event Subscription Hook
// ============================================================================

/**
 * Hook for subscribing to fix events for a specific task
 *
 * Automatically subscribes to progress and completion events,
 * and cleans up subscriptions on unmount.
 *
 * @param taskId - The ID of the task to track (null to disable)
 *
 * @example
 * ```tsx
 * function TaskFixMonitor({ taskId }: { taskId: string }) {
 *   // This will automatically update the fix store when events arrive
 *   useFixSubscription(taskId);
 *
 *   const { getTaskFixes } = useFixStore();
 *   const fixes = getTaskFixes(taskId);
 *
 *   return (
 *     <div>
 *       {fixes.map(({ fixType, state }) => (
 *         <div key={fixType}>
 *           {fixType}: {state.status} - {state.currentActivity}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFixSubscription(taskId: string | null): void {
  const { setFixProgress, setFixComplete, setFixFailed, setFixVerified, clearFix } = useFixStore();

  useEffect(() => {
    if (!taskId) return;

    const unsubscribers: Array<() => void> = [];

    // Subscribe to progress events for each fix type
    for (const fixType of FIX_TYPES) {
      const channel = `fix:progress:${taskId}:${fixType}` as AllEventChannels;
      const unsubscribe = window.electron.on(channel, (...args: unknown[]) => {
        const data = args[0] as FixProgressResponse;
        if (data) {
          if (data.status === 'IN_PROGRESS') {
            setFixProgress(taskId, fixType, data.currentActivity?.message ?? 'Fixing...');
          } else if (data.status === 'COMPLETED') {
            setFixComplete(taskId, fixType);
          } else if (data.status === 'FAILED') {
            setFixFailed(taskId, fixType, data.summary ?? 'Fix failed');
          }
        }
      });
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to verification events for each fix type
    for (const fixType of FIX_TYPES) {
      const verifyChannel = `fix:verified:${taskId}:${fixType}` as AllEventChannels;
      const unsubscribe = window.electron.on(verifyChannel, (...args: unknown[]) => {
        const data = args[0] as (FixVerificationResult & { canRetry: boolean }) | undefined;
        if (data) {
          setFixVerified(taskId, fixType, {
            preFixScore: data.preFixScore,
            postFixScore: data.postFixScore,
            scoreImprovement: data.scoreImprovement,
            remainingFindingsCount: data.remainingFindings.length,
            passed: data.passed,
            summary: data.summary,
          }, data.canRetry);
        }
      });
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to complete event for the task
    const completeChannel = `fix:complete:${taskId}` as AllEventChannels;
    const unsubscribeComplete = window.electron.on(
      completeChannel,
      (...args: unknown[]) => {
        const data = args[0] as {
          fixType?: FixType;
          success?: boolean;
          error?: string;
          summary?: string;
        } | undefined;
        if (data?.fixType) {
          if (data.success) {
            setFixComplete(taskId, data.fixType);
          } else {
            // Handle failure - check both 'error' and 'summary' fields
            const errorMessage = data.error || data.summary || 'Fix failed';
            setFixFailed(taskId, data.fixType, errorMessage);
          }
        }
      }
    );
    unsubscribers.push(unsubscribeComplete);

    // Cleanup all subscriptions on unmount
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [taskId, setFixProgress, setFixComplete, setFixFailed, setFixVerified, clearFix]);
}

// ============================================================================
// Fix Workflow Hook
// ============================================================================

/**
 * Hook for starting and managing fix workflows on a task
 *
 * @param taskId - The ID of the task to fix
 * @returns Functions and state for managing the fix workflow
 *
 * @example
 * ```tsx
 * function FixButton({ taskId, fixType, findings }: Props) {
 *   const { startFix, isFixing, getFixStatus } = useFix(taskId);
 *   const status = getFixStatus(fixType);
 *
 *   return (
 *     <button
 *       onClick={() => startFix(fixType, findings)}
 *       disabled={isFixing(fixType)}
 *     >
 *       {isFixing(fixType) ? status?.currentActivity || 'Fixing...' : 'Fix Issues'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useFix(taskId: string) {
  const store = useFixStore();

  // Subscribe to fix events for this task
  useFixSubscription(taskId);

  /**
   * Start a fix operation for specific findings
   */
  const startFix = useCallback(
    async (fixType: FixType, findings: ReviewFinding[]) => {
      // Mark as starting in the store
      store.startFix(taskId, fixType);

      try {
        await invoke('fix:start', { taskId, fixType, findings });
      } catch (err) {
        // If the IPC call fails immediately, mark as failed
        const errorMessage = err instanceof Error ? err.message : 'Failed to start fix';
        store.setFixFailed(taskId, fixType, errorMessage);
        throw err;
      }
    },
    [taskId, store]
  );

  /**
   * Cancel an in-progress fix operation
   */
  const cancelFix = useCallback(
    async (fixType: FixType) => {
      try {
        await invoke('fix:cancel', { taskId, fixType });
        store.clearFix(taskId, fixType);
      } catch (err) {
        console.error(`Failed to cancel fix ${fixType}:`, err);
        throw err;
      }
    },
    [taskId, store]
  );

  /**
   * Check if a specific fix type is currently in progress
   */
  const isFixing = useCallback(
    (fixType: FixType): boolean => {
      return store.isFixing(taskId, fixType);
    },
    [taskId, store]
  );

  /**
   * Check if any fix is in progress for this task
   */
  const hasActiveFix = useCallback((): boolean => {
    return store.hasActiveFix(taskId);
  }, [taskId, store]);

  /**
   * Get the status of a specific fix operation
   */
  const getFixStatus = useCallback(
    (fixType: FixType): FixOperationState | undefined => {
      return store.getFixStatus(taskId, fixType);
    },
    [taskId, store]
  );

  /**
   * Get all fixes for this task
   */
  const getTaskFixes = useCallback((): Array<{ fixType: FixType; state: FixOperationState }> => {
    return store.getTaskFixes(taskId);
  }, [taskId, store]);

  /**
   * Clear a specific fix from tracking
   */
  const clearFix = useCallback(
    (fixType: FixType) => {
      store.clearFix(taskId, fixType);
    },
    [taskId, store]
  );

  /**
   * Clear all fixes for this task
   */
  const clearAllFixes = useCallback(() => {
    store.clearTaskFixes(taskId);
  }, [taskId, store]);

  /**
   * Retry a fix with remaining findings after failed verification
   */
  const retryFix = useCallback(
    async (fixType: FixType) => {
      if (!taskId) return;
      store.startFix(taskId, fixType);
      await invoke('fix:retry', { taskId, fixType });
    },
    [taskId, store]
  );

  /**
   * Get the verification result for a specific fix type
   */
  const getVerification = useCallback(
    async (fixType: FixType): Promise<FixVerificationResult | null> => {
      if (!taskId) return null;
      return await invoke('fix:getVerification', { taskId, fixType });
    },
    [taskId]
  );

  return {
    // Actions
    startFix,
    cancelFix,
    clearFix,
    clearAllFixes,
    retryFix,
    getVerification,

    // Status checks
    isFixing,
    hasActiveFix,
    getFixStatus,
    getTaskFixes,
  };
}

// ============================================================================
// Fix Progress Hook
// ============================================================================

/**
 * Hook for fetching and tracking fix progress for a specific fix type
 *
 * @param taskId - The ID of the task
 * @param fixType - The type of fix to track
 * @returns Current fix progress state
 *
 * @example
 * ```tsx
 * function FixProgressDisplay({ taskId }: { taskId: string }) {
 *   const securityFix = useFixProgress(taskId, 'security');
 *
 *   if (!securityFix) return null;
 *
 *   return (
 *     <div>
 *       Security Fix: {securityFix.status}
 *       {securityFix.currentActivity && (
 *         <span> - {securityFix.currentActivity}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFixProgress(
  taskId: string | null,
  fixType: FixType
): FixOperationState | undefined {
  const { getFixStatus, setFixProgress } = useFixStore();

  // Subscribe to this specific fix's progress
  useEffect(() => {
    if (!taskId) return;

    const channel = `fix:progress:${taskId}:${fixType}` as AllEventChannels;
    const unsubscribe = window.electron.on(channel, (...args: unknown[]) => {
      const data = args[0] as FixProgressResponse;
      if (data?.currentActivity?.message) {
        setFixProgress(taskId, fixType, data.currentActivity.message);
      }
    });

    // Fetch initial progress
    invoke('fix:getProgress', { taskId, fixType })
      .then((data) => {
        if (data?.currentActivity?.message) {
          setFixProgress(taskId, fixType, data.currentActivity.message);
        }
      })
      .catch((err: unknown) => {
        console.error(`Failed to fetch fix progress for ${fixType}:`, err);
      });

    return unsubscribe;
  }, [taskId, fixType, setFixProgress]);

  return taskId ? getFixStatus(taskId, fixType) : undefined;
}

// ============================================================================
// Combined Fix Manager Hook
// ============================================================================

/**
 * Combined hook for complete fix management
 *
 * @param taskId - The ID of the task
 * @returns Complete fix state and actions for all fix types
 */
export function useFixManager(taskId: string) {
  const fix = useFix(taskId);

  // Get status for each fix type
  const securityStatus = fix.getFixStatus('security');
  const qualityStatus = fix.getFixStatus('quality');
  const performanceStatus = fix.getFixStatus('performance');

  return {
    // Actions
    startFix: fix.startFix,
    cancelFix: fix.cancelFix,
    clearFix: fix.clearFix,
    clearAllFixes: fix.clearAllFixes,
    retryFix: fix.retryFix,
    getVerification: fix.getVerification,

    // Individual status checks
    isFixingSecurity: fix.isFixing('security'),
    isFixingQuality: fix.isFixing('quality'),
    isFixingPerformance: fix.isFixing('performance'),

    // Status by type
    securityStatus,
    qualityStatus,
    performanceStatus,

    // General checks
    hasActiveFix: fix.hasActiveFix,
    getTaskFixes: fix.getTaskFixes,

    // Helper to check any type
    isFixing: fix.isFixing,
    getFixStatus: fix.getFixStatus,
  };
}
