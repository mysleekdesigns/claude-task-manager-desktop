/**
 * AddIdeaModal Component (Phase 13.2)
 *
 * Modal dialog for creating new ideas with title and description.
 */

import { useState, useCallback } from 'react';
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
import * as v from 'valibot';

// ============================================================================
// Types
// ============================================================================

interface AddIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description?: string }) => Promise<void>;
}

// ============================================================================
// Validation Schema
// ============================================================================

const ideaSchema = v.object({
  title: v.pipe(
    v.string(),
    v.minLength(3, 'Title must be at least 3 characters'),
    v.maxLength(200, 'Title must be less than 200 characters')
  ),
  description: v.optional(
    v.pipe(v.string(), v.maxLength(1000, 'Description must be less than 1000 characters'))
  ),
});

// ============================================================================
// Component
// ============================================================================

export function AddIdeaModal({ isOpen, onClose, onSubmit }: AddIdeaModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form
  const validateForm = useCallback((): boolean => {
    try {
      v.parse(ideaSchema, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof v.ValiError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path?.[0]) {
            const key = issue.path[0].key;
            if (typeof key === 'string') {
              newErrors[key] = issue.message;
            }
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  }, [title, description]);

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const trimmedDescription = description.trim();
        await onSubmit({
          title: title.trim(),
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        });

        // Reset form
        setTitle('');
        setDescription('');
        setErrors({});
        onClose();
      } catch (err) {
        console.error('Failed to create idea:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, description, validateForm, onSubmit, onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setTitle('');
      setDescription('');
      setErrors({});
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Idea</DialogTitle>
          <DialogDescription>
            Share your idea with the team. Ideas can be voted on and converted to features.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter a descriptive title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors['title']) {
                  setErrors((prev) => ({ ...prev, title: '' }));
                }
              }}
              className={errors['title'] ? 'border-destructive' : ''}
              disabled={isSubmitting}
              autoFocus
            />
            {errors['title'] && (
              <p className="text-sm text-destructive">{errors['title']}</p>
            )}
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide details about your idea..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors['description']) {
                  setErrors((prev) => ({ ...prev, description: '' }));
                }
              }}
              className={errors['description'] ? 'border-destructive' : ''}
              disabled={isSubmitting}
              rows={6}
            />
            {errors['description'] && (
              <p className="text-sm text-destructive">{errors['description']}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {description.length} / 1000 characters
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
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Idea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
