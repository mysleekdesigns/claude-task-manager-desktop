/**
 * Task Terminal Panel Component
 *
 * A slide-out panel that displays the terminal output for a running Claude Code task.
 * Shows real-time output from Claude Code's terminal session.
 */

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { ClaudeStatusBadge } from '@/components/task/ClaudeStatusBadge';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Task } from '@/types/ipc';
import { getClaudeStatusFromTask } from '@/hooks/useClaudeStatus';

// ============================================================================
// Types
// ============================================================================

interface TaskTerminalPanelProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TaskTerminalPanel({
  task,
  isOpen,
  onClose,
}: TaskTerminalPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get terminal ID from task
  const terminalId = task?.claudeTerminalId ?? null;
  const claudeStatus = getClaudeStatusFromTask(task);

  // Reset expanded state when panel closes using a ref to avoid the lint warning
  // about setState in useEffect. This is fine since we're only setting to false
  // when the panel closes.
  const wasOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      setIsExpanded(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!task) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className={`${
          isExpanded ? 'h-[90vh]' : 'h-[60vh]'
        } transition-all duration-300 flex flex-col p-0`}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <TerminalIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <SheetTitle className="truncate">{task.title}</SheetTitle>
                <SheetDescription className="truncate">
                  {task.description || 'Watching Claude Code terminal output'}
                </SheetDescription>
              </div>
            </div>

            {/* Status and Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Claude Status Badge */}
              <ClaudeStatusBadge
                status={claudeStatus}
                terminalId={terminalId ?? undefined}
              />

              {/* Terminal ID Badge */}
              {terminalId && (
                <Badge variant="outline" className="text-xs font-mono">
                  {terminalId}
                </Badge>
              )}

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setIsExpanded(!isExpanded); }}
                className="h-8 w-8"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Terminal Content */}
        <div className="flex-1 min-h-0 bg-[#1a1b26]">
          {terminalId ? (
            <XTermWrapper
              terminalId={terminalId}
              className="h-full w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <TerminalIcon className="h-12 w-12 mx-auto opacity-50" />
                <p>No active terminal session</p>
                <p className="text-sm">
                  Start Claude Code to see terminal output
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
