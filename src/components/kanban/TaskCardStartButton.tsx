/**
 * Task Card Start Button Component
 *
 * Button for starting/pausing/resuming Claude Code automation on a task.
 * Shows different states based on current Claude status.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Play, Loader2, Pause } from 'lucide-react';
import { useIPCQuery } from '@/hooks/useIPC';
import {
  useStartClaudeTask,
  useClaudeStatusPolling,
  getClaudeStatusFromTask,
} from '@/hooks/useClaudeStatus';
import type { Task, ClaudeTaskStatus } from '@/types/ipc';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface TaskCardStartButtonProps {
  task: Task;
  onStart?: (() => void) | undefined;
  onStateChange?: (() => void) | undefined;
  refetchTasks?: (() => Promise<void>) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function TaskCardStartButton({
  task,
  onStart,
  onStateChange,
  refetchTasks,
}: TaskCardStartButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const { mutate: startTask } = useStartClaudeTask();

  // Fetch project data to get targetPath
  const { data: project } = useIPCQuery('projects:get', [task.projectId]);

  // Poll for Claude status when active
  const { data: statusData, refetch: refetchStatus } = useClaudeStatusPolling(task.id, 2000);

  // Get current Claude status from task database
  const claudeStatusFromDB: ClaudeTaskStatus = getClaudeStatusFromTask(task);

  // Get actual runtime status (is terminal actually running?)
  const isTerminalRunning = statusData?.isRunning || false;

  // Detect state mismatch: database says RUNNING but terminal isn't running
  const hasStateMismatch =
    (claudeStatusFromDB === 'RUNNING' || claudeStatusFromDB === 'STARTING') &&
    !isTerminalRunning &&
    statusData !== undefined; // Only detect mismatch after we've queried status

  // Determine the effective Claude status
  const claudeStatus: ClaudeTaskStatus = hasStateMismatch ? 'FAILED' : claudeStatusFromDB;

  // Notify parent when status changes
  useEffect(() => {
    onStateChange?.();
  }, [claudeStatus, onStateChange]);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event

    // Validate we have required data
    if (!project?.targetPath) {
      toast.error('Project path not configured. Please set project directory in settings.');
      return;
    }

    setIsStarting(true);
    try {
      const sessionId = crypto.randomUUID();

      await startTask({
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description || '',
        projectPath: project.targetPath,
        sessionId,
      });

      toast.success('Claude Code session started');
      onStart?.();

      // Refresh both status and tasks after starting
      setTimeout(async () => {
        void refetchStatus();
        await refetchTasks?.();
      }, 500);
    } catch (err) {
      console.error('Failed to start Claude Code on task:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start Claude Code session';
      toast.error(errorMessage);

      // Refresh status and tasks to show the actual state after error
      setTimeout(async () => {
        void refetchStatus();
        await refetchTasks?.();
      }, 100);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!task.claudeTerminalId) {
      toast.error('No terminal ID found. Cannot pause.');
      return;
    }

    try {
      // Pause the terminal process
      const { invoke } = window.electron;
      const success = await invoke('terminal:pause', task.claudeTerminalId);

      if (success) {
        // Update task status to PAUSED
        await invoke('tasks:update', task.id, {
          claudeStatus: 'PAUSED',
        });

        toast.success('Claude Code session paused');

        // Refresh status and tasks after pausing
        setTimeout(async () => {
          void refetchStatus();
          await refetchTasks?.();
        }, 500);
      }
    } catch (err) {
      console.error('Failed to pause Claude Code session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to pause Claude Code session';
      toast.error(errorMessage);

      // If the error is because terminal doesn't exist, trigger a status and task refresh
      if (errorMessage.includes('not running') || errorMessage.includes('not found')) {
        setTimeout(async () => {
          void refetchStatus();
          await refetchTasks?.();
        }, 100);
      }
    }
  };

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!task.claudeTerminalId) {
      toast.error('No terminal ID found. Cannot resume.');
      return;
    }

    try {
      // Resume the terminal process
      const { invoke } = window.electron;
      const success = await invoke('terminal:resume', task.claudeTerminalId);

      if (success) {
        // Update task status back to RUNNING
        await invoke('tasks:update', task.id, {
          claudeStatus: 'RUNNING',
        });

        toast.success('Claude Code session resumed');

        // Refresh status and tasks after resuming
        setTimeout(async () => {
          void refetchStatus();
          await refetchTasks?.();
        }, 500);
      }
    } catch (err) {
      console.error('Failed to resume Claude Code session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to resume Claude Code session';
      toast.error(errorMessage);

      // If the error is because terminal doesn't exist, trigger a status and task refresh
      if (errorMessage.includes('not paused') || errorMessage.includes('not found')) {
        setTimeout(async () => {
          void refetchStatus();
          await refetchTasks?.();
        }, 100);
      }
    }
  };


  // Show nothing if task is not in PLANNING or IN_PROGRESS
  if (task.status !== 'PLANNING' && task.status !== 'IN_PROGRESS') {
    return null;
  }

  // Show Pause button when Claude is running (and terminal actually exists)
  if ((claudeStatus === 'RUNNING' || claudeStatus === 'AWAITING_INPUT') && isTerminalRunning) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePause}
            className="h-7 px-3 text-xs gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-600 dark:text-amber-500 dark:hover:bg-amber-950"
          >
            <Pause className="h-3 w-3" />
            Pause
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Pause Claude Code session</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Show Resume button when Claude is paused
  if (claudeStatus === 'PAUSED') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResume}
            className="h-7 px-3 text-xs gap-1.5 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-600 dark:text-green-500 dark:hover:bg-green-950"
          >
            <Play className="h-3 w-3" />
            Resume
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Resume Claude Code session</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Show Starting state
  if (claudeStatus === 'STARTING' || isStarting) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="default"
            disabled
            className="h-7 px-3 text-xs gap-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Starting...
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Initializing Claude Code session</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Default: Show Start button for PLANNING tasks or idle IN_PROGRESS tasks
  if (task.status === 'PLANNING' || (task.status === 'IN_PROGRESS' && claudeStatus === 'IDLE')) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="default"
            onClick={handleStart}
            disabled={isStarting}
            className="h-7 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Play className="h-3 w-3 fill-current" />
            Start
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Start with Claude Code</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
