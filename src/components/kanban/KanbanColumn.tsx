/**
 * Kanban Column Component
 *
 * Droppable column for the Kanban board that contains task cards.
 * Uses @dnd-kit/sortable for drop functionality.
 * Memoized to prevent unnecessary re-renders.
 */

import { memo, useCallback, useMemo, useState } from 'react';
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
  onViewTerminal?: ((task: Task) => void) | undefined;
  onAddTask?: ((status: TaskStatus) => void) | undefined;
  refetchTasks?: (() => Promise<void>) | undefined;
  collapsible?: boolean | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Get column color based on status - extracted to prevent recreation
const getColumnAccent = (status: TaskStatus): string => {
  switch (status) {
    case 'PLANNING':
      return 'border-cyan-500';
    case 'IN_PROGRESS':
      return 'border-cyan-500';
    case 'AI_REVIEW':
      return 'border-cyan-500';
    case 'HUMAN_REVIEW':
      return 'border-cyan-500';
    case 'COMPLETED':
      return 'border-cyan-500';
    default:
      return 'border-cyan-500';
  }
};

// ============================================================================
// Component
// ============================================================================

function KanbanColumnComponent({
  id,
  title,
  tasks,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onViewTerminal,
  onAddTask,
  refetchTasks,
  collapsible = false,
}: KanbanColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id });

  // Memoize task IDs to prevent SortableContext from re-rendering unnecessarily
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  // Memoize toggle handler
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Memoize add task handler
  const handleAddTask = useCallback(() => {
    onAddTask?.(id);
  }, [onAddTask, id]);

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
              onClick={handleToggleCollapse}
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
              onClick={handleAddTask}
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
          <ScrollArea className="flex-1 min-w-0 overflow-hidden">
            <div
              ref={setNodeRef}
              className="p-2 space-y-2 min-h-[200px] min-w-0 overflow-hidden"
            >
              <SortableContext
                items={taskIds}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick ? () => { onTaskClick(task); } : undefined}
                    onEdit={onTaskEdit}
                    onDelete={onTaskDelete}
                    onViewTerminal={onViewTerminal}
                    refetchTasks={refetchTasks}
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
                      onClick={handleAddTask}
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
                onClick={handleAddTask}
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

// ============================================================================
// Memoized Export
// ============================================================================

/**
 * Memoized KanbanColumn component.
 * Only re-renders when tasks array reference changes or column props change.
 */
export const KanbanColumn = memo(KanbanColumnComponent, (prevProps, nextProps) => {
  // Check if basic props changed
  if (
    prevProps.id !== nextProps.id ||
    prevProps.title !== nextProps.title ||
    prevProps.collapsible !== nextProps.collapsible
  ) {
    return false;
  }

  // Check if tasks array changed (by reference first, then by content)
  if (prevProps.tasks !== nextProps.tasks) {
    // If array references are different, check if content actually changed
    if (prevProps.tasks.length !== nextProps.tasks.length) {
      return false;
    }

    // Compare task IDs and key properties
    for (let i = 0; i < prevProps.tasks.length; i++) {
      const prevTask = prevProps.tasks[i];
      const nextTask = nextProps.tasks[i];
      // Safety check for undefined
      if (!prevTask || !nextTask) {
        return false;
      }
      if (
        prevTask.id !== nextTask.id ||
        prevTask.status !== nextTask.status ||
        prevTask.claudeStatus !== nextTask.claudeStatus ||
        prevTask.updatedAt !== nextTask.updatedAt
      ) {
        return false;
      }
    }
  }

  // Props are equal, don't re-render
  return true;
});
