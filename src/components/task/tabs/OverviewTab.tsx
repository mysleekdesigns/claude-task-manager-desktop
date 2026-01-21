/**
 * OverviewTab Component
 *
 * Displays and allows editing of task overview details (description, assignee, priority, tags).
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { X } from 'lucide-react';
import type { Task, Priority } from '@/types/ipc';

interface OverviewTabProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  isUpdating: boolean;
}

export function OverviewTab({ task, onUpdate, isUpdating }: OverviewTabProps) {
  const [description, setDescription] = useState(task.description || '');
  const [tagInput, setTagInput] = useState('');

  const handleDescriptionBlur = () => {
    if (description !== task.description) {
      onUpdate({ description });
    }
  };

  const handlePriorityChange = (priority: Priority) => {
    onUpdate({ priority });
  };

  const handleTagAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...(task.tags || []), tagInput.trim()];
      onUpdate({ tags: newTags });
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    const newTags = (task.tags || []).filter((tag) => tag !== tagToRemove);
    onUpdate({ tags: newTags });
  };

  const getPriorityVariant = (priority: Priority) => {
    switch (priority) {
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
    <div className="space-y-6 p-4">
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Add a description for this task..."
          value={description}
          onChange={(e) => { setDescription(e.target.value); }}
          onBlur={handleDescriptionBlur}
          disabled={isUpdating}
          rows={6}
          className="resize-none"
        />
      </div>

      {/* Assignee */}
      <div className="space-y-2">
        <Label>Assignee</Label>
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <>
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {task.assignee.name?.[0]?.toUpperCase() ||
                   task.assignee.email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {task.assignee.name || task.assignee.email}
                </p>
                {task.assignee.name && (
                  <p className="text-xs text-muted-foreground">
                    {task.assignee.email}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No assignee</p>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={task.priority}
          onValueChange={handlePriorityChange}
          disabled={isUpdating}
        >
          <SelectTrigger id="priority" className="w-full">
            <SelectValue>
              <Badge variant={getPriorityVariant(task.priority)}>
                {task.priority}
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
          {task.tags && task.tags.length > 0 ? (
            task.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => { handleTagRemove(tag); }}
                  disabled={isUpdating}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No tags</p>
          )}
        </div>
        <Input
          id="tags"
          placeholder="Type a tag and press Enter..."
          value={tagInput}
          onChange={(e) => { setTagInput(e.target.value); }}
          onKeyDown={handleTagAdd}
          disabled={isUpdating}
        />
        <p className="text-xs text-muted-foreground">
          Press Enter to add a tag
        </p>
      </div>
    </div>
  );
}
