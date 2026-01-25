/**
 * Agent Process List Component
 *
 * Displays multiple agent processes in a list format.
 * Each agent shows: icon, name, status badge, and current activity message.
 * Designed for displaying parallel AI agent workflows.
 */

import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verifying';

export interface AgentProcess {
  /** Unique identifier for the agent */
  id: string;
  /** Display name of the agent */
  name: string;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }> | undefined;
  /** Current status of the agent */
  status: AgentStatus;
  /** Current activity message */
  activity?: string | undefined;
  /** Optional progress percentage (0-100) */
  progress?: number | undefined;
}

export interface AgentProcessListProps {
  /** List of agent processes to display */
  agents: AgentProcess[];
  /** Optional title for the list */
  title?: string | undefined;
  /** Whether to use compact layout */
  compact?: boolean | undefined;
}

// ============================================================================
// Status Styling
// ============================================================================

const STATUS_CONFIG: Record<AgentStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    dotClass: 'bg-zinc-500',
    Icon: Clock,
  },
  running: {
    label: 'Running',
    badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    dotClass: 'bg-cyan-500 animate-pulse',
    Icon: Loader2,
  },
  verifying: {
    label: 'Verifying',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-500 animate-pulse',
    Icon: Loader2,
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-500/20 text-green-400 border-green-500/30',
    dotClass: 'bg-green-500',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
    dotClass: 'bg-red-500',
    Icon: XCircle,
  },
};

// ============================================================================
// Agent Process Item Component
// ============================================================================

interface AgentProcessItemProps {
  agent: AgentProcess;
  compact?: boolean | undefined;
}

function AgentProcessItem({ agent, compact }: AgentProcessItemProps) {
  const { name, icon: AgentIcon, status, activity, progress } = agent;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.Icon;
  const isAnimated = status === 'running' || status === 'verifying';

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30',
      compact && 'p-2 gap-2'
    )}>
      {/* Agent Icon */}
      {AgentIcon && (
        <div className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          status === 'running' || status === 'verifying'
            ? 'bg-cyan-500/20 text-cyan-400'
            : status === 'completed'
              ? 'bg-green-500/20 text-green-400'
              : status === 'failed'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-zinc-500/20 text-zinc-400',
          compact && 'w-6 h-6'
        )}>
          <AgentIcon className={cn('w-4 h-4', compact && 'w-3 h-3')} />
        </div>
      )}

      {/* Agent Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'font-medium text-sm text-foreground',
            compact && 'text-xs'
          )}>
            {name}
          </span>
          <Badge
            variant="outline"
            className={cn('h-5 text-xs', config.badgeClass)}
          >
            {isAnimated && (
              <StatusIcon className="w-3 h-3 mr-1 animate-spin" />
            )}
            {!isAnimated && (
              <StatusIcon className="w-3 h-3 mr-1" />
            )}
            {config.label}
          </Badge>
        </div>

        {/* Activity Message */}
        {activity && (
          <p className={cn(
            'text-xs text-muted-foreground mt-1 line-clamp-2',
            isAnimated && 'text-cyan-400/80'
          )}>
            {activity}
          </p>
        )}

        {/* Progress Bar */}
        {typeof progress === 'number' && progress > 0 && progress < 100 && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status Indicator Dot */}
      <div className={cn(
        'w-2 h-2 rounded-full shrink-0 mt-1.5',
        config.dotClass
      )} />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentProcessList({ agents, title, compact }: AgentProcessListProps) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {title && (
        <h4 className={cn(
          'font-medium text-sm text-muted-foreground',
          compact && 'text-xs'
        )}>
          {title}
        </h4>
      )}
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentProcessItem key={agent.id} agent={agent} compact={compact} />
        ))}
      </div>
    </div>
  );
}
