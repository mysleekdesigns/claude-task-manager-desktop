/**
 * Edit Memory Modal Component
 *
 * Modal dialog for editing existing memories with type selection, title, content,
 * task linking, and archive toggle.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Memory, MemoryType, Task, UpdateMemoryInput } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface EditMemoryModalProps {
  memory: Memory;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: UpdateMemoryInput) => Promise<void>;
  tasks?: Task[];
}

// ============================================================================
// Memory Type Configuration
// ============================================================================

const MEMORY_TYPES: {
  value: MemoryType;
  label: string;
  description: string;
}[] = [
  {
    value: 'context',
    label: 'Context',
    description: 'Project setup and CLAUDE.md rules',
  },
  {
    value: 'decision',
    label: 'Decision',
    description: 'Why something was built a certain way',
  },
  {
    value: 'pattern',
    label: 'Pattern',
    description: 'Reusable code or workflow patterns',
  },
  {
    value: 'gotcha',
    label: 'Gotcha',
    description: 'Pitfalls, bugs, and workarounds',
  },
  {
    value: 'session',
    label: 'Session',
    description: 'Session summaries and learnings',
  },
  {
    value: 'task',
    label: 'Task',
    description: 'Task completion insights',
  },
  {
    value: 'pr_review',
    label: 'PR Review',
    description: 'Pull request review insights',
  },
  {
    value: 'codebase',
    label: 'Codebase',
    description: 'Architecture and structure documentation',
  },
];

// ============================================================================
// Component
// ============================================================================

export function EditMemoryModal({
  memory,
  isOpen,
  onClose,
  onSave,
  tasks = [],
}: EditMemoryModalProps) {
  const [type, setType] = useState<MemoryType>(memory.type);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [taskId, setTaskId] = useState<string | null>(memory.taskId);
  const [isArchived, setIsArchived] = useState(memory.isArchived);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when memory changes
  useEffect(() => {
    setType(memory.type);
    setTitle(memory.title);
    setContent(memory.content);
    setTaskId(memory.taskId);
    setIsArchived(memory.isArchived);
  }, [memory]);

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim() || !content.trim()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const updateData: UpdateMemoryInput = {
          type,
          title: title.trim(),
          content: content.trim(),
          taskId,
          isArchived,
        };

        await onSave(memory.id, updateData);
        onClose();
      } catch (err) {
        console.error('Failed to update memory:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [type, title, content, taskId, isArchived, memory.id, onSave, onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      // Reset to original values
      setType(memory.type);
      setTitle(memory.title);
      setContent(memory.content);
      setTaskId(memory.taskId);
      setIsArchived(memory.isArchived);
      onClose();
    }
  }, [isSubmitting, memory, onClose]);

  // Handle task change
  const handleTaskChange = useCallback((value: string) => {
    setTaskId(value === 'none' ? null : value);
  }, []);

  const selectedTypeInfo = MEMORY_TYPES.find((t) => t.value === type);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Memory</DialogTitle>
          <DialogDescription>
            Update the memory content, type, or link it to a task.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {/* Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value) => { setType(value as MemoryType); }}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map((memType) => (
                  <SelectItem key={memType.value} value={memType.value}>
                    {memType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeInfo && (
              <p className="text-xs text-muted-foreground">
                {selectedTypeInfo.description}
              </p>
            )}
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter a descriptive title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); }}
              required
            />
          </div>

          {/* Content Textarea */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Enter the memory content..."
              value={content}
              onChange={(e) => { setContent(e.target.value); }}
              rows={8}
              required
            />
          </div>

          {/* Task Link Selector */}
          <div className="space-y-2">
            <Label htmlFor="task">Link to Task (Optional)</Label>
            <Select value={taskId ?? 'none'} onValueChange={handleTaskChange}>
              <SelectTrigger id="task">
                <SelectValue placeholder="Select a task to link..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task linked</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Link this memory to a specific task for better organization
            </p>
          </div>

          {/* Archive Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="archived" className="text-base">
                Archived
              </Label>
              <p className="text-sm text-muted-foreground">
                Archived memories are hidden by default but not deleted
              </p>
            </div>
            <Switch
              id="archived"
              checked={isArchived}
              onCheckedChange={setIsArchived}
            />
          </div>

          {/* Source Info (read-only) */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">Source:</span>{' '}
              <span className="text-muted-foreground">
                {memory.source === 'manual' && 'Manually created'}
                {memory.source === 'auto_session' && 'Auto-captured from session'}
                {memory.source === 'auto_commit' && 'Auto-captured from commit'}
              </span>
            </p>
            <p className="text-sm mt-1">
              <span className="font-medium">Created:</span>{' '}
              <span className="text-muted-foreground">
                {new Date(memory.createdAt).toLocaleString()}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !title.trim() ||
                !content.trim()
              }
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
