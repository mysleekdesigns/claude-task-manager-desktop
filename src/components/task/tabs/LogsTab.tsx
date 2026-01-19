/**
 * LogsTab Component
 *
 * Displays task logs grouped by phase with collapsible sections.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import type { Task, TaskPhase, TaskLog } from '@/types/ipc';

interface LogsTabProps {
  task: Task;
}

export function LogsTab({ task }: LogsTabProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(task.phases?.map((p) => p.id) || [])
  );

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPhaseStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogsForPhase = (phaseId: string): TaskLog[] => {
    return (task.logs || []).filter((log) => log.phaseId === phaseId);
  };

  const getUnassignedLogs = (): TaskLog[] => {
    return (task.logs || []).filter((log) => !log.phaseId);
  };

  if (!task.phases || task.phases.length === 0) {
    const unassignedLogs = getUnassignedLogs();
    if (unassignedLogs.length === 0) {
      return (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">No logs yet.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] p-4">
        <div className="space-y-2">
          {unassignedLogs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 p-3 rounded-lg border bg-card"
            >
              {getLogIcon(log.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm">{log.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimestamp(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-4">
        {task.phases.map((phase: TaskPhase) => {
          const phaseLogs = getLogsForPhase(phase.id);
          const isExpanded = expandedPhases.has(phase.id);

          return (
            <div key={phase.id} className="border rounded-lg overflow-hidden">
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{phase.name}</p>
                    {phase.model && (
                      <Badge variant="outline" className="text-xs">
                        {phase.model}
                      </Badge>
                    )}
                  </div>
                  {phase.startedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Started: {formatTimestamp(phase.startedAt)}
                      {phase.endedAt && ` • Ended: ${formatTimestamp(phase.endedAt)}`}
                    </p>
                  )}
                </div>
                {getPhaseStatusBadge(phase.status)}
                <Badge variant="secondary" className="text-xs">
                  {phaseLogs.length} {phaseLogs.length === 1 ? 'log' : 'logs'}
                </Badge>
              </button>

              {/* Phase Logs */}
              {isExpanded && phaseLogs.length > 0 && (
                <>
                  <Separator />
                  <div className="p-3 bg-muted/30 space-y-2">
                    {phaseLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex gap-3 p-2 rounded bg-background"
                      >
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{log.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimestamp(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isExpanded && phaseLogs.length === 0 && (
                <>
                  <Separator />
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No logs for this phase.
                    </p>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Unassigned logs */}
        {getUnassignedLogs().length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <p className="text-sm font-medium mb-2">General Logs</p>
            <div className="space-y-2">
              {getUnassignedLogs().map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 p-2 rounded bg-background"
                >
                  {getLogIcon(log.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimestamp(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
