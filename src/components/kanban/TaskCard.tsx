/**
 * Task Card Component
 *
 * Individual draggable task card for the Kanban board.
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 */

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
import { Clock, Play, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface TaskCardProps {
  task: Task;
  onClick?: (() => void) | undefined;
  onEdit?: ((task: Task) => void) | undefined;
  onDelete?: ((task: Task) => void) | undefined;
  onStatusChange?: ((taskId: string, newStatus: TaskStatus) => Promise<void>) | undefined;
  isDragging?: boolean | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function TaskCard({
  task,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
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

  // Format time ago
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
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  };

  // Get status badge label
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

  // Handle start button click
  const handleStartClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStatusChange && task.status !== 'IN_PROGRESS') {
      try {
        await onStatusChange(task.id, 'IN_PROGRESS');
      } catch (error) {
        console.error('Failed to start task:', error);
      }
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isCurrentlyDragging
          ? 'opacity-50 shadow-lg ring-2 ring-primary'
          : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      {/* Card Content */}
      <CardContent className="p-4 space-y-3 cursor-pointer">
        {/* Title */}
        <h4 className="font-semibold text-base leading-tight">
          {task.title}
        </h4>

        {/* Description - truncated to ~2 lines */}
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Status Badge */}
        <div>
          <Badge variant="secondary" className="text-xs rounded-full bg-muted text-foreground">
            {getStatusLabel(task.status)}
          </Badge>
        </div>

        {/* Bottom Row: Time, Start Button, Menu */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Clock Icon + Relative Time */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">
              {getTimeAgo(task.updatedAt)}
            </span>
          </div>

          {/* Right Side: Start Button + Menu */}
          <div className="flex items-center gap-1">
            {/* Start Button - only show if not already in progress or completed */}
            {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
              <Button
                size="sm"
                onClick={handleStartClick}
                className="h-7 px-3 text-xs gap-1 bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                <Play className="h-3 w-3 fill-current" />
                Start
              </Button>
            )}

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Task actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(task)}
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
