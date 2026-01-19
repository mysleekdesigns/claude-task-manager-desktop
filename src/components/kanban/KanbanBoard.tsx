/**
 * Kanban Board Component
 *
 * Main Kanban board with drag-and-drop functionality for task management.
 * Uses @dnd-kit/core for the drag-and-drop context.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const COLUMNS: { id: TaskStatus; title: string; collapsible?: boolean }[] = [
  { id: 'PLANNING', title: 'Planning' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'AI_REVIEW', title: 'AI Review' },
  { id: 'HUMAN_REVIEW', title: 'Human Review' },
  { id: 'COMPLETED', title: 'Completed', collapsible: true },
];

// ============================================================================
// Types
// ============================================================================

interface KanbanBoardProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  loading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function KanbanBoard({
  tasks,
  onTaskStatusChange,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  loading = false,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      PENDING: [],
      PLANNING: [],
      IN_PROGRESS: [],
      AI_REVIEW: [],
      HUMAN_REVIEW: [],
      COMPLETED: [],
      CANCELLED: [],
    };

    tasks.forEach((task) => {
      const status = task.status as TaskStatus;
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task || null);
    },
    [tasks]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Determine if dropped on a column or another task
      const overColumn = COLUMNS.find((col) => col.id === overId);
      const overTask = tasks.find((t) => t.id === overId);

      let newStatus: TaskStatus | undefined;

      if (overColumn) {
        // Dropped directly on a column
        newStatus = overColumn.id;
      } else if (overTask) {
        // Dropped on another task - use that task's status
        newStatus = overTask.status;
      }

      const draggedTask = tasks.find((t) => t.id === taskId);

      // Only update if status changed
      if (newStatus && draggedTask && newStatus !== draggedTask.status) {
        try {
          await onTaskStatusChange(taskId, newStatus);
        } catch (error) {
          console.error('Failed to update task status:', error);
        }
      }
    },
    [tasks, onTaskStatusChange]
  );

  // Handle drag over (optional - for visual feedback during drag)
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could implement reordering within columns here if needed
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByStatus[column.id] || []}
            onTaskClick={onTaskClick || undefined}
            onTaskEdit={onTaskEdit || undefined}
            onTaskDelete={onTaskDelete || undefined}
            onTaskStatusChange={onTaskStatusChange}
            onAddTask={onAddTask || undefined}
            collapsible={column.collapsible || false}
          />
        ))}
      </div>

      {/* Drag Overlay - shows the dragged item */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 cursor-grabbing">
            <TaskCard task={activeTask} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
