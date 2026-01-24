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
import { Edit2, Check } from 'lucide-react';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';

import { OverviewTab } from './tabs/OverviewTab';
import { LogsTab } from './tabs/LogsTab';
import { ActivityTab } from './tabs/ActivityTab';
import { ReviewProgress } from '@/components/review/ReviewProgress';
import { ReviewResults } from '@/components/review/ReviewResults';
import { useReviewProgress } from '@/hooks/useReview';

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

  // Get review progress for the Reviews tab
  const reviewProgress = useReviewProgress(isOpen && taskId ? taskId : null);

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
        <DialogContent className="max-w-6xl max-h-[85vh] min-h-[500px]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Loading task</DialogTitle>
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Loading task...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] min-h-[500px] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <DialogTitle className="sr-only">{task.title}</DialogTitle>
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
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto p-1">
            <TabsTrigger value="overview" className="px-3 text-sm whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="logs" className="px-3 text-sm whitespace-nowrap">
              Logs
              {task.logs && task.logs.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {task.logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-3 text-sm whitespace-nowrap">Activity</TabsTrigger>
            <TabsTrigger value="reviews" className="px-3 text-sm whitespace-nowrap gap-1.5">
              Reviews
              {reviewProgress && reviewProgress.status === 'in_progress' && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
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

            <TabsContent value="logs" className="mt-0">
              <LogsTab task={task} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityTab taskId={taskId} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-0">
              {reviewProgress ? (
                <div className="space-y-6 p-4">
                  <ReviewProgress progress={reviewProgress} />
                  <ReviewResults taskId={taskId} />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No reviews yet. Reviews will appear here after running the AI review workflow.
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
