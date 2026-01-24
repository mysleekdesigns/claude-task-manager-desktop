/**
 * ActivityTab Component
 *
 * Displays task activity timeline with filtering options.
 * Shows tool usage, text output, thinking, errors, and decisions.
 */

import { useState } from 'react';
import { useTaskHistory } from '@/hooks/useReview';
import {
  Wrench,
  MessageSquare,
  Brain,
  AlertCircle,
  GitBranch,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ActivityType } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  tool_use: Wrench,
  text: MessageSquare,
  thinking: Brain,
  error: AlertCircle,
  decision: GitBranch,
};

const TYPE_COLORS: Record<ActivityType, string> = {
  tool_use: 'bg-blue-500',
  text: 'bg-gray-500',
  thinking: 'bg-purple-500',
  error: 'bg-red-500',
  decision: 'bg-green-500',
};

const TYPE_LABELS: Record<ActivityType, string> = {
  tool_use: 'Tools',
  text: 'Text',
  thinking: 'Thinking',
  error: 'Errors',
  decision: 'Decisions',
};

// ============================================================================
// Types
// ============================================================================

interface ActivityTabProps {
  taskId: string;
}

// ============================================================================
// Component
// ============================================================================

export function ActivityTab({ taskId }: ActivityTabProps) {
  const { history, isLoading, refetch } = useTaskHistory(taskId);
  const [filter, setFilter] = useState<string>('all');

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle empty state
  if (!history || history.activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <p className="text-center text-muted-foreground">
          No activity recorded yet
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  // Filter activities
  const filteredActivities =
    filter === 'all'
      ? history.activities
      : history.activities.filter((a) => a.type === filter);

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-4 p-4">
      {/* Summary Section */}
      {history.summary && (
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Summary</h4>
          <p className="text-sm text-muted-foreground">
            {history.summary.summary}
          </p>
          {history.summary.keyChanges.length > 0 && (
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              {history.summary.keyChanges.slice(0, 3).map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span>{history.summary.filesChanged} files changed</span>
            <span className="text-green-600 dark:text-green-400">
              +{history.summary.linesAdded}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{history.summary.linesRemoved}
            </span>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {filteredActivities.length} activities
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
            className="h-8"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="tool_use">Tools</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="thinking">Thinking</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="decision">Decisions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Activity List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-1">
          {filteredActivities.map((activity) => {
            const Icon =
              TYPE_ICONS[activity.type as ActivityType] || MessageSquare;
            const color =
              TYPE_COLORS[activity.type as ActivityType] || 'bg-gray-500';

            return (
              <div
                key={activity.id}
                className="flex gap-3 p-2 hover:bg-muted rounded-md transition-colors"
              >
                {/* Color indicator */}
                <div className={cn('w-1 rounded-full shrink-0', color)} />

                {/* Icon */}
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{activity.summary}</span>
                    {activity.toolName && (
                      <Badge variant="outline" className="text-xs">
                        {activity.toolName}
                      </Badge>
                    )}
                  </div>
                  {activity.duration !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(activity.duration)}
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTime(activity.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Empty filtered state */}
      {filteredActivities.length === 0 && history.activities.length > 0 && (
        <div className="text-center text-sm text-muted-foreground py-4">
          No {TYPE_LABELS[filter as ActivityType] || filter} activities found
        </div>
      )}
    </div>
  );
}
