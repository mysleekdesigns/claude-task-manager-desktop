/**
 * Add Changelog Modal Component
 *
 * Form to create a manual changelog entry.
 */

import { useState, useEffect } from 'react';
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
import type { ChangelogEntryType } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface AddChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    version?: string;
    type: ChangelogEntryType;
  }) => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

export function AddChangelogModal({
  isOpen,
  onClose,
  onSubmit,
}: AddChangelogModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [type, setType] = useState<ChangelogEntryType>('FEATURE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setVersion('');
      setType('FEATURE');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedDescription = description.trim();
      const trimmedVersion = version.trim();

      await onSubmit({
        title: title.trim(),
        ...(trimmedDescription && { description: trimmedDescription }),
        ...(trimmedVersion && { version: trimmedVersion }),
        type,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setVersion('');
      setType('FEATURE');
      onClose();
    } catch (error) {
      console.error('Failed to create changelog entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setTitle('');
    setDescription('');
    setVersion('');
    setType('FEATURE');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Changelog Entry</DialogTitle>
          <DialogDescription>
            Create a new changelog entry for this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="changelog-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="changelog-title"
                placeholder="Enter entry title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Description Textarea */}
            <div className="space-y-2">
              <Label htmlFor="changelog-description">Description</Label>
              <Textarea
                id="changelog-description"
                placeholder="Describe the change..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Type Selector */}
            <div className="space-y-2">
              <Label htmlFor="changelog-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ChangelogEntryType)}
              >
                <SelectTrigger id="changelog-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEATURE">Feature</SelectItem>
                  <SelectItem value="FIX">Bug Fix</SelectItem>
                  <SelectItem value="IMPROVEMENT">Improvement</SelectItem>
                  <SelectItem value="BREAKING">Breaking Change</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {type === 'FEATURE' && 'New features or capabilities'}
                {type === 'FIX' && 'Bug fixes and corrections'}
                {type === 'IMPROVEMENT' && 'Enhancements to existing features'}
                {type === 'BREAKING' && 'Changes that break backward compatibility'}
              </p>
            </div>

            {/* Version Input */}
            <div className="space-y-2">
              <Label htmlFor="changelog-version">Version (Optional)</Label>
              <Input
                id="changelog-version"
                placeholder="e.g., 1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to group by date
              </p>
            </div>
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
              {isSubmitting ? 'Creating...' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
