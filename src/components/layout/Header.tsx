/**
 * Header Component
 *
 * Application header with project selector, global search, and user menu.
 * Includes optional window controls for frameless window mode.
 */

import { Search, Minus, Square, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from './ProjectSelector';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SyncStatusIndicator } from '@/components/sync/SyncStatusIndicator';
import { UserPresence, ConflictNotification } from '@/components/collaboration';
import { usePresence } from '@/hooks/usePresence';
import { useProjectStore } from '@/store/useProjectStore';

interface HeaderProps {
  /** Whether to show window controls (minimize, maximize, close) for frameless mode */
  showWindowControls?: boolean;
  /** Callback for window controls */
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

/**
 * Get keyboard shortcut text based on platform
 */
function getSearchShortcut(): string {
  const isMac = typeof navigator !== 'undefined' && (navigator.platform?.includes('Mac') ?? navigator.userAgent.includes('Mac'));
  return isMac ? '⌘K' : 'Ctrl+K';
}

export function Header({
  showWindowControls = false,
  onMinimize,
  onMaximize,
  onClose,
}: HeaderProps) {
  const { currentProject } = useProjectStore();
  const { users, isLoading: isPresenceLoading } = usePresence(currentProject?.id);

  const handleSearchClick = () => {
    // TODO: Open global search command palette
    console.log('Open search');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <ProjectSelector />
          {/* User Presence - shows who's online in the current project */}
          {currentProject && (
            <UserPresence
              users={users}
              isLoading={isPresenceLoading}
              maxDisplay={4}
              size="sm"
            />
          )}
        </div>

        {/* Global Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tasks, projects..."
              className="pl-9 pr-16 h-9 w-full"
              onClick={handleSearchClick}
              readOnly
            />
            <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              {getSearchShortcut()}
            </kbd>
          </div>
        </div>

        {/* Right Side - Conflicts, Sync Status, Theme Toggle, User Menu and Window Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <ConflictNotification compact />
          <SyncStatusIndicator />
          <ThemeToggle />
          <UserMenu />

          {/* Window Controls (for frameless mode) */}
          {showWindowControls && (
            <div className="flex items-center gap-1 ml-2 -mr-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={onMinimize}
                aria-label="Minimize window"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={onMaximize}
                aria-label="Maximize window"
              >
                <Square className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                onClick={onClose}
                aria-label="Close window"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
