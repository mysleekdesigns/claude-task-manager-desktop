/**
 * Task Output Preview Component
 *
 * Displays a simple status indicator for running Claude tasks.
 * Subscribes to terminal:status channel for clean status messages.
 *
 * Note: This component starts listening to the status channel immediately
 * using the predictable terminal ID format (claude-${taskId}) to avoid
 * race conditions where the initial status message is sent before the
 * component mounts.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface TaskOutputPreviewProps {
  /** The terminal ID to listen for status updates. Format: claude-${taskId} */
  terminalId: string;
}

interface ClaudeStatusMessage {
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'system' | 'awaiting_input';
  message: string;
  details?: string;
  tool?: string;
  timestamp: number;
}

export function TaskOutputPreview({ terminalId }: TaskOutputPreviewProps) {
  // Start with null to avoid showing "Starting Claude Code..." flash
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isAwaitingInput, setIsAwaitingInput] = useState(false);

  // Ref for debounce timeout
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced status update to prevent rapid flashing
  const updateStatus = useCallback((message: string, isErr: boolean, isAwaiting: boolean) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setStatus(message);
      setIsError(isErr);
      setIsAwaitingInput(isAwaiting);
    }, 50);
  }, []);

  // Store the actual handler logic in a ref so it can be updated without changing the callback identity
  const handleStatusRef = useRef<((...args: unknown[]) => void) | null>(null);

  // Update the ref with current logic on every render
  handleStatusRef.current = (...args: unknown[]) => {
    const data = args[0] as ClaudeStatusMessage;
    if (data?.message) {
      updateStatus(
        data.message,
        data.type === 'error',
        data.type === 'awaiting_input'
      );
    }
  };

  // Fetch cached status on mount to avoid showing default text
  useEffect(() => {
    if (!terminalId) return;

    window.electron.invoke('terminal:get-last-status', terminalId)
      .then((result) => {
        const cached = result as ClaudeStatusMessage | null;
        if (cached?.message) {
          setStatus(cached.message);
          setIsError(cached.type === 'error');
          setIsAwaitingInput(cached.type === 'awaiting_input');
        }
      })
      .catch(() => {
        // Fallback if IPC not available yet - status will be null
        // which shows the loading state
      });
  }, [terminalId]);

  // Subscribe to live status updates
  useEffect(() => {
    if (!terminalId) return;

    const channel = `terminal:status:${terminalId}` as const;

    const dispose = window.electron.on(channel, (...args: unknown[]) => {
      handleStatusRef.current?.(...args);
    });

    return dispose;
  }, [terminalId]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Show a subtle loading state when status hasn't been fetched yet
  if (status === null) {
    return (
      <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
          <span className="text-xs font-mono text-zinc-500">
            Loading status...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md overflow-hidden">
      <div className="flex items-start gap-2 min-w-0">
        <span
          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
            isError ? 'bg-red-500' :
            isAwaitingInput ? 'bg-purple-500' :
            'bg-emerald-500 animate-pulse'
          }`}
        />
        <span
          className={`text-xs font-mono break-words min-w-0 line-clamp-2 ${
            isError ? 'text-red-400' :
            isAwaitingInput ? 'text-purple-400' :
            'text-zinc-300'
          }`}
          title={status}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
