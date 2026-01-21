/**
 * Add Custom MCP Server Modal Component
 *
 * Modal dialog for adding custom MCP server configurations.
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
import type { CreateMcpInput } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface AddCustomServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateMcpInput, 'projectId'>) => Promise<void>;
}

// ============================================================================
// Server Type Configuration
// ============================================================================

const SERVER_TYPES: {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'documentation',
    label: 'Documentation',
    description: 'Documentation and reference servers',
  },
  {
    value: 'knowledge',
    label: 'Knowledge Graph',
    description: 'Knowledge base and context servers',
  },
  {
    value: 'integration',
    label: 'Integration',
    description: 'Third-party service integrations',
  },
  {
    value: 'browser',
    label: 'Browser Automation',
    description: 'Browser automation and testing',
  },
  {
    value: 'builtin',
    label: 'Built-in',
    description: 'Core system capabilities',
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Custom server implementation',
  },
];

// ============================================================================
// Component
// ============================================================================

export function AddCustomServerModal({
  isOpen,
  onClose,
  onSubmit,
}: AddCustomServerModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('custom');
  const [configJson, setConfigJson] = useState('');
  const [configError, setConfigError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate configuration JSON
  const validateConfig = useCallback((jsonString: string): boolean => {
    if (!jsonString.trim()) {
      setConfigError('');
      return true;
    }

    try {
      JSON.parse(jsonString);
      setConfigError('');
      return true;
    } catch (err) {
      setConfigError('Invalid JSON format');
      return false;
    }
  }, []);

  // Handle config change
  const handleConfigChange = useCallback(
    (value: string) => {
      setConfigJson(value);
      validateConfig(value);
    },
    [validateConfig]
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim()) {
        return;
      }

      if (!validateConfig(configJson)) {
        return;
      }

      setIsSubmitting(true);

      try {
        const config = configJson.trim()
          ? JSON.parse(configJson)
          : undefined;

        await onSubmit({
          name: name.trim(),
          type,
          config,
        });

        // Reset form
        setName('');
        setType('custom');
        setConfigJson('');
        setConfigError('');
        onClose();
      } catch (err) {
        console.error('Failed to create MCP server:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, type, configJson, validateConfig, onSubmit, onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setName('');
      setType('custom');
      setConfigJson('');
      setConfigError('');
      onClose();
    }
  }, [isSubmitting, onClose]);

  const selectedTypeInfo = SERVER_TYPES.find((t) => t.value === type);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Custom MCP Server</DialogTitle>
          <DialogDescription>
            Configure a custom Model Context Protocol server for your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Server Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter server name (e.g., GitHub, Slack)"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              required
            />
          </div>

          {/* Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="type">Server Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((serverType) => (
                  <SelectItem key={serverType.value} value={serverType.value}>
                    {serverType.label}
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

          {/* Configuration JSON Editor */}
          <div className="space-y-2">
            <Label htmlFor="config">Configuration (Optional JSON)</Label>
            <Textarea
              id="config"
              placeholder={'{\n  "apiKey": "your-api-key",\n  "baseUrl": "https://api.example.com"\n}'}
              value={configJson}
              onChange={(e) => { handleConfigChange(e.target.value); }}
              rows={8}
              className={`font-mono text-sm ${configError ? 'border-destructive' : ''}`}
            />
            {configError && (
              <p className="text-xs text-destructive">{configError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Optional JSON configuration object for the server. Must be valid JSON.
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
                !name.trim() ||
                !!configError
              }
            >
              {isSubmitting ? 'Adding...' : 'Add Server'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
