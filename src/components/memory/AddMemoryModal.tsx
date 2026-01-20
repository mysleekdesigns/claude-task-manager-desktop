/**
 * Add Memory Modal Component
 *
 * Modal dialog for creating new memories with type selection, title, content, and metadata.
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
import type { MemoryType } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface AddMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: MemoryType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

// ============================================================================
// Memory Type Configuration
// ============================================================================

const MEMORY_TYPES: Array<{
  value: MemoryType;
  label: string;
  description: string;
}> = [
  {
    value: 'session',
    label: 'Session',
    description: 'Claude Code terminal session notes',
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
  {
    value: 'pattern',
    label: 'Pattern',
    description: 'Code patterns and best practices',
  },
  {
    value: 'gotcha',
    label: 'Gotcha',
    description: 'Common pitfalls and issues',
  },
];

// ============================================================================
// Component
// ============================================================================

export function AddMemoryModal({ isOpen, onClose, onSubmit }: AddMemoryModalProps) {
  const [type, setType] = useState<MemoryType>('session');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metadataJson, setMetadataJson] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate metadata JSON
  const validateMetadata = useCallback((jsonString: string): boolean => {
    if (!jsonString.trim()) {
      setMetadataError('');
      return true;
    }

    try {
      JSON.parse(jsonString);
      setMetadataError('');
      return true;
    } catch (err) {
      setMetadataError('Invalid JSON format');
      return false;
    }
  }, []);

  // Handle metadata change
  const handleMetadataChange = useCallback(
    (value: string) => {
      setMetadataJson(value);
      validateMetadata(value);
    },
    [validateMetadata]
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim() || !content.trim()) {
        return;
      }

      if (!validateMetadata(metadataJson)) {
        return;
      }

      setIsSubmitting(true);

      try {
        const metadata = metadataJson.trim()
          ? JSON.parse(metadataJson)
          : undefined;

        await onSubmit({
          type,
          title: title.trim(),
          content: content.trim(),
          metadata,
        });

        // Reset form
        setType('session');
        setTitle('');
        setContent('');
        setMetadataJson('');
        setMetadataError('');
        onClose();
      } catch (err) {
        console.error('Failed to create memory:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [type, title, content, metadataJson, validateMetadata, onSubmit, onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setType('session');
      setTitle('');
      setContent('');
      setMetadataJson('');
      setMetadataError('');
      onClose();
    }
  }, [isSubmitting, onClose]);

  const selectedTypeInfo = MEMORY_TYPES.find((t) => t.value === type);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Memory</DialogTitle>
          <DialogDescription>
            Store important context, insights, and knowledge about your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as MemoryType)}>
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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
            />
          </div>

          {/* Optional Metadata JSON */}
          <div className="space-y-2">
            <Label htmlFor="metadata">Metadata (Optional JSON)</Label>
            <Textarea
              id="metadata"
              placeholder='{"key": "value", "tags": ["tag1", "tag2"]}'
              value={metadataJson}
              onChange={(e) => handleMetadataChange(e.target.value)}
              rows={3}
              className={metadataError ? 'border-destructive' : ''}
            />
            {metadataError && (
              <p className="text-xs text-destructive">{metadataError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Optional JSON object for additional context
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
                !content.trim() ||
                !!metadataError
              }
            >
              {isSubmitting ? 'Creating...' : 'Create Memory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
