/**
 * Terminal Toolbar Component
 *
 * Control bar for terminal management with terminal count badge,
 * new terminal button, and invoke Claude All button.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Sparkles, Terminal as TerminalIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TerminalToolbarProps {
  terminalCount: number;
  maxTerminals?: number;
  onNewTerminal: () => void;
  onInvokeClaudeAll: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TerminalToolbar({
  terminalCount,
  maxTerminals = 12,
  onNewTerminal,
  onInvokeClaudeAll,
}: TerminalToolbarProps) {
  const isAtMaxCapacity = terminalCount >= maxTerminals;
  const hasTerminals = terminalCount > 0;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left side: Terminal count */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Terminals</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {terminalCount}/{maxTerminals}
        </Badge>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-2">
        {/* Invoke Claude All button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onInvokeClaudeAll}
                disabled={!hasTerminals}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Invoke Claude All
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {hasTerminals
                  ? 'Run Claude Code in all terminal sessions'
                  : 'No terminals available'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* New Terminal button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onNewTerminal}
                disabled={isAtMaxCapacity}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Terminal
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {isAtMaxCapacity
                  ? `Maximum ${maxTerminals} terminals reached`
                  : 'Create a new terminal session'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
