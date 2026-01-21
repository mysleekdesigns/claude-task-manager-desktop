/**
 * Add Phase Modal Component
 *
 * Modal for creating a new roadmap phase.
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

// ============================================================================
// Types
// ============================================================================

interface AddPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
  }) => Promise<void>;
  nextOrder: number;
}

// ============================================================================
// Component
// ============================================================================

export function AddPhaseModal({
  isOpen,
  onClose,
  onSubmit,
  nextOrder,
}: AddPhaseModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
      });

      // Reset form
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Failed to create phase:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Phase</DialogTitle>
          <DialogDescription>
            Create a new phase for your project roadmap. This will be Phase {nextOrder}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="phase-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phase-name"
                placeholder="e.g., Foundation, Core Features, Polish"
                value={name}
                onChange={(e) => { setName(e.target.value); }}
                required
                autoFocus
              />
            </div>

            {/* Description Textarea */}
            <div className="space-y-2">
              <Label htmlFor="phase-description">Description</Label>
              <Textarea
                id="phase-description"
                placeholder="Describe what this phase will accomplish..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                rows={4}
              />
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
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Phase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
