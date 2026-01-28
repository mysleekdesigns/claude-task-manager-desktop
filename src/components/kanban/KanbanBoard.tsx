/**
 * Kanban Board Component
 *
 * Main Kanban board with drag-and-drop functionality for task management.
 * Uses @dnd-kit/core for the drag-and-drop context.
 * Includes real-time update highlighting and editor indicators.
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
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { AssignReviewerDialog } from './AssignReviewerDialog';
import { useProjectStore } from '@/store/useProjectStore';
import { useIPCMutation } from '@/hooks/useIPC';
import { useTaskRealtimeUpdates } from '@/hooks/useTaskRealtimeUpdates';
import { useAuth } from '@/hooks/useAuth';
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
  onViewTerminal?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  refetchTasks?: () => Promise<void>;
  loading?: boolean;
}

/**
 * Pending drag state for HUMAN_REVIEW assignment
 */
interface PendingReviewDrag {
  taskId: string;
  taskTitle: string;
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
  onViewTerminal,
  onAddTask,
  refetchTasks,
  loading = false,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pendingReviewDrag, setPendingReviewDrag] = useState<PendingReviewDrag | null>(null);
  const [isAssigningReviewer, setIsAssigningReviewer] = useState(false);

  // Get project members from store
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectMembers = useMemo(() => currentProject?.members ?? [], [currentProject?.members]);

  // Get current user for filtering out own updates
  const { user: currentUser } = useAuth();

  // Real-time task updates
  const {
    recentlyChangedTaskIds,
    taskEditors,
    taskUpdateTypes,
    clearRecentChange,
  } = useTaskRealtimeUpdates(currentProject?.id, tasks, currentUser?.id);

  // IPC mutation for assigning reviewer
  const assignReviewerMutation = useIPCMutation('humanReview:assign');

  // IPC mutation for completing human review
  const completeReviewMutation = useIPCMutation('humanReview:complete');

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
      const status = task.status;
      grouped[status].push(task);
    });

    return grouped;
  }, [tasks]);

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task ?? null);
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
        // If dropping on HUMAN_REVIEW, show the reviewer assignment dialog
        if (newStatus === 'HUMAN_REVIEW') {
          setPendingReviewDrag({
            taskId: draggedTask.id,
            taskTitle: draggedTask.title,
          });
          return;
        }

        // If moving from HUMAN_REVIEW to COMPLETED, complete the human review
        if (draggedTask.status === 'HUMAN_REVIEW' && newStatus === 'COMPLETED') {
          try {
            // First complete the human review record
            await completeReviewMutation.mutate({ taskId });

            // The humanReview:complete handler already updates task status to COMPLETED
            // so we just need to refetch tasks to update the UI
            toast.success('Human review completed');

            if (refetchTasks) {
              await refetchTasks();
            }
          } catch (error) {
            console.error('Failed to complete human review:', error);
            toast.error(
              error instanceof Error ? error.message : 'Failed to complete review'
            );
          }
          return;
        }

        try {
          await onTaskStatusChange(taskId, newStatus);
        } catch (error) {
          console.error('Failed to update task status:', error);
        }
      }
    },
    [tasks, onTaskStatusChange, completeReviewMutation, refetchTasks]
  );

  /**
   * Handle reviewer assignment from dialog
   */
  const handleAssignReviewer = useCallback(
    async (reviewerId: string | null) => {
      if (!pendingReviewDrag) return;

      setIsAssigningReviewer(true);

      try {
        // First update the task status to HUMAN_REVIEW
        await onTaskStatusChange(pendingReviewDrag.taskId, 'HUMAN_REVIEW');

        // Then assign the reviewer (creates or updates HumanReview record)
        await assignReviewerMutation.mutate({ taskId: pendingReviewDrag.taskId, reviewerId });

        if (reviewerId) {
          const reviewer = projectMembers.find((m) => m.user?.id === reviewerId);
          const reviewerName = reviewer?.user?.name ?? reviewer?.user?.email ?? 'reviewer';
          toast.success(`Task assigned to ${reviewerName} for review`);
        } else {
          toast.success('Task moved to Human Review (unassigned)');
        }

        // Refetch tasks to update the UI
        if (refetchTasks) {
          await refetchTasks();
        }
      } catch (error) {
        console.error('Failed to assign reviewer:', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to assign reviewer'
        );
      } finally {
        setIsAssigningReviewer(false);
        setPendingReviewDrag(null);
      }
    },
    [pendingReviewDrag, onTaskStatusChange, assignReviewerMutation, projectMembers, refetchTasks]
  );

  /**
   * Handle dialog close without assignment
   */
  const handleReviewDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingReviewDrag(null);
    }
  }, []);

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
      onDragEnd={(event) => { void handleDragEnd(event); }}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 h-full w-full overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByStatus[column.id]}
            onTaskClick={onTaskClick}
            onTaskEdit={onTaskEdit}
            onTaskDelete={onTaskDelete}
            onViewTerminal={onViewTerminal}
            onAddTask={onAddTask}
            refetchTasks={refetchTasks}
            collapsible={column.collapsible ?? false}
            recentlyChangedTaskIds={recentlyChangedTaskIds}
            taskEditors={taskEditors}
            taskUpdateTypes={taskUpdateTypes}
            onClearRecentChange={clearRecentChange}
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

      {/* Assign Reviewer Dialog */}
      <AssignReviewerDialog
        open={pendingReviewDrag !== null}
        onOpenChange={handleReviewDialogOpenChange}
        members={projectMembers}
        taskTitle={pendingReviewDrag?.taskTitle ?? ''}
        onAssign={handleAssignReviewer}
        isLoading={isAssigningReviewer}
      />
    </DndContext>
  );
}
