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
 * Comprehensive regex to handle:
 * - CSI sequences including bracketed paste mode ([?2004h, [?2004l)
 * - OSC sequences (title changes, etc.)
 * - Other escape sequences
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]|\x1b\[\?[0-9;]*[hl]/g;

  return text
    .replace(ansiRegex, '')
    // Remove shell continuation prompts (quote>, dquote>, >, $, %)
    .replace(/^(quote>|dquote>|>|\$|%)\s*/gm, '');
}

// ============================================================================
// Component
// ============================================================================

const MAX_LINES = 12;

export function TaskOutputPreview({ terminalId }: TaskOutputPreviewProps) {
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<string[]>([]);
  const partialLineRef = useRef<string>(''); // Track incomplete line chunks
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0); // Will be set on first output
  const hasReceivedOutputRef = useRef<boolean>(false);

  // Track seen lines for deduplication (sliding window approach)
  const seenLinesRef = useRef<Set<string>>(new Set());

  /**
   * Create a ref to hold the latest handler implementation.
   * This provides a STABLE function reference for IPC subscription,
   * preventing duplicate listeners when the component re-renders.
   */
  const handleOutputRef = useRef<((...args: unknown[]) => void) | null>(null);

  /**
   * Update the ref's implementation whenever dependencies change.
   * This doesn't trigger re-subscription because we don't pass this to useEffect deps.
   */
  useEffect(() => {
    handleOutputRef.current = (...args: unknown[]) => {
      const data = args[0] as string;
      const cleanedData = stripAnsiCodes(data);

      // Reset timer on first output (Issue 2: Reset timing on first output)
      if (!hasReceivedOutputRef.current) {
        hasReceivedOutputRef.current = true;
        startTimeRef.current = Date.now(); // Reset timer on first output
      }

      // Prepend any incomplete line from previous chunk
      const fullData = partialLineRef.current + cleanedData;

      // Split by newlines
      const parts = fullData.split('\n');

      // The last element is either:
      // - Empty string if data ended with \n (complete line)
      // - Partial line if data didn't end with \n (incomplete)
      const hasTrailingNewline = cleanedData.endsWith('\n');

      // If no trailing newline, last part is incomplete - save for next chunk
      if (!hasTrailingNewline && parts.length > 0) {
        partialLineRef.current = parts.pop() || '';
      } else {
        partialLineRef.current = '';
      }

      // Add complete lines to buffer
      if (parts.length > 0) {
        bufferRef.current.push(...parts);

        // Keep only last MAX_LINES, filtering empty lines
        const nonEmptyLines = bufferRef.current.filter(line => line.trim().length > 0);
        bufferRef.current = nonEmptyLines.slice(-MAX_LINES);
      }

      // DEBUG: Log processing results
      console.log(`[TaskOutputPreview] Processed: ${String(parts.length)} complete lines, partial=${String(partialLineRef.current.length)} bytes, buffer=${String(bufferRef.current.length)} lines`);

      // Calculate time elapsed since component mount
      const elapsedTime = Date.now() - startTimeRef.current;
      const isInitialPeriod = elapsedTime < 2000; // First 2 seconds

      // During initial period: update immediately (no throttle)
      // After initial period: throttle updates to 500ms
      if (isInitialPeriod) {
        setOutputLines([...bufferRef.current]);
        console.log(`[TaskOutputPreview] Updated UI immediately with ${String(bufferRef.current.length)} lines`);
      } else {
        // Throttle UI updates to once per 500ms
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            setOutputLines([...bufferRef.current]);
            console.log(`[TaskOutputPreview] Throttled UI update with ${String(bufferRef.current.length)} lines`);
            throttleTimerRef.current = null;
          }, 500);
        }
      }
    };
  }, []); // Empty deps - update ref's content, not the ref itself

  /**
   * FIX 1: Create a STABLE handler using useCallback with empty deps
   * This ensures the SAME function reference is used for both registration and removal
   */
  const stableHandler = useCallback((...args: unknown[]) => {
    console.log(`[TaskOutputPreview] Received IPC event with ${String((args[0] as string)?.length ?? 0)} bytes`);
    handleOutputRef.current?.(...args);
  }, []); // Empty deps = stable reference across renders

  /**
   * Subscribe to live events IMMEDIATELY, then fetch buffered output in parallel.
   *
   * FIX: Previous implementation subscribed AFTER the buffer fetch completed,
   * causing a race condition where live data sent during the async gap was missed.
   *
   * New flow:
   * 1. Subscribe to live events IMMEDIATELY on mount (synchronous)
   * 2. Fetch initial buffer in parallel (async)
   * 3. Live events are captured even during the buffer fetch
   * 4. Buffer data is merged with any live data that arrived
   */
  useEffect(() => {
    if (!terminalId) return;

    let isMounted = true;
    const channel = `terminal:output:${terminalId}` as const;

    // SUBSCRIBE IMMEDIATELY - don't wait for buffer fetch
    // This ensures we capture any live data sent during the async gap
    console.log(`[TaskOutputPreview] Subscribing to channel: ${channel}`);
    window.electron.on(channel, stableHandler);

    // THEN fetch initial buffer (runs in parallel with live subscription)
    window.electron.invoke<string[]>('terminal:getBuffer', terminalId)
      .then((buffer) => {
        if (!isMounted) return;

        if (buffer && buffer.length > 0) {
          console.log(`[TaskOutputPreview] Received buffer with ${String(buffer.length)} lines`);
          // Buffer is already split into lines, just clean ANSI codes and filter
          const cleanedLines = buffer.map((line: string) => stripAnsiCodes(line));
          const filtered = cleanedLines.filter((line: string) => line.trim().length > 0);

          // Merge with any live data that arrived during the fetch
          // Buffer data goes first (it's older), then live data
          const existingLines = bufferRef.current;
          const mergedLines = [...filtered, ...existingLines];

          // Issue 3: Improved deduplication using Set to handle non-adjacent duplicates
          // This handles duplicates that occur during buffer/live overlap
          const deduped: string[] = [];
          const seen = new Set<string>();

          for (const line of mergedLines) {
            // Create a normalized key for comparison (trim whitespace)
            const normalizedLine = line.trim();
            if (normalizedLine && !seen.has(normalizedLine)) {
              seen.add(normalizedLine);
              deduped.push(line);
            }
          }

          // Update the global seen lines set for future deduplication
          seenLinesRef.current = seen;

          bufferRef.current = deduped.slice(-MAX_LINES);
          setOutputLines([...bufferRef.current]);

          // Reset timer on first output from buffer
          if (!hasReceivedOutputRef.current) {
            hasReceivedOutputRef.current = true;
            startTimeRef.current = Date.now();
          }

          // NOTE: Don't clear the main process buffer - we need it on remount
          // The buffer may have duplicate data, but deduplication handles that
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch terminal buffer:', err);
        setError('Failed to load initial output');
        // Live subscription is already active, so we'll still receive output
      });

    // Cleanup removes the listener
    return () => {
      isMounted = false;
      window.electron.removeListener(channel, stableHandler);

      // Clear any pending throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [terminalId, stableHandler]);

  /**
   * Auto-scroll to bottom when new output arrives
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  /**
   * Generate a simple hash for a string to create stable keys
   */
  const hashLine = (line: string, index: number): string => {
    // Create a hash based on line content and position for uniqueness
    let hash = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${terminalId}-${String(index)}-${String(hash)}`;
  };

  return (
    <div
      ref={scrollRef}
      className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md max-h-80 overflow-y-auto"
    >
      <div className="space-y-0.5">
        {/* Issue 5: Display error state if buffer fetch failed */}
        {error && (
          <div className="text-xs font-mono text-red-400">
            {error}
          </div>
        )}
        {/* Issue 1: Show loading indicator when no output yet */}
        {outputLines.length === 0 ? (
          <div className="text-xs font-mono text-zinc-500 animate-pulse">
            Starting Claude Code...
          </div>
        ) : (
          outputLines.map((line, index) => (
            <div
              key={hashLine(line, index)} /* Issue 4: Use content hash for stable key */
              className="text-xs font-mono text-zinc-300 leading-relaxed break-words whitespace-pre-wrap"
            >
              {line || '\u00A0'} {/* Non-breaking space for empty lines */}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
