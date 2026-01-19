/**
 * Kanban Column Component
 *
 * Droppable column for the Kanban board that contains task cards.
 * Uses @dnd-kit/sortable for drop functionality.
 */

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from './TaskCard';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/ipc';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick?: ((task: Task) => void) | undefined;
  onTaskEdit?: ((task: Task) => void) | undefined;
  onTaskDelete?: ((task: Task) => void) | undefined;
  onAddTask?: ((status: TaskStatus) => void) | undefined;
  collapsible?: boolean | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function KanbanColumn({
  id,
  title,
  tasks,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  collapsible = false,
}: KanbanColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id });

  const taskIds = tasks.map((t) => t.id);

  // Get column color based on status
  const getColumnAccent = (status: TaskStatus): string => {
    switch (status) {
      case 'PLANNING':
        return 'border-blue-500/50';
      case 'IN_PROGRESS':
        return 'border-yellow-500/50';
      case 'AI_REVIEW':
        return 'border-purple-500/50';
      case 'HUMAN_REVIEW':
        return 'border-orange-500/50';
      case 'COMPLETED':
        return 'border-green-500/50';
      default:
        return 'border-muted';
    }
  };

  return (
    <div
      className={`flex flex-col w-80 flex-shrink-0 bg-muted/30 rounded-lg border-2 transition-colors ${
        isOver ? 'ring-2 ring-primary border-primary' : getColumnAccent(id)
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2 flex-1">
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
          <h3 className="font-semibold text-sm flex-1">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Task Count Badge */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
            {tasks.length}
          </span>

          {/* Add Task Button */}
          {onAddTask && !isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAddTask(id)}
              aria-label="Add task"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Column Content */}
      {!isCollapsed && (
        <>
          <ScrollArea className="flex-1">
            <div
              ref={setNodeRef}
              className="p-2 space-y-2 min-h-[200px]"
            >
              <SortableContext
                items={taskIds}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                    onEdit={onTaskEdit}
                    onDelete={onTaskDelete}
                  />
                ))}
              </SortableContext>

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-muted-foreground text-sm mb-2">
                    No tasks yet
                  </div>
                  {onAddTask && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddTask(id)}
                      className="mt-2"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Column Footer - Add Task Button */}
          {onAddTask && tasks.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddTask(id)}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>
          )}
        </>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="p-4 text-center">
          <span className="text-sm text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      )}
    </div>
  );
}
