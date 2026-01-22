/**
 * React Hook for Claude Code Task Status
 *
 * Provides hooks for fetching and tracking Claude Code automation status.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type { ClaudeTaskStatus, Task, ClaudeStatusMessage, AllEventChannels } from '@/types/ipc';

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
  return useIPCQuery('claude:getTaskStatus', [{ taskId }], {
    enabled: Boolean(taskId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for polling Claude Code task status
 * Automatically refetches status at the specified interval
 *
 * @param taskId - The task ID to track
 * @param interval - Polling interval in milliseconds (default: 5000ms)
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
export function useClaudeStatusPolling(taskId: string, interval = 5000) {
  const statusQuery = useClaudeStatus(taskId);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!taskId || !statusQuery.data) {
      setIsPolling(false);
      return;
    }

    // Only poll if Claude is in an active state (including paused)
    const shouldPoll =
      statusQuery.data.isRunning ||
      (statusQuery.data as any).status === 'STARTING' ||
      (statusQuery.data as any).status === 'RUNNING' ||
      (statusQuery.data as any).status === 'AWAITING_INPUT' ||
      (statusQuery.data as any).status === 'PAUSED';

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
 * @returns true if Claude is in an active state (including paused)
 */
export function isClaudeActive(status: ClaudeTaskStatus): boolean {
  return status === 'STARTING' || status === 'RUNNING' || status === 'AWAITING_INPUT' || status === 'PAUSED';
}

// ============================================================================
// Status Messages Hook
// ============================================================================

/**
 * Maximum number of status messages to keep in history
 */
const MAX_STATUS_MESSAGES = 50;

/**
 * Hook for subscribing to Claude Code status messages
 * Receives real-time status updates via IPC event channel
 *
 * @param terminalId - The terminal ID to subscribe to status updates for
 * @returns Object with current status, message history, and control functions
 *
 * @example
 * ```tsx
 * function TaskProgress({ terminalId }: { terminalId: string }) {
 *   const { currentStatus, messages, clearMessages } = useClaudeStatusMessages(terminalId);
 *
 *   return (
 *     <div>
 *       <p>Current: {currentStatus?.summary}</p>
 *       <ul>
 *         {messages.map((msg, i) => (
 *           <li key={i}>{msg.summary}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useClaudeStatusMessages(terminalId: string | null) {
  const [messages, setMessages] = useState<ClaudeStatusMessage[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ClaudeStatusMessage | null>(null);
  const messagesRef = useRef<ClaudeStatusMessage[]>([]);
  const prevTerminalIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentStatus(null);
    messagesRef.current = [];
  }, []);

  // Add a message (used for restoring cached status)
  const addMessage = useCallback((message: ClaudeStatusMessage) => {
    setCurrentStatus(message);
    setMessages(prev => {
      const updated = [...prev, message];
      if (updated.length > MAX_STATUS_MESSAGES) {
        return updated.slice(-MAX_STATUS_MESSAGES);
      }
      return updated;
    });
  }, []);

  // Subscribe to status events
  useEffect(() => {
    if (!terminalId) {
      return;
    }

    const channel = `terminal:status:${terminalId}` as AllEventChannels;

    const handleStatusMessage = (...args: unknown[]) => {
      const message = args[0] as ClaudeStatusMessage;

      // Update current status
      setCurrentStatus(message);

      // Add to history (keep last MAX_STATUS_MESSAGES)
      setMessages(prev => {
        const updated = [...prev, message];
        if (updated.length > MAX_STATUS_MESSAGES) {
          return updated.slice(-MAX_STATUS_MESSAGES);
        }
        return updated;
      });
    };

    // Subscribe to IPC events
    window.electron.on(channel, handleStatusMessage);

    return () => {
      window.electron.removeListener(channel, handleStatusMessage);
    };
  }, [terminalId]);

  // Handle terminal ID changes - only clear when switching to a DIFFERENT terminal
  // Fetch cached status before clearing to prevent flash
  useEffect(() => {
    if (terminalId && prevTerminalIdRef.current !== terminalId) {
      const previousTerminalId = prevTerminalIdRef.current;
      prevTerminalIdRef.current = terminalId;

      // Only clear and fetch cached status if switching terminals (not on initial mount)
      if (previousTerminalId !== null) {
        // Fetch cached status before clearing to prevent flash
        window.electron.invoke('terminal:get-last-status', terminalId)
          .then((result) => {
            const cached = result as ClaudeStatusMessage | null;
            clearMessages();
            if (cached?.message) {
              addMessage(cached);
            }
          })
          .catch(() => {
            // If fetch fails, just clear without restoring
            clearMessages();
          });
      } else {
        // Initial mount - try to restore cached status without clearing first
        window.electron.invoke('terminal:get-last-status', terminalId)
          .then((result) => {
            const cached = result as ClaudeStatusMessage | null;
            if (cached?.message) {
              addMessage(cached);
            }
          })
          .catch(() => {
            // Ignore errors on initial fetch
          });
      }
    }
  }, [terminalId, clearMessages, addMessage]);

  return {
    currentStatus,
    messages,
    clearMessages,
    hasMessages: messages.length > 0,
  };
}
