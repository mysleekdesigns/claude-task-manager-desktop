/**
 * Task Card Component
 *
 * Individual draggable task card for the Kanban board.
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Task, Priority } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface TaskCardProps {
  task: Task;
  onClick?: (() => void) | undefined;
  onEdit?: ((task: Task) => void) | undefined;
  onDelete?: ((task: Task) => void) | undefined;
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

  // Get priority badge variant
  const getPriorityVariant = (
    priority: Priority
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'URGENT':
        return 'destructive';
      case 'HIGH':
        return 'default';
      case 'MEDIUM':
        return 'secondary';
      case 'LOW':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Calculate phase progress (if phases exist)
  const getPhaseProgress = (): { current: number; total: number; status: string } | null => {
    if (!task.phases || task.phases.length === 0) {
      return null;
    }

    const completedPhases = task.phases.filter(
      (p) => p.status === 'COMPLETED'
    ).length;
    const runningPhase = task.phases.find((p) => p.status === 'RUNNING');

    return {
      current: completedPhases,
      total: task.phases.length,
      status: runningPhase ? runningPhase.name : 'Pending',
    };
  };

  // Format time ago
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return 'Just now';
    }
  };

  const progress = getPhaseProgress();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all ${
        isCurrentlyDragging
          ? 'opacity-50 shadow-lg ring-2 ring-primary'
          : 'hover:shadow-md hover:border-primary/50'
      }`}
    >
      <CardHeader className="p-3 pb-2 space-y-0">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag task"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Task Title and Description */}
          <div className="flex-1 min-w-0" onClick={onClick}>
            <h4 className="font-medium text-sm truncate leading-tight">
              {task.title}
            </h4>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1"
                aria-label="Task actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
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
      </CardHeader>

      <CardContent className="p-3 pt-2 space-y-2" onClick={onClick}>
        {/* Priority and Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getPriorityVariant(task.priority)} className="text-xs">
            {task.priority}
          </Badge>

          {task.tags && task.tags.length > 0 && (
            <>
              {task.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{task.tags.length - 2}
                </span>
              )}
            </>
          )}
        </div>

        {/* Phase Progress Indicator */}
        {progress && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}

        {/* Footer: Assignee and Time */}
        <div className="flex items-center justify-between pt-1">
          {/* Assignee Avatar */}
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                {task.assignee.avatar && (
                  <AvatarImage src={task.assignee.avatar} alt={task.assignee.name || ''} />
                )}
                <AvatarFallback className="text-xs">
                  {task.assignee.name
                    ? task.assignee.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : (task.assignee.email?.[0] || '').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {task.assignee.name || task.assignee.email}
              </span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Unassigned</div>
          )}

          {/* Time Ago */}
          <span className="text-xs text-muted-foreground">
            {getTimeAgo(task.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
