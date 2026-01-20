/**
 * Task Output Preview Component
 *
 * Displays a compact live preview of terminal output for running Claude tasks.
 * Shows the last 5 lines of terminal output with auto-scroll and ANSI code stripping.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TaskOutputPreviewProps {
  terminalId: string;
}

// ============================================================================
// ANSI Code Utilities
// ============================================================================

/**
 * Strip ANSI escape codes from terminal output
 * Regex pattern matches common ANSI escape sequences
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ============================================================================
// Component
// ============================================================================

export function TaskOutputPreview({ terminalId }: TaskOutputPreviewProps) {
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const MAX_LINES = 5;

  /**
   * Handle incoming terminal output
   * Splits on newlines, strips ANSI codes, and maintains a rolling buffer
   */
  const handleOutput = useCallback((...args: unknown[]) => {
    const data = args[0] as string;
    const cleanedData = stripAnsiCodes(data);
    const newLines = cleanedData.split('\n');

    setOutputLines(prev => {
      // Merge new lines with existing buffer
      const merged = [...prev];

      // If the last line in buffer is incomplete (no newline), append to it
      if (merged.length > 0 && !data.startsWith('\n')) {
        const lastLine = merged.pop() || '';
        merged.push(lastLine + newLines[0]);
        newLines.shift();
      }

      // Add remaining new lines
      merged.push(...newLines);

      // Keep only last MAX_LINES, filtering empty lines at the end
      const trimmed = merged.slice(-MAX_LINES * 2).filter(line => line.trim().length > 0);
      return trimmed.slice(-MAX_LINES);
    });
  }, []);

  /**
   * Subscribe to terminal output events
   */
  useEffect(() => {
    const channel = `terminal:output:${terminalId}` as const;

    // Subscribe to IPC events
    window.electron.on(channel, handleOutput);

    // Cleanup on unmount
    return () => {
      window.electron.removeListener(channel, handleOutput);
    };
  }, [terminalId, handleOutput]);

  /**
   * Auto-scroll to bottom when new output arrives
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  // Don't render if no output
  if (outputLines.length === 0) {
    return (
      <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md">
        <p className="text-xs text-zinc-500 font-mono">Waiting for output...</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md max-h-32 overflow-y-auto"
    >
      <div className="space-y-0.5">
        {outputLines.map((line, index) => (
          <div
            key={`${terminalId}-${index}`}
            className="text-xs font-mono text-zinc-300 leading-relaxed break-all"
          >
            {line || '\u00A0'} {/* Non-breaking space for empty lines */}
          </div>
        ))}
      </div>
    </div>
  );
}
