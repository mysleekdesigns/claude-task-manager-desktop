/**
 * Task Card Start Button Component
 *
 * Button for starting Claude Code automation on a task.
 * Only visible for tasks in PLANNING status.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Play, Loader2 } from 'lucide-react';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import type { Task } from '@/types/ipc';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface TaskCardStartButtonProps {
  task: Task;
  onStart?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TaskCardStartButton({
  task,
  onStart,
}: TaskCardStartButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const { mutate: startTask } = useIPCMutation('claude:startTask');

  // Fetch project data to get targetPath
  const { data: project } = useIPCQuery('projects:get', [task.projectId]);

  // Only show for PLANNING tasks
  if (task.status !== 'PLANNING') {
    return null;
  }

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
    } catch (err) {
      console.error('Failed to start Claude Code on task:', err);
      toast.error('Failed to start Claude Code session');
    } finally {
      setIsStarting(false);
    }
  };

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
          {isStarting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              Start
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Start with Claude Code</p>
      </TooltipContent>
    </Tooltip>
  );
}
