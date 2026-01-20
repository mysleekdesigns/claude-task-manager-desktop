/**
 * React Hook for Claude Code Task Status
 *
 * Provides hooks for fetching and tracking Claude Code automation status.
 */

import { useEffect, useState } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type { ClaudeTaskStatus, Task } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeStatus {
  isRunning: boolean;
  terminalId: string | null;
  sessionId: string | null;
  status: ClaudeTaskStatus;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching Claude Code task status
 *
 * @param taskId - The task ID to fetch status for
 * @returns Query result with Claude status data
 *
 * @example
 * ```tsx
 * function TaskStatus({ taskId }: { taskId: string }) {
 *   const { data: status, loading, refetch } = useClaudeStatus(taskId);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!status) return null;
 *
 *   return <div>Status: {status.isRunning ? 'Running' : 'Idle'}</div>;
 * }
 * ```
 */
export function useClaudeStatus(taskId: string) {
  return useIPCQuery('claude:getTaskStatus', [{ taskId }] as any, {
    enabled: Boolean(taskId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for polling Claude Code task status
 * Automatically refetches status at the specified interval
 *
 * @param taskId - The task ID to track
 * @param interval - Polling interval in milliseconds (default: 2000ms)
 * @returns Query result with auto-refreshing Claude status
 *
 * @example
 * ```tsx
 * function LiveTaskStatus({ taskId }: { taskId: string }) {
 *   const { data: status } = useClaudeStatusPolling(taskId, 1000);
 *
 *   return <div>Status: {status?.isRunning ? 'Running' : 'Idle'}</div>;
 * }
 * ```
 */
export function useClaudeStatusPolling(taskId: string, interval = 2000) {
  const statusQuery = useClaudeStatus(taskId);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!taskId || !statusQuery.data) {
      setIsPolling(false);
      return;
    }

    // Only poll if Claude is in an active state
    const shouldPoll =
      statusQuery.data.isRunning ||
      (statusQuery.data as any).status === 'STARTING' ||
      (statusQuery.data as any).status === 'RUNNING' ||
      (statusQuery.data as any).status === 'AWAITING_INPUT';

    setIsPolling(shouldPoll);

    if (!shouldPoll) return;

    const timer = setInterval(() => {
      void statusQuery.refetch();
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [taskId, interval, statusQuery.data, statusQuery.refetch]);

  return {
    ...statusQuery,
    isPolling,
  };
}

/**
 * Hook for starting a Claude Code task
 *
 * @returns Mutation with mutate function for starting Claude tasks
 *
 * @example
 * ```tsx
 * function StartClaudeButton({ taskId }: { taskId: string }) {
 *   const { mutate: startTask, loading } = useStartClaudeTask();
 *
 *   const handleStart = async () => {
 *     await startTask({
 *       taskId,
 *       taskTitle: 'My Task',
 *       projectPath: '/path/to/project',
 *       sessionId: crypto.randomUUID(),
 *     });
 *   };
 *
 *   return <button onClick={handleStart} disabled={loading}>Start</button>;
 * }
 * ```
 */
export function useStartClaudeTask() {
  return useIPCMutation('claude:startTask');
}

/**
 * Hook for pausing a Claude Code task
 *
 * @returns Mutation with mutate function for pausing Claude tasks
 *
 * @example
 * ```tsx
 * function PauseClaudeButton({ taskId }: { taskId: string }) {
 *   const { mutate: pauseTask, loading } = usePauseClaudeTask();
 *
 *   const handlePause = async () => {
 *     await pauseTask({ taskId });
 *   };
 *
 *   return <button onClick={handlePause} disabled={loading}>Pause</button>;
 * }
 * ```
 */
export function usePauseClaudeTask() {
  return useIPCMutation('claude:pauseTask');
}

/**
 * Hook for resuming a Claude Code task
 *
 * @returns Mutation with mutate function for resuming Claude tasks
 *
 * @example
 * ```tsx
 * function ResumeClaudeButton({ taskId, sessionId }: { taskId: string; sessionId: string }) {
 *   const { mutate: resumeTask, loading } = useResumeClaudeTask();
 *
 *   const handleResume = async () => {
 *     await resumeTask({ taskId, sessionId });
 *   };
 *
 *   return <button onClick={handleResume} disabled={loading}>Resume</button>;
 * }
 * ```
 */
export function useResumeClaudeTask() {
  return useIPCMutation('claude:resumeTask');
}

/**
 * Extract Claude status from task data
 * Helper function to get ClaudeTaskStatus from a Task object
 *
 * @param task - Task object
 * @returns ClaudeTaskStatus or 'IDLE' if not set
 */
export function getClaudeStatusFromTask(task: Task | null | undefined): ClaudeTaskStatus {
  if (!task) return 'IDLE';
  return task.claudeStatus || 'IDLE';
}

/**
 * Check if Claude is actively working on a task
 *
 * @param status - ClaudeTaskStatus
 * @returns true if Claude is in an active state
 */
export function isClaudeActive(status: ClaudeTaskStatus): boolean {
  return status === 'STARTING' || status === 'RUNNING' || status === 'AWAITING_INPUT';
}
