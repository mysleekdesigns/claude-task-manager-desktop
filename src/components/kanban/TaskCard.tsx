/**
 * Task Card Component
 *
 * Individual draggable task card for the Kanban board.
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 * Wrapped with React.memo to prevent unnecessary re-renders.
 */

import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Clock, MoreVertical, Pencil, Trash2, Terminal } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/ipc';
import { TaskCardStartButton } from './TaskCardStartButton';
import { TaskCardReviewButton } from './TaskCardReviewButton';
import { ClaudeStatusBadge } from '@/components/task/ClaudeStatusBadge';
import { isClaudeActive, getClaudeStatusFromTask } from '@/hooks/useClaudeStatus';
import { TaskOutputPreview } from './TaskOutputPreview';
import { ReviewOutputPreview } from './ReviewOutputPreview';
import { PhaseBadge } from './PhaseBadge';

// ============================================================================
// Types
// ============================================================================

interface TaskCardProps {
  task: Task;
  onClick?: (() => void) | undefined;
  onEdit?: ((task: Task) => void) | undefined;
  onDelete?: ((task: Task) => void) | undefined;
  onViewTerminal?: ((task: Task) => void) | undefined;
  refetchTasks?: (() => Promise<void>) | undefined;
  isDragging?: boolean | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Format time ago - extracted to prevent recreation on every render
const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${String(diffMins)} min ago`;
  } else if (diffHours < 24) {
    return `${String(diffHours)} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return `${String(diffDays)} day${diffDays > 1 ? 's' : ''} ago`;
  }
};

// Get status badge label - extracted to prevent recreation on every render
const getStatusLabel = (status: TaskStatus): string => {
  const labels: Record<TaskStatus, string> = {
    PENDING: 'Pending',
    PLANNING: 'Planning',
    IN_PROGRESS: 'In Progress',
    AI_REVIEW: 'AI Review',
    HUMAN_REVIEW: 'Human Review',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status];
};

// ============================================================================
// Component
// ============================================================================

function TaskCardComponent({
  task,
  onClick,
  onEdit,
  onDelete,
  onViewTerminal,
  refetchTasks,
  isDragging = false,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  // Check if Claude is actively working (includes paused state)
  const claudeStatus = getClaudeStatusFromTask(task);
  const isClaudeRunning = isClaudeActive(claudeStatus);

  // Memoize event handlers to prevent child re-renders
  const handleViewTerminal = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onViewTerminal?.(task);
    },
    [onViewTerminal, task]
  );

  const handleEdit = useCallback(() => {
    onEdit?.(task);
  }, [onEdit, task]);

  const handleDelete = useCallback(() => {
    onDelete?.(task);
  }, [onDelete, task]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-all overflow-hidden max-w-full border border-primary ${
        isCurrentlyDragging
          ? 'opacity-50 shadow-lg ring-2 ring-primary'
          : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      {/* Card Content - min-w-0 is critical for flex children to respect overflow */}
      <CardContent className="p-4 space-y-3 cursor-pointer overflow-hidden min-w-0 w-full">
        {/* Title */}
        <h4 className="font-semibold text-base leading-tight truncate" title={task.title}>
          {task.title}
        </h4>

        {/* Phase Badge - only show if task is phase-scoped */}
        {task.prdPhaseNumber != null && (
          <PhaseBadge
            phaseNumber={task.prdPhaseNumber}
            phaseName={task.prdPhaseName}
          />
        )}

        {/* Description - truncated to ~2 lines */}
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs rounded-full bg-muted text-foreground">
            {getStatusLabel(task.status)}
          </Badge>

          {/* Claude Status Badge - only shown when Claude is active */}
          {task.claudeStatus && task.claudeStatus !== 'IDLE' && (
            <ClaudeStatusBadge
              status={task.claudeStatus}
              terminalId={task.claudeTerminalId ?? undefined}
            />
          )}
        </div>

        {/* Live Output Preview - shown when Claude is running or starting */}
        {/* Use predictable terminal ID (claude-${taskId}) when starting to avoid race condition */}
        {isClaudeRunning && (
          <TaskOutputPreview
            terminalId={task.claudeTerminalId || `claude-${task.id}`}
            claudeStatus={task.claudeStatus}
          />
        )}

        {/* AI Review Progress Preview - shown when task is in AI_REVIEW status */}
        {task.status === 'AI_REVIEW' && (
          <ReviewOutputPreview taskId={task.id} />
        )}

        {/* Bottom Row: Time, Start Button, Menu */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Clock Icon + Relative Time */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">
              {getTimeAgo(task.updatedAt)}
            </span>
          </div>

          {/* Right Side: Terminal Button + Start Button + Menu */}
          <div className="flex items-center gap-1">
            {/* Terminal Button - only show when Claude is running */}
            {isClaudeRunning && onViewTerminal && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleViewTerminal}
                aria-label="View terminal output"
              >
                <Terminal className="h-4 w-4 text-green-600 dark:text-green-400" />
              </Button>
            )}

            {/* Claude Code Start Button - shows Start/Pause/Resume based on status */}
            <TaskCardStartButton
              task={task}
              refetchTasks={refetchTasks}
            />

            {/* AI Review Button - shows when task work is complete */}
            <TaskCardReviewButton
              task={task}
              refetchTasks={refetchTasks}
            />

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => { e.stopPropagation(); }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Task actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => { e.stopPropagation(); }}>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

/**
 * Memoized TaskCard component to prevent unnecessary re-renders.
 * Only re-renders when task data or callback functions change.
 */
export const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better control over re-renders
  // Return true if props are equal (should NOT re-render)
  // Return false if props are different (should re-render)

  // Always check task changes first (most common reason to re-render)
  if (
    prevProps.task.id !== nextProps.task.id ||
    prevProps.task.status !== nextProps.task.status ||
    prevProps.task.claudeStatus !== nextProps.task.claudeStatus ||
    prevProps.task.title !== nextProps.task.title ||
    prevProps.task.description !== nextProps.task.description ||
    prevProps.task.updatedAt !== nextProps.task.updatedAt ||
    prevProps.task.prdPhaseNumber !== nextProps.task.prdPhaseNumber ||
    prevProps.task.prdPhaseName !== nextProps.task.prdPhaseName
  ) {
    return false;
  }

  // Check dragging state
  if (prevProps.isDragging !== nextProps.isDragging) {
    return false;
  }

  // Callback reference changes don't matter for rendering
  // since we use useCallback internally

  return true;
});
