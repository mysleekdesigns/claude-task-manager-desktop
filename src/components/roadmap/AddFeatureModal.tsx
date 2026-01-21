/**
 * Add Feature Modal Component
 *
 * Modal for creating a new feature with MoSCoW priority.
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
import type { MoscowPriority, Phase } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface AddFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: MoscowPriority;
    phaseId?: string;
  }) => Promise<void>;
  phases: Phase[];
  defaultPhaseId?: string | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function AddFeatureModal({
  isOpen,
  onClose,
  onSubmit,
  phases,
  defaultPhaseId,
}: AddFeatureModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MoscowPriority>('MUST');
  const [phaseId, setPhaseId] = useState<string | undefined>(defaultPhaseId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData: {
        title: string;
        description: string;
        priority: MoscowPriority;
        phaseId?: string;
      } = {
        title: title.trim(),
        description: description.trim(),
        priority,
      };
      if (phaseId !== undefined) {
        submitData.phaseId = phaseId;
      }
      await onSubmit(submitData);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('MUST');
      setPhaseId(defaultPhaseId);
      onClose();
    } catch (error) {
      console.error('Failed to create feature:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setTitle('');
    setDescription('');
    setPriority('MUST');
    setPhaseId(defaultPhaseId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Feature</DialogTitle>
          <DialogDescription>
            Create a new feature with MoSCoW prioritization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="space-y-4 py-4">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="feature-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="feature-title"
                placeholder="Enter feature title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); }}
                required
                autoFocus
              />
            </div>

            {/* Description Textarea */}
            <div className="space-y-2">
              <Label htmlFor="feature-description">Description</Label>
              <Textarea
                id="feature-description"
                placeholder="Describe the feature..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                rows={4}
              />
            </div>

            {/* Priority Selector */}
            <div className="space-y-2">
              <Label htmlFor="feature-priority">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select
                value={priority}
                onValueChange={(value) => { setPriority(value as MoscowPriority); }}
              >
                <SelectTrigger id="feature-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MUST">Must Have</SelectItem>
                  <SelectItem value="SHOULD">Should Have</SelectItem>
                  <SelectItem value="COULD">Could Have</SelectItem>
                  <SelectItem value="WONT">Won&apos;t Have</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {priority === 'MUST' && 'Critical features required for the release'}
                {priority === 'SHOULD' && 'Important but not vital features'}
                {priority === 'COULD' && 'Desirable but not necessary features'}
                {priority === 'WONT' && 'Features that will not be included'}
              </p>
            </div>

            {/* Phase Selector */}
            <div className="space-y-2">
              <Label htmlFor="feature-phase">Phase (Optional)</Label>
              <Select
                value={phaseId || 'none'}
                onValueChange={(value) => { setPhaseId(value === 'none' ? undefined : value); }}
              >
                <SelectTrigger id="feature-phase">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.order}: {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {isSubmitting ? 'Creating...' : 'Create Feature'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
