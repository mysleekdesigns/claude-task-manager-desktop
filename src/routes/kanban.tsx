/**
 * Kanban Page
 *
 * Main page for the Kanban board view of tasks.
 */

import { useCallback, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskManager } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { TaskModal } from '@/components/task/TaskModal';
import { CreateTaskModal } from '@/components/task/CreateTaskModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/ipc';

export function KanbanPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState<TaskStatus>('PLANNING');

  // Fetch tasks for the current project
  const {
    tasks,
    loading,
    error,
    updateTaskStatus,
    deleteTask,
    refetch,
  } = useTaskManager(currentProject?.id || '', {});

  // Handle task status change via drag-and-drop
  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      try {
        await updateTaskStatus.mutate(taskId, newStatus);
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    },
    [updateTaskStatus]
  );

  // Handle task click (open detail view)
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
  }, []);

  // Handle task edit
  const handleTaskEdit = useCallback((task: Task) => {
    // TODO: Open task edit modal
    console.log('Edit task:', task);
  }, []);

  // Handle task delete
  const handleTaskDelete = useCallback(
    async (task: Task) => {
      if (
        window.confirm(
          `Are you sure you want to delete "${task.title}"? This action cannot be undone.`
        )
      ) {
        try {
          await deleteTask.mutate(task.id);
        } catch (err) {
          console.error('Failed to delete task:', err);
        }
      }
    },
    [deleteTask]
  );

  // Handle add task
  const handleAddTask = useCallback((status: TaskStatus) => {
    setInitialStatus(status);
    setIsCreateModalOpen(true);
  }, []);

  // Handle task created
  const handleTaskCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle task updated
  const handleTaskUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle close TaskModal
  const handleCloseTaskModal = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Handle close CreateTaskModal
  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Kanban Board</h1>
          <p className="text-muted-foreground mt-2">
            Manage your tasks with drag-and-drop workflow
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its tasks.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kanban Board</h1>
            <p className="text-muted-foreground mt-2">
              {currentProject.name} - Manage your tasks with drag-and-drop workflow
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 px-8 pt-4 overflow-hidden">
        <KanbanBoard
          tasks={tasks}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskClick={handleTaskClick}
          onTaskEdit={handleTaskEdit}
          onTaskDelete={handleTaskDelete}
          onAddTask={handleAddTask}
          loading={loading}
        />
      </div>

      {/* Modals */}
      {selectedTaskId && (
        <TaskModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={handleCloseTaskModal}
          onUpdate={handleTaskUpdated}
        />
      )}

      {currentProject && (
        <CreateTaskModal
          projectId={currentProject.id}
          isOpen={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          onCreated={handleTaskCreated}
          initialStatus={initialStatus}
        />
      )}
    </div>
  );
}
