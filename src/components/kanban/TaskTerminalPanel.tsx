/**
 * Task Terminal Panel Component
 *
 * A slide-out panel that displays Claude Code task progress.
 * Shows a simple status line at top with terminal output below.
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
import { Button } from '@/components/ui/button';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { ClaudeStatusDisplay } from '@/components/terminal/ClaudeStatusDisplay';
import { ClaudeStatusBadge } from '@/components/task/ClaudeStatusBadge';
import {
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { Task } from '@/types/ipc';
import { getClaudeStatusFromTask, useClaudeStatusMessages } from '@/hooks/useClaudeStatus';

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

  // Subscribe to status messages
  const { currentStatus, clearMessages } = useClaudeStatusMessages(terminalId);

  // Reset expanded state when panel closes
  const wasOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      setIsExpanded(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Clear messages when task changes
  useEffect(() => {
    clearMessages();
  }, [task?.id, clearMessages]);

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
                  {task.description || 'Watching Claude Code progress'}
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

        {/* Content */}
        {terminalId ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Simple status line */}
            <div className="border-b bg-muted/30">
              <ClaudeStatusDisplay currentStatus={currentStatus} />
            </div>

            {/* Terminal output */}
            <div className="flex-1 min-h-0 bg-[#1a1b26]">
              <XTermWrapper
                terminalId={terminalId}
                className="h-full"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <TerminalIcon className="h-12 w-12 mx-auto opacity-50" />
              <p>No active terminal session</p>
              <p className="text-sm">
                Start Claude Code to see progress
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
