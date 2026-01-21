/**
 * ClaudeTab Component
 *
 * Displays Claude Code session information and controls for a task.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Play, Pause, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useClaudeCode } from '@/hooks/useClaudeCode';
import { useIPC } from '@/hooks/useIPC';
import type { Task, ClaudeTaskStatus } from '@/types/ipc';

interface ClaudeTabProps {
  task: Task;
  onStatusChange?: () => void;
}

export function ClaudeTab({ task, onStatusChange }: ClaudeTabProps) {
  const invoke = useIPC();
  const {
    startTask,
    pauseTask,
    resumeTask,
    isStarting,
    isPausing,
    isResuming,
  } = useClaudeCode();

  // Helper to get badge variant for Claude status
  const getClaudeStatusBadgeVariant = (status: ClaudeTaskStatus) => {
    switch (status) {
      case 'RUNNING':
        return 'default';
      case 'PAUSED':
      case 'AWAITING_INPUT':
        return 'secondary';
      case 'COMPLETED':
        return 'outline';
      case 'FAILED':
        return 'destructive';
      case 'STARTING':
        return 'default';
      case 'IDLE':
      default:
        return 'outline';
    }
  };

  // Helper to get display text for status
  const getClaudeStatusText = (status: ClaudeTaskStatus) => {
    switch (status) {
      case 'AWAITING_INPUT':
        return 'Awaiting Input';
      case 'RUNNING':
        return 'In Progress';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  const handleStartTask = async () => {
    try {
      console.log('[ClaudeTab] handleStartTask called with task:', {
        id: task.id,
        title: task.title,
        description: task.description,
        projectId: task.projectId,
      });

      // Validate task data is present
      if (!task.id) {
        toast.error('Task ID is missing');
        console.error('[ClaudeTab] Task ID is missing from task object:', task);
        return;
      }

      if (!task.title) {
        toast.error('Task title is missing');
        console.error('[ClaudeTab] Task title is missing from task object:', task);
        return;
      }

      if (!task.projectId) {
        toast.error('Project ID is missing');
        console.error('[ClaudeTab] Project ID is missing from task object:', task);
        return;
      }

      // Fetch project to get targetPath
      const project = await invoke('projects:get', task.projectId);
      console.log('[ClaudeTab] Fetched project:', project);

      if (!project?.targetPath || project.targetPath.trim() === '') {
        toast.error('Project path not configured');
        return;
      }

      // Generate a unique session ID using crypto.randomUUID()
      const sessionId = task.claudeSessionId || crypto.randomUUID();

      // Build input object with explicit values
      const input = {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description || '',
        projectPath: project.targetPath,
        sessionId: sessionId,
      };

      console.log('[ClaudeTab] Calling startTask with input:', input);

      await startTask(input);

      toast.success('Starting Claude Code session...');
      onStatusChange?.();
    } catch (error) {
      console.error('[ClaudeTab] Failed to start task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start task');
    }
  };

  const handleResumeTask = async () => {
    try {
      if (!task.claudeSessionId) {
        toast.error('No session to resume');
        return;
      }

      await resumeTask({
        taskId: task.id,
        sessionId: task.claudeSessionId,
      });

      toast.success('Resuming Claude Code session...');
      onStatusChange?.();
    } catch (error) {
      console.error('Failed to resume task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resume task');
    }
  };

  const handlePauseTask = async () => {
    try {
      await pauseTask({
        taskId: task.id,
      });

      toast.success('Pausing Claude Code session...');
      onStatusChange?.();
    } catch (error) {
      console.error('Failed to pause task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to pause task');
    }
  };

  const handleViewTerminal = () => {
    if (task.claudeTerminalId) {
      // TODO: Navigate to terminal view or focus terminal pane
      toast.info('Opening terminal...');
    }
  };

  const claudeStatus = task.claudeStatus || 'IDLE';
  const hasSession = !!task.claudeSessionId;
  const canStart = claudeStatus === 'IDLE' && task.status === 'PLANNING';
  const canResume = claudeStatus === 'PAUSED';
  const canPause = claudeStatus === 'RUNNING';
  const isPerformingAction = isStarting || isPausing || isResuming;

  return (
    <div className="space-y-6 p-4">
      {/* Session Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Claude Code Session</CardTitle>
            </div>
            <Badge variant={getClaudeStatusBadgeVariant(claudeStatus)}>
              {getClaudeStatusText(claudeStatus)}
            </Badge>
          </div>
          <CardDescription>
            {hasSession
              ? 'Automated task execution with Claude Code'
              : 'No active session'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Information */}
          {hasSession && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Session ID</Label>
                <p className="text-sm text-muted-foreground font-mono">
                  {task.claudeSessionId}
                </p>
              </div>

              {task.claudeSessionName && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Session Name</Label>
                  <p className="text-sm text-muted-foreground">
                    {task.claudeSessionName}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                {task.claudeStartedAt && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.claudeStartedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                )}

                {task.claudeCompletedAt && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Completed
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.claudeCompletedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* No Session State */}
          {!hasSession && (
            <div className="text-center py-6">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No Claude Code session has been started for this task yet.
              </p>
              {canStart && (
                <p className="text-xs text-muted-foreground mt-2">
                  Start a session to automate this task with Claude Code.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {canStart && (
              <Button
                onClick={handleStartTask}
                disabled={isPerformingAction}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Start Claude Session
              </Button>
            )}

            {canResume && (
              <Button
                onClick={handleResumeTask}
                disabled={isPerformingAction}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}

            {canPause && (
              <Button
                onClick={handlePauseTask}
                disabled={isPerformingAction}
                variant="secondary"
                className="gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}

            {task.claudeTerminalId && (
              <Button
                onClick={handleViewTerminal}
                variant="outline"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                View Terminal
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">About Claude Code Automation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Claude Code can automatically work on this task by analyzing requirements,
            writing code, running tests, and iterating on solutions. You can monitor
            progress in real-time through the linked terminal and review changes before
            committing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
