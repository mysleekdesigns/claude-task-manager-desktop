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

import { useEffect, useState, useCallback } from 'react';

interface TaskOutputPreviewProps {
  /** The terminal ID to listen for status updates. Format: claude-${taskId} */
  terminalId: string;
}

interface ClaudeStatusMessage {
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'system';
  message: string;
  details?: string;
  tool?: string;
  timestamp: number;
}

export function TaskOutputPreview({ terminalId }: TaskOutputPreviewProps) {
  const [status, setStatus] = useState<string>('Starting Claude Code...');
  const [isError, setIsError] = useState(false);

  const handleStatus = useCallback((...args: unknown[]) => {
    const data = args[0] as ClaudeStatusMessage;
    if (data?.message) {
      setStatus(data.message);
      setIsError(data.type === 'error');
    }
  }, []);

  useEffect(() => {
    if (!terminalId) return;

    const channel = `terminal:status:${terminalId}` as const;
    window.electron.on(channel, handleStatus);

    return () => {
      window.electron.removeListener(channel, handleStatus);
    };
  }, [terminalId, handleStatus]);

  return (
    <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'
          }`}
        />
        <span
          className={`text-xs font-mono break-words whitespace-normal ${
            isError ? 'text-red-400' : 'text-zinc-300'
          }`}
          title={status}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
