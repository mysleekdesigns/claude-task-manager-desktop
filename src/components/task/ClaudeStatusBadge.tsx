/**
 * Claude Status Badge Component
 *
 * Displays the current Claude Code automation status for a task.
 * Color-coded with animations for active states.
 */

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ClaudeTaskStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ClaudeStatusBadgeProps {
  status: ClaudeTaskStatus;
  terminalId?: string | undefined;
  onClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
  ClaudeTaskStatus,
  {
    label: string;
    className: string;
    animated?: boolean;
  }
> = {
  IDLE: {
    label: 'Idle',
    className: 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-300',
  },
  STARTING: {
    label: 'Starting',
    className: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-300',
    animated: true,
  },
  RUNNING: {
    label: 'Running',
    className: 'bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-300',
    animated: true,
  },
  PAUSED: {
    label: 'Paused',
    className: 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-300',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-300',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-300',
  },
  AWAITING_INPUT: {
    label: 'Awaiting Input',
    className: 'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-300',
    animated: true,
  },
};

// ============================================================================
// Component
// ============================================================================

export function ClaudeStatusBadge({
  status,
  terminalId,
  onClick,
}: ClaudeStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Don't render if IDLE (no Claude session)
  if (status === 'IDLE') {
    return null;
  }

  // Build tooltip content
  const tooltipContent = (): string => {
    switch (status) {
      case 'STARTING':
        return 'Claude Code is initializing...';
      case 'RUNNING':
        return `Claude Code is actively working${terminalId ? ` (Terminal: ${terminalId})` : ''}`;
      case 'PAUSED':
        return 'Claude Code session is paused. Click Resume to continue.';
      case 'COMPLETED':
        return 'Claude Code has completed this task';
      case 'FAILED':
        return 'Claude Code encountered an error';
      case 'AWAITING_INPUT':
        return 'Claude Code is waiting for your input';
      default:
        return terminalId ? `Terminal: ${terminalId}` : '';
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          onClick={onClick}
          className={cn(
            'text-xs transition-all',
            config.className,
            config.animated && 'animate-pulse',
            onClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'
          )}
        >
          <span className="flex items-center gap-1.5">
            {config.animated && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
            )}
            {config.label}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{tooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
