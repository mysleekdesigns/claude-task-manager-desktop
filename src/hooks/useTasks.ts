/**
 * React Hook for Task Management
 *
 * Provides hooks for managing tasks with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  TaskStatus,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilters,
} from '@/types/ipc';

// ============================================================================
// Task List Hook
// ============================================================================

/**
 * Hook for fetching tasks for a project
 *
 * @param projectId - The project ID to fetch tasks for
 * @param filters - Optional filters for the task list
 * @returns Query result with tasks data
 *
 * @example
 * ```tsx
 * function TaskList({ projectId }: { projectId: string }) {
 *   const { data: tasks, loading, error, refetch } = useTasks(projectId);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {tasks?.map(task => <TaskItem key={task.id} task={task} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTasks(projectId: string, filters?: TaskListFilters) {
  return useIPCQuery('tasks:list', [projectId, filters] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

// ============================================================================
// Task Mutations
// ============================================================================

/**
 * Hook for creating a new task
 *
 * @returns Mutation with mutate function for creating tasks
 *
 * @example
 * ```tsx
 * function CreateTaskButton({ projectId }: { projectId: string }) {
 *   const { mutate: createTask, loading } = useCreateTask();
 *
 *   const handleCreate = async () => {
 *     await createTask({
 *       title: 'New Task',
 *       projectId,
 *       priority: 'MEDIUM',
 *     });
 *   };
 *
 *   return <button onClick={handleCreate} disabled={loading}>Create</button>;
 * }
 * ```
 */
export function useCreateTask() {
  return useIPCMutation('tasks:create');
}

/**
 * Hook for updating a task
 *
 * @returns Mutation with mutate function for updating tasks
 *
 * @example
 * ```tsx
 * function UpdateTaskButton({ taskId }: { taskId: string }) {
 *   const { mutate: updateTask, loading } = useUpdateTask();
 *
 *   const handleUpdate = async () => {
 *     await updateTask(taskId, { title: 'Updated Title' });
 *   };
 *
 *   return <button onClick={handleUpdate} disabled={loading}>Update</button>;
 * }
 * ```
 */
export function useUpdateTask() {
  return useIPCMutation('tasks:update');
}

/**
 * Hook for updating task status
 *
 * @returns Mutation with mutate function for updating task status
 *
 * @example
 * ```tsx
 * function TaskStatusButton({ taskId }: { taskId: string }) {
 *   const { mutate: updateStatus, loading } = useUpdateTaskStatus();
 *
 *   const handleComplete = async () => {
 *     await updateStatus(taskId, 'COMPLETED');
 *   };
 *
 *   return <button onClick={handleComplete} disabled={loading}>Complete</button>;
 * }
 * ```
 */
export function useUpdateTaskStatus() {
  return useIPCMutation('tasks:updateStatus');
}

/**
 * Hook for deleting a task
 *
 * @returns Mutation with mutate function for deleting tasks
 *
 * @example
 * ```tsx
 * function DeleteTaskButton({ taskId }: { taskId: string }) {
 *   const { mutate: deleteTask, loading } = useDeleteTask();
 *
 *   const handleDelete = async () => {
 *     if (confirm('Are you sure?')) {
 *       await deleteTask(taskId);
 *     }
 *   };
 *
 *   return <button onClick={handleDelete} disabled={loading}>Delete</button>;
 * }
 * ```
 */
export function useDeleteTask() {
  return useIPCMutation('tasks:delete');
}

// ============================================================================
// Combined Task Management Hook
// ============================================================================

/**
 * Combined hook for complete task management
 *
 * @param projectId - The project ID to manage tasks for
 * @param filters - Optional filters for the task list
 * @returns Object with task data and mutation functions
 *
 * @example
 * ```tsx
 * function TaskManager({ projectId }: { projectId: string }) {
 *   const {
 *     tasks,
 *     loading,
 *     error,
 *     createTask,
 *     updateTask,
 *     updateTaskStatus,
 *     deleteTask,
 *     refetch,
 *   } = useTaskManager(projectId);
 *
 *   const handleStatusChange = async (taskId: string, status: TaskStatus) => {
 *     await updateTaskStatus.mutate(taskId, status);
 *     await refetch(); // Refresh task list
 *   };
 *
 *   return <div>{tasks.map(task => <TaskComponent key={task.id} task={task} />)}</div>;
 * }
 * ```
 */
export function useTaskManager(projectId: string, filters?: TaskListFilters) {
  const taskQuery = useTasks(projectId, filters);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const handleCreateTask = useCallback(
    async (data: CreateTaskInput) => {
      const result = await createTask.mutate(data);
      await taskQuery.refetch();
      return result;
    },
    [createTask, taskQuery]
  );

  const handleUpdateTask = useCallback(
    async (id: string, data: UpdateTaskInput) => {
      const result = await updateTask.mutate(id, data);
      await taskQuery.refetch();
      return result;
    },
    [updateTask, taskQuery]
  );

  const handleUpdateTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const result = await updateTaskStatus.mutate(id, status);
      await taskQuery.refetch();
      return result;
    },
    [updateTaskStatus, taskQuery]
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      await deleteTask.mutate(id);
      await taskQuery.refetch();
    },
    [deleteTask, taskQuery]
  );

  return {
    tasks: taskQuery.data || [],
    loading: taskQuery.loading,
    error: taskQuery.error,
    refetch: taskQuery.refetch,
    createTask: {
      mutate: handleCreateTask,
      loading: createTask.loading,
      error: createTask.error,
    },
    updateTask: {
      mutate: handleUpdateTask,
      loading: updateTask.loading,
      error: updateTask.error,
    },
    updateTaskStatus: {
      mutate: handleUpdateTaskStatus,
      loading: updateTaskStatus.loading,
      error: updateTaskStatus.error,
    },
    deleteTask: {
      mutate: handleDeleteTask,
      loading: deleteTask.loading,
      error: deleteTask.error,
    },
  };
}
