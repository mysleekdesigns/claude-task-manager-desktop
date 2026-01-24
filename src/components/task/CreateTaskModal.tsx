/**
 * CreateTaskModal Component
 *
 * Modal for creating a new task with form validation.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';
import * as v from 'valibot';
import type { Task, Priority, TaskStatus, CreateTaskInput } from '@/types/ipc';

interface CreateTaskModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (task: Task) => void;
  initialStatus?: TaskStatus;
}

// Form validation schema
const createTaskSchema = v.object({
  title: v.pipe(v.string(), v.minLength(2, 'Title must be at least 2 characters'), v.maxLength(200)),
  description: v.optional(v.string()),
  priority: v.picklist(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  tags: v.array(v.string()),
  branchName: v.optional(v.string()),
});

type CreateTaskFormData = v.InferOutput<typeof createTaskSchema>;

export function CreateTaskModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
  initialStatus = 'PLANNING',
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [branchName, setBranchName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate: createTask, loading } = useIPCMutation('tasks:create');
  const { mutate: updateTaskStatus } = useIPCMutation('tasks:updateStatus');

  const validateForm = (): boolean => {
    try {
      const formData: CreateTaskFormData = {
        title,
        description: description || undefined,
        priority,
        tags,
        branchName: branchName || undefined,
      };

      v.parse(createTaskSchema, formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof v.ValiError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path?.[0]?.key) {
            newErrors[err.path[0].key.toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const taskData: CreateTaskInput = {
        title: title.trim(),
        projectId,
        priority,
        tags,
      };

      if (description.trim()) {
        taskData.description = description.trim();
      }

      if (branchName.trim()) {
        taskData.branchName = branchName.trim();
      }

      let newTask = await createTask(taskData);

      // If initialStatus is different from default, update it
      if (initialStatus !== 'PLANNING') {
        newTask = await updateTaskStatus(newTask.id, initialStatus);
      }

      toast.success('Task created successfully');

      // Reset form
      handleReset();

      // Call success callback
      if (onCreated) {
        onCreated(newTask);
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setBranchName('');
    setTags([]);
    setTagInput('');
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onClose();
  };

  const handleTagAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
        setTagInput('');
      }
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const getPriorityVariant = (p: Priority) => {
    switch (p) {
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your project. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors['title']) {
                    setErrors((prev) => ({ ...prev, title: '' }));
                  }
                }}
                className={errors['title'] ? 'border-destructive' : ''}
                disabled={loading}
                autoFocus
              />
              {errors['title'] && (
                <p className="text-sm text-destructive">{errors['title']}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the task..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                disabled={loading}
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => { setPriority(value as Priority); }}
                disabled={loading}
              >
                <SelectTrigger id="priority">
                  <SelectValue>
                    <Badge variant={getPriorityVariant(priority)}>
                      {priority}
                    </Badge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">
                    <Badge variant="outline">LOW</Badge>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <Badge variant="secondary">MEDIUM</Badge>
                  </SelectItem>
                  <SelectItem value="HIGH">
                    <Badge variant="default">HIGH</Badge>
                  </SelectItem>
                  <SelectItem value="URGENT">
                    <Badge variant="destructive">URGENT</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => { handleTagRemove(tag); }}
                      disabled={loading}
                      className="hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="tags"
                placeholder="Type a tag and press Enter..."
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); }}
                onKeyDown={handleTagAdd}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Press Enter to add a tag
              </p>
            </div>

            {/* Branch Name */}
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch Name (Optional)</Label>
              <Input
                id="branchName"
                placeholder="e.g., feature/new-feature"
                value={branchName}
                onChange={(e) => { setBranchName(e.target.value); }}
                disabled={loading}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { handleOpenChange(false); }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
