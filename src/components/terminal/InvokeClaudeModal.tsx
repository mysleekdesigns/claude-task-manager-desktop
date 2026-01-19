/**
 * Invoke Claude Modal Component
 *
 * Modal for broadcasting commands to multiple Claude Code terminal sessions.
 * Allows user to input a command/prompt and select which terminals to send it to.
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Terminal as TerminalIcon, CheckCircle2, XCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface InvokeClaudeModalProps {
  open: boolean;
  onClose: () => void;
  terminals: {
    id: string;
    name: string;
    claudeStatus?: 'inactive' | 'active' | 'waiting';
  }[];
  onInvoke: (terminalIds: string[], command: string) => Promise<void>;
}

interface TerminalExecutionStatus {
  id: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function InvokeClaudeModal({
  open,
  onClose,
  terminals,
  onInvoke,
}: InvokeClaudeModalProps) {
  const [command, setCommand] = useState('');
  const [selectedTerminals, setSelectedTerminals] = useState<Set<string>>(new Set());
  const [isInvoking, setIsInvoking] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<TerminalExecutionStatus[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCommand('');
      // Select all terminals with Claude active by default
      const activeTerminals = terminals
        .filter(t => t.claudeStatus === 'active' || t.claudeStatus === 'waiting')
        .map(t => t.id);
      setSelectedTerminals(new Set(activeTerminals));
      setExecutionStatus([]);
      setIsInvoking(false);
    }
  }, [open, terminals]);

  const handleToggleTerminal = (terminalId: string) => {
    const newSelected = new Set(selectedTerminals);
    if (newSelected.has(terminalId)) {
      newSelected.delete(terminalId);
    } else {
      newSelected.add(terminalId);
    }
    setSelectedTerminals(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = terminals.map(t => t.id);
    setSelectedTerminals(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedTerminals(new Set());
  };

  const handleInvoke = async () => {
    if (!command.trim() || selectedTerminals.size === 0) return;

    setIsInvoking(true);
    const initialStatus: TerminalExecutionStatus[] = Array.from(selectedTerminals).map(id => ({
      id,
      status: 'pending' as const,
    }));
    setExecutionStatus(initialStatus);

    try {
      await onInvoke(Array.from(selectedTerminals), command);

      // Mark all as success
      setExecutionStatus(prev =>
        prev.map(item => ({ ...item, status: 'success' as const }))
      );

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      // Mark all as error
      setExecutionStatus(prev =>
        prev.map(item => ({
          ...item,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      );
    } finally {
      setIsInvoking(false);
    }
  };

  const hasExecutionResults = executionStatus.length > 0;
  const canInvoke = command.trim() && selectedTerminals.size > 0 && !isInvoking;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Invoke Claude All
          </DialogTitle>
          <DialogDescription>
            Send a command or prompt to multiple Claude Code terminal sessions at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Command Input */}
          <div className="space-y-2">
            <Label htmlFor="command">Command / Prompt</Label>
            <Textarea
              id="command"
              placeholder="Enter the command or prompt to send to Claude Code..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isInvoking || hasExecutionResults}
            />
            <p className="text-xs text-muted-foreground">
              This will be sent to Claude Code in each selected terminal.
            </p>
          </div>

          <Separator />

          {/* Terminal Selection */}
          {!hasExecutionResults ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Terminals</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={isInvoking}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    disabled={isInvoking}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[200px] rounded-md border p-3">
                {terminals.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No terminals available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {terminals.map((terminal) => (
                      <div
                        key={terminal.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => handleToggleTerminal(terminal.id)}
                      >
                        <Checkbox
                          id={`terminal-${terminal.id}`}
                          checked={selectedTerminals.has(terminal.id)}
                          onCheckedChange={() => handleToggleTerminal(terminal.id)}
                          disabled={isInvoking}
                        />
                        <div className="flex-1 flex items-center gap-2">
                          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{terminal.name}</span>
                          {terminal.claudeStatus && terminal.claudeStatus !== 'inactive' && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Sparkles className="h-3 w-3" />
                              {terminal.claudeStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {selectedTerminals.size} terminal{selectedTerminals.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          ) : (
            /* Execution Status */
            <div className="space-y-3">
              <Label>Execution Status</Label>
              <ScrollArea className="h-[200px] rounded-md border p-3">
                <div className="space-y-2">
                  {executionStatus.map((status) => {
                    const terminal = terminals.find(t => t.id === status.id);
                    return (
                      <div
                        key={status.id}
                        className="flex items-center space-x-3 p-2 rounded"
                      >
                        <div className="flex-shrink-0">
                          {status.status === 'pending' && (
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          )}
                          {status.status === 'success' && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {status.status === 'error' && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TerminalIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{terminal?.name || 'Unknown'}</span>
                          </div>
                          {status.error && (
                            <p className="text-xs text-destructive mt-1">{status.error}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInvoking}>
            {hasExecutionResults ? 'Close' : 'Cancel'}
          </Button>
          {!hasExecutionResults && (
            <Button onClick={handleInvoke} disabled={!canInvoke}>
              {isInvoking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Invoking...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Invoke All ({selectedTerminals.size})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
