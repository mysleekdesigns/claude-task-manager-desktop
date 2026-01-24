/**
 * Task Card Review Button Component
 *
 * Button for initiating AI review workflow on a task.
 * Shows when task work is complete but not yet reviewed.
 */

import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReviewWorkflow } from '@/hooks/useReview';
import { useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';
import type { Task } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface TaskCardReviewButtonProps {
  task: Task;
  refetchTasks?: (() => Promise<void>) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function TaskCardReviewButton({
  task,
  refetchTasks,
}: TaskCardReviewButtonProps) {
  const { startReview, isStarting } = useReviewWorkflow(task.id);
  const { mutate: updateTaskStatus, loading: isUpdating } = useIPCMutation('tasks:updateStatus');

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event

    try {
      // Move task to AI_REVIEW status
      await updateTaskStatus(task.id, 'AI_REVIEW');

      // Start the review process
      await startReview();

      toast.success('AI review started');

      // Refresh tasks after starting
      setTimeout(() => {
        void refetchTasks?.();
      }, 500);
    } catch (err) {
      console.error('Failed to start AI review:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start AI review';
      toast.error(errorMessage);

      // Refresh tasks to show actual state after error
      setTimeout(() => {
        void refetchTasks?.();
      }, 100);
    }
  };

  // Only show when task work is complete but not yet reviewed
  // Task should be IN_PROGRESS with claudeStatus COMPLETED
  if (task.status !== 'IN_PROGRESS' || task.claudeStatus !== 'COMPLETED') {
    return null;
  }

  const isLoading = isStarting || isUpdating;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => { void handleClick(e); }}
          disabled={isLoading}
          className="h-7 px-3 text-xs gap-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Review
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isLoading
            ? 'Starting AI review...'
            : 'Start AI code review on completed work'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
