/**
 * Task Card Start Button Component
 *
 * Button for starting/pausing/resuming Claude Code automation on a task.
 * Shows different states based on current Claude status.
 *
 * Note: This component relies on page-level polling in kanban.tsx for status updates.
 * The task prop is updated by the parent component when page-level refetch occurs.
 */

import { useState } from 'react';
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
  refetchTasks?: (() => Promise<void>) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function TaskCardStartButton({
  task,
  onStart,
  refetchTasks,
}: TaskCardStartButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const { mutate: startTask } = useStartClaudeTask();

  // Fetch project data to get targetPath
  const { data: project } = useIPCQuery('projects:get', [task.projectId]);

  // Get current Claude status from task database
  // Page-level polling in kanban.tsx updates the task prop, so we use the task data directly
  const claudeStatus: ClaudeTaskStatus = getClaudeStatusFromTask(task);

  // Check if terminal is running based on task's terminal ID presence
  // The page-level polling keeps task data fresh
  const isTerminalRunning = Boolean(task.claudeTerminalId);

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

      // Refresh tasks after starting (page-level polling will handle ongoing updates)
      setTimeout(() => {
        void refetchTasks?.();
      }, 500);
    } catch (err) {
      console.error('Failed to start Claude Code on task:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start Claude Code session';
      toast.error(errorMessage);

      // Refresh tasks to show the actual state after error
      setTimeout(() => {
        void refetchTasks?.();
      }, 100);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();

    setIsPausing(true);
    try {
      // Pause the Claude Code session using claude:pauseTask
      const { invoke } = window.electron;
      await invoke('claude:pauseTask', { taskId: task.id });

      toast.success('Claude Code session paused');

      // Refresh tasks after pausing (page-level polling will handle ongoing updates)
      setTimeout(() => {
        void refetchTasks?.();
      }, 500);
    } catch (err) {
      console.error('Failed to pause Claude Code session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to pause Claude Code session';
      toast.error(errorMessage);

      // If the error is because terminal doesn't exist, trigger a task refresh
      if (errorMessage.includes('not running') || errorMessage.includes('not found')) {
        setTimeout(() => {
          void refetchTasks?.();
        }, 100);
      }
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Validate we have a session ID to resume
    if (!task.claudeSessionId) {
      toast.error('No Claude session ID found. Cannot resume.');
      return;
    }

    setIsResuming(true);
    try {
      // Resume the Claude Code session using claude:resumeTask
      const { invoke } = window.electron;
      await invoke('claude:resumeTask', {
        taskId: task.id,
        sessionId: task.claudeSessionId,
      });

      toast.success('Claude Code session resumed');

      // Refresh tasks after resuming (page-level polling will handle ongoing updates)
      setTimeout(() => {
        void refetchTasks?.();
      }, 500);
    } catch (err) {
      console.error('Failed to resume Claude Code session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to resume Claude Code session';
      toast.error(errorMessage);

      // If the error is because terminal doesn't exist, trigger a task refresh
      if (errorMessage.includes('not paused') || errorMessage.includes('not found')) {
        setTimeout(() => {
          void refetchTasks?.();
        }, 100);
      }
    } finally {
      setIsResuming(false);
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
            onClick={(e) => { void handlePause(e); }}
            disabled={isPausing}
            className="h-7 px-3 text-xs gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-600 dark:text-amber-500 dark:hover:bg-amber-950 disabled:opacity-70"
          >
            {isPausing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Pausing...
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                Pause
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isPausing ? 'Pausing Claude Code session' : 'Pause Claude Code session'}</p>
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
            onClick={(e) => { void handleResume(e); }}
            disabled={isResuming}
            className="h-7 px-3 text-xs gap-1.5 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-600 dark:text-green-500 dark:hover:bg-green-950 disabled:opacity-70"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Resume
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isResuming ? 'Resuming Claude Code session' : 'Resume Claude Code session'}</p>
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
            onClick={(e) => { void handleStart(e); }}
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
