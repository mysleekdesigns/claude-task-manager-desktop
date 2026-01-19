/**
 * SubtasksTab Component
 *
 * Displays and manages subtasks for a parent task.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import { toast } from 'sonner';
import type { Task, Priority } from '@/types/ipc';

interface SubtasksTabProps {
  taskId: string;
  projectId: string;
}

export function SubtasksTab({ taskId, projectId }: SubtasksTabProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Fetch subtasks
  const {
    data: subtasks,
    loading,
    refetch,
  } = useIPCQuery('tasks:getSubtasks', [taskId]);

  // Create subtask mutation
  const { mutate: createSubtask, loading: creating } = useIPCMutation('tasks:create');

  // Toggle subtask completion
  const { mutate: updateTask, loading: toggling } = useIPCMutation('tasks:updateStatus');

  // Delete subtask
  const { mutate: deleteTask, loading: deleting } = useIPCMutation('tasks:delete');

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) {
      toast.error('Subtask title is required');
      return;
    }

    try {
      await createSubtask({
        title: newSubtaskTitle.trim(),
        projectId,
        parentId: taskId,
        priority: 'MEDIUM' as Priority,
      });

      toast.success('Subtask created');
      setNewSubtaskTitle('');
      refetch();
    } catch (error) {
      console.error('Failed to create subtask:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create subtask');
    }
  };

  const handleToggleSubtask = async (subtask: Task) => {
    try {
      const newStatus = subtask.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      await updateTask(subtask.id, newStatus);
      refetch();
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await deleteTask(subtaskId);
      toast.success('Subtask deleted');
      refetch();
    } catch (error) {
      console.error('Failed to delete subtask:', error);
      toast.error('Failed to delete subtask');
    }
  };

  const isAnyActionLoading = creating || toggling || deleting;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading subtasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Add subtask input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateSubtask();
            }
          }}
          disabled={isAnyActionLoading}
        />
        <Button
          onClick={handleCreateSubtask}
          disabled={isAnyActionLoading || !newSubtaskTitle.trim()}
          size="icon"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Subtasks list */}
      {subtasks && subtasks.length > 0 ? (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={subtask.status === 'COMPLETED'}
                onCheckedChange={() => handleToggleSubtask(subtask)}
                disabled={isAnyActionLoading}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    subtask.status === 'COMPLETED'
                      ? 'line-through text-muted-foreground'
                      : ''
                  }`}
                >
                  {subtask.title}
                </p>
                {subtask.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {subtask.description}
                  </p>
                )}
              </div>
              {subtask.priority !== 'MEDIUM' && (
                <Badge
                  variant={
                    subtask.priority === 'URGENT'
                      ? 'destructive'
                      : subtask.priority === 'HIGH'
                      ? 'default'
                      : 'outline'
                  }
                  className="text-xs"
                >
                  {subtask.priority}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteSubtask(subtask.id)}
                disabled={isAnyActionLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No subtasks yet. Add one above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
