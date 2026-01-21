/**
 * Claude Status Display Component
 *
 * A minimal, single-line status display showing what Claude Code is currently doing.
 */

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { ClaudeStatusMessage } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ClaudeStatusDisplayProps {
  currentStatus: ClaudeStatusMessage | null;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a simple, human-readable status message
 */
function getSimpleMessage(status: ClaudeStatusMessage | null): string {
  if (!status) {
    return 'Waiting...';
  }

  // Return the message directly - it should already be human-readable
  return status.message || 'Working...';
}

/**
 * Determine if the status indicates active work
 */
function isActiveStatus(status: ClaudeStatusMessage | null): boolean {
  if (!status) return false;
  return status.type === 'system' || status.type === 'tool_start' || status.type === 'thinking';
}

/**
 * Determine if the status indicates an error
 */
function isErrorStatus(status: ClaudeStatusMessage | null): boolean {
  if (!status) return false;
  return status.type === 'error';
}

/**
 * Determine if the status indicates completion
 */
function isCompletedStatus(status: ClaudeStatusMessage | null): boolean {
  if (!status) return false;
  return status.type === 'tool_end' || status.message?.toLowerCase().includes('completed');
}

// ============================================================================
// Main Component
// ============================================================================

export function ClaudeStatusDisplay({
  currentStatus,
  className,
}: ClaudeStatusDisplayProps) {
  const isActive = isActiveStatus(currentStatus);
  const isError = isErrorStatus(currentStatus);
  const isCompleted = isCompletedStatus(currentStatus);
  const message = getSimpleMessage(currentStatus);

  return (
    <div className={cn('flex items-center gap-2 px-4 py-3 text-sm', className)}>
      {/* Status indicator */}
      {isError ? (
        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      ) : isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : isActive ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
      ) : (
        <span className="h-4 w-4 flex items-center justify-center flex-shrink-0">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
        </span>
      )}

      {/* Status message */}
      <span className={cn(
        'truncate',
        isError ? 'text-destructive' : 'text-muted-foreground'
      )}>
        {message}
      </span>
    </div>
  );
}
