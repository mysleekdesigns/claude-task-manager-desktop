/**
 * React Hook for Claude Code Task Automation
 *
 * Provides hooks for managing Claude Code sessions and task automation.
 */

import { useCallback } from 'react';
import { useIPCMutation } from './useIPC';
import type {
  Task,
  ClaudeTaskStatus,
  ClaudeCodeStartInput,
  ClaudeCodeStartResponse,
  ClaudeCodeResumeInput,
  ClaudeCodeResumeResponse,
  ClaudeCodePauseInput,
} from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

/**
 * Claude Code session status
 */
export interface ClaudeCodeStatus {
  taskId: string;
  status: ClaudeTaskStatus;
  sessionId: string | null;
  sessionName: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing Claude Code task automation
 *
 * @returns Object with Claude Code control functions
 *
 * @example
 * ```tsx
 * function TaskClaudeControls({ task, projectPath }: Props) {
 *   const { startTask, pauseTask, resumeTask } = useClaudeCode();
 *
 *   const handleStart = async () => {
 *     const response = await startTask({
 *       taskId: task.id,
 *       taskTitle: task.title,
 *       taskDescription: task.description || '',
 *       projectPath,
 *       sessionId: `task-${task.id}`,
 *     });
 *     console.log('Claude started:', response.terminalId);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleStart}>Start Claude</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useClaudeCode() {
  const startTaskMutation = useIPCMutation('claude:startTask');
  const pauseTaskMutation = useIPCMutation('claude:pauseTask');
  const resumeTaskMutation = useIPCMutation('claude:resumeTask');

  /**
   * Start Claude Code automation for a task
   *
   * @param input - Start task input with task details and configuration
   * @returns Response with terminal ID and session ID
   */
  const startTask = useCallback(
    async (input: ClaudeCodeStartInput): Promise<ClaudeCodeStartResponse> => {
      console.log('[useClaudeCode] startTask called with input:', input);
      console.log('[useClaudeCode] Input field types:', {
        taskId: typeof input.taskId,
        taskTitle: typeof input.taskTitle,
        taskDescription: typeof input.taskDescription,
        projectPath: typeof input.projectPath,
        sessionId: typeof input.sessionId,
      });
      const response = await startTaskMutation.mutate(input);
      console.log('[useClaudeCode] startTask response:', response);
      return response;
    },
    [startTaskMutation]
  );

  /**
   * Pause Claude Code automation for a task
   *
   * @param input - Pause task input with task ID
   * @returns Promise that resolves when task is paused
   */
  const pauseTask = useCallback(
    async (input: ClaudeCodePauseInput): Promise<void> => {
      await pauseTaskMutation.mutate(input);
    },
    [pauseTaskMutation]
  );

  /**
   * Resume Claude Code automation for a task
   *
   * @param input - Resume task input with task ID and optional prompt
   * @returns Response with terminal ID
   */
  const resumeTask = useCallback(
    async (input: ClaudeCodeResumeInput): Promise<ClaudeCodeResumeResponse> => {
      const response = await resumeTaskMutation.mutate(input);
      return response;
    },
    [resumeTaskMutation]
  );

  /**
   * Get Claude Code session status for a task
   *
   * @param task - The task to get status for
   * @returns Claude Code session status
   */
  const getTaskStatus = useCallback((task: Task): ClaudeCodeStatus => {
    return {
      taskId: task.id,
      status: task.claudeStatus || 'IDLE',
      sessionId: task.claudeSessionId || null,
      sessionName: task.claudeSessionName || null,
      startedAt: task.claudeStartedAt || null,
      completedAt: task.claudeCompletedAt || null,
    };
  }, []);

  return {
    startTask,
    pauseTask,
    resumeTask,
    getTaskStatus,
    // Expose loading states for each operation
    isStarting: startTaskMutation.loading,
    isPausing: pauseTaskMutation.loading,
    isResuming: resumeTaskMutation.loading,
    // Expose errors
    startError: startTaskMutation.error,
    pauseError: pauseTaskMutation.error,
    resumeError: resumeTaskMutation.error,
  };
}

export default useClaudeCode;
