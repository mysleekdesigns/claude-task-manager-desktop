/**
 * UserPresence Component
 *
 * Shows online users in a project with avatar stack.
 * Clicking opens a popover with the full user list.
 */

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AvatarStack, type AvatarStackSize } from './AvatarStack';
import { PresenceIndicator } from './PresenceIndicator';
import type { PresenceUser, PresenceStatus } from '@/types/presence';

/**
 * Props for the UserPresence component
 */
export interface UserPresenceProps {
  /** List of users present in the project */
  users: PresenceUser[];
  /** Maximum avatars to show in the stack (default: 4) */
  maxDisplay?: number;
  /** Size of the avatar stack (default: 'md') */
  size?: AvatarStackSize;
  /** Whether to show the popover on click (default: true) */
  showPopover?: boolean;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '??';
  }
  const firstPart = parts[0] ?? '';
  if (parts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }
  const lastPart = parts[parts.length - 1] ?? '';
  const firstInitial = firstPart[0] ?? '';
  const lastInitial = lastPart[0] ?? '';
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Status display text
 */
const statusText: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

/**
 * Individual user row in the popover list
 */
function UserRow({ user }: { user: PresenceUser }) {
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="relative">
        <Avatar className="h-8 w-8">
          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <PresenceIndicator
          status={user.status}
          size="sm"
          className="absolute -bottom-0.5 -right-0.5"
          showPulse={false}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {user.viewingTaskId ? 'Viewing a task' : statusText[user.status]}
        </div>
      </div>
    </div>
  );
}

/**
 * UserPresence component with avatar stack and popover
 */
export function UserPresence({
  users,
  maxDisplay = 4,
  size = 'md',
  showPopover = true,
  isLoading = false,
  className,
}: UserPresenceProps) {
  const [open, setOpen] = useState(false);

  // Group users by status
  const { onlineUsers, awayUsers, totalOnline } = useMemo(() => {
    const online = users.filter((u) => u.status === 'online');
    const away = users.filter((u) => u.status === 'away');
    return {
      onlineUsers: online,
      awayUsers: away,
      totalOnline: online.length + away.length,
    };
  }, [users]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-8 w-8 rounded-full bg-muted animate-pulse ring-2 ring-background',
                i > 1 && '-ml-2.5'
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (users.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 text-muted-foreground cursor-default',
              className
            )}
          >
            <Users className="h-4 w-4" />
            <span className="text-sm">No one online</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span>No team members are currently online</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Tooltip content for the summary
  const tooltipContent = (
    <div className="text-center">
      <div className="font-medium">
        {totalOnline} {totalOnline === 1 ? 'user' : 'users'} online
      </div>
      <div className="text-muted-foreground text-xs mt-0.5">
        Click to see everyone
      </div>
    </div>
  );

  // Main render
  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <AvatarStack
        users={users}
        maxDisplay={maxDisplay}
        size={size}
        showPresence={true}
      />
      {totalOnline > 0 && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-xs font-normal tabular-nums"
        >
          {totalOnline}
        </Badge>
      )}
    </div>
  );

  // Without popover, just show tooltip
  if (!showPopover) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    );
  }

  // With popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
              aria-label={`${totalOnline} ${totalOnline === 1 ? 'user' : 'users'} online. Click to see the list.`}
            >
              {content}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Team Members</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {totalOnline} online
            </Badge>
          </div>
        </div>

        <ScrollArea className="max-h-[280px]">
          <div className="p-2">
            {/* Online users */}
            {onlineUsers.length > 0 && (
              <div>
                <div className="px-1 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Online ({onlineUsers.length})
                </div>
                {onlineUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </div>
            )}

            {/* Away users */}
            {awayUsers.length > 0 && (
              <div>
                {onlineUsers.length > 0 && <Separator className="my-2" />}
                <div className="px-1 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Away ({awayUsers.length})
                </div>
                {awayUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default UserPresence;
