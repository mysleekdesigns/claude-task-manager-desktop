/**
 * TaskModal Component
 *
 * Modal for viewing and editing task details with tabbed interface.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Edit2, Check } from 'lucide-react';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';

import { OverviewTab } from './tabs/OverviewTab';
import { SubtasksTab } from './tabs/SubtasksTab';
import { LogsTab } from './tabs/LogsTab';
import { FilesTab } from './tabs/FilesTab';
import { ClaudeTab } from './tabs/ClaudeTab';

import type { Task, TaskStatus } from '@/types/ipc';

interface TaskModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => void;
}

export function TaskModal({ taskId, isOpen, onClose, onUpdate }: TaskModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');

  // Fetch full task data
  const {
    data: task,
    loading,
    refetch,
  } = useIPCQuery('tasks:get', [taskId], {
    enabled: isOpen && !!taskId,
  });

  // Update task mutation
  const { mutate: updateTask, loading: updating } = useIPCMutation('tasks:update');

  // Update title when task loads
  useEffect(() => {
    if (task) {
      setTitle(task.title);
    }
  }, [task]);

  const handleUpdateTask = async (updates: Partial<Task>) => {
    try {
      // Filter out null values and convert to UpdateTaskInput
      const updateData: Record<string, unknown> = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          updateData[key] = value;
        }
      });

      const updatedTask = await updateTask(taskId, updateData);
      toast.success('Task updated');
      void refetch();
      if (onUpdate) {
        onUpdate(updatedTask);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    }
  };

  const handleTitleSave = () => {
    if (!title.trim()) {
      toast.error('Task title cannot be empty');
      setTitle(task?.title || '');
      setIsEditingTitle(false);
      return;
    }

    if (title !== task?.title) {
      void handleUpdateTask({ title });
    }
    setIsEditingTitle(false);
  };

  const handleStatusChange = (status: TaskStatus) => {
    void handleUpdateTask({ status });
  };

  const getStatusBadge = (status: TaskStatus) => {
    const variants: Record<TaskStatus, string> = {
      PENDING: 'secondary',
      PLANNING: 'outline',
      IN_PROGRESS: 'default',
      AI_REVIEW: 'secondary',
      HUMAN_REVIEW: 'secondary',
      COMPLETED: 'default',
      CANCELLED: 'destructive',
    };

    return (
      <Badge variant={variants[status] as "default" | "secondary" | "outline" | "destructive"}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading || !task) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Loading task...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTitleSave();
                      } else if (e.key === 'Escape') {
                        setTitle(task.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    onBlur={handleTitleSave}
                    disabled={updating}
                    autoFocus
                    className="text-lg font-semibold"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleTitleSave}
                    disabled={updating}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setIsEditingTitle(true); }}
                  className="text-left group w-full"
                >
                  <DialogTitle className="text-xl flex items-center gap-2">
                    {task.title}
                    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </DialogTitle>
                </button>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {task.branchName && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {task.branchName}
                  </Badge>
                )}
                <Select
                  value={task.status}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger className="w-auto h-6 text-xs border-none shadow-none px-0">
                    <SelectValue>{getStatusBadge(task.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{getStatusBadge('PENDING')}</SelectItem>
                    <SelectItem value="PLANNING">{getStatusBadge('PLANNING')}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{getStatusBadge('IN_PROGRESS')}</SelectItem>
                    <SelectItem value="AI_REVIEW">{getStatusBadge('AI_REVIEW')}</SelectItem>
                    <SelectItem value="HUMAN_REVIEW">{getStatusBadge('HUMAN_REVIEW')}</SelectItem>
                    <SelectItem value="COMPLETED">{getStatusBadge('COMPLETED')}</SelectItem>
                    <SelectItem value="CANCELLED">{getStatusBadge('CANCELLED')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subtasks">
              Subtasks
              {task.subtasks && task.subtasks.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {task.subtasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs">
              Logs
              {task.logs && task.logs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {task.logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="files">
              Files
              {task.files && task.files.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {task.files.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="claude" className="gap-1">
              Claude
              {task.claudeStatus && task.claudeStatus === 'RUNNING' && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                task={task}
                onUpdate={handleUpdateTask}
                isUpdating={updating}
              />
            </TabsContent>

            <TabsContent value="subtasks" className="mt-0">
              <SubtasksTab taskId={taskId} projectId={task.projectId} />
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
              <LogsTab task={task} />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <FilesTab task={task} />
            </TabsContent>

            <TabsContent value="claude" className="mt-0">
              <ClaudeTab task={task} onStatusChange={refetch} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
