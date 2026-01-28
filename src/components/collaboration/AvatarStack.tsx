/**
 * AvatarStack Component
 *
 * Displays a stack of overlapping avatars with an overflow indicator.
 * Shows tooltip with full list of users on hover.
 */

import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from './PresenceIndicator';
import type { PresenceUser } from '@/types/presence';

/**
 * Size variants for the avatar stack
 */
export type AvatarStackSize = 'sm' | 'md' | 'lg';

/**
 * Props for the AvatarStack component
 */
export interface AvatarStackProps {
  /** List of users to display */
  users: PresenceUser[];
  /** Maximum number of avatars to show before overflow (default: 3) */
  maxDisplay?: number;
  /** Size of avatars (default: 'md') */
  size?: AvatarStackSize;
  /** Whether to show presence indicators (default: true) */
  showPresence?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for the stack */
  onClick?: () => void;
}

/**
 * Size classes for avatars
 */
const avatarSizeClasses: Record<AvatarStackSize, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

/**
 * Negative margin for overlap effect
 */
const overlapClasses: Record<AvatarStackSize, string> = {
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
};

/**
 * Position classes for presence indicator
 */
const indicatorPositionClasses: Record<AvatarStackSize, string> = {
  sm: '-bottom-0 -right-0',
  md: '-bottom-0.5 -right-0.5',
  lg: '-bottom-0.5 -right-0.5',
};

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
 * Single avatar item with tooltip
 */
interface AvatarItemProps {
  user: PresenceUser;
  size: AvatarStackSize;
  showPresence: boolean;
  isFirst: boolean;
}

function AvatarItem({ user, size, showPresence, isFirst }: AvatarItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'relative inline-block',
            !isFirst && overlapClasses[size]
          )}
        >
          <Avatar
            className={cn(
              avatarSizeClasses[size],
              'ring-2 ring-background cursor-pointer transition-transform hover:scale-110 hover:z-10'
            )}
          >
            {user.avatar && (
              <AvatarImage src={user.avatar} alt={user.name} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {showPresence && (
            <PresenceIndicator
              status={user.status}
              size="sm"
              className={cn(
                'absolute',
                indicatorPositionClasses[size]
              )}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="font-medium">{user.name}</div>
        {user.viewingTaskId && (
          <div className="text-muted-foreground">Viewing a task</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Overflow indicator showing count of additional users
 */
interface OverflowIndicatorProps {
  count: number;
  users: PresenceUser[];
  size: AvatarStackSize;
}

function OverflowIndicator({ count, users, size }: OverflowIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('relative inline-block', overlapClasses[size])}>
          <Avatar
            className={cn(
              avatarSizeClasses[size],
              'ring-2 ring-background bg-muted cursor-pointer transition-transform hover:scale-110 hover:z-10'
            )}
          >
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              +{count}
            </AvatarFallback>
          </Avatar>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
        <div className="font-medium mb-1">+{count} more</div>
        <div className="space-y-0.5">
          {users.slice(0, 5).map((user) => (
            <div key={user.id} className="text-muted-foreground truncate">
              {user.name}
            </div>
          ))}
          {users.length > 5 && (
            <div className="text-muted-foreground">
              and {users.length - 5} more...
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * AvatarStack component displaying stacked user avatars
 */
export function AvatarStack({
  users,
  maxDisplay = 3,
  size = 'md',
  showPresence = true,
  className,
  onClick,
}: AvatarStackProps) {
  // Sort users: online first, then away, then offline
  const sortedUsers = useMemo(() => {
    const statusOrder = { online: 0, away: 1, offline: 2 };
    return [...users].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [users]);

  // Split into visible and overflow
  const visibleUsers = sortedUsers.slice(0, maxDisplay);
  const overflowUsers = sortedUsers.slice(maxDisplay);
  const hasOverflow = overflowUsers.length > 0;

  if (users.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex items-center', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {visibleUsers.map((user, index) => (
        <AvatarItem
          key={user.id}
          user={user}
          size={size}
          showPresence={showPresence}
          isFirst={index === 0}
        />
      ))}
      {hasOverflow && (
        <OverflowIndicator
          count={overflowUsers.length}
          users={overflowUsers}
          size={size}
        />
      )}
    </div>
  );
}

export default AvatarStack;
