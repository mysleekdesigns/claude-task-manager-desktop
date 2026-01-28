/**
 * Activity Item Component
 *
 * Displays a single activity entry with user avatar, action description,
 * and relative timestamp. Supports various activity types like task creation,
 * updates, status changes, comments, and team membership changes.
 */

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  CirclePlus,
  Edit3,
  MessageCircle,
  MoveRight,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported activity types for the feed
 */
export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_moved'
  | 'comment_added'
  | 'member_joined'
  | 'member_left';

/**
 * Activity item data structure
 */
export interface ActivityItemData {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userAvatar?: string;
  entityType: 'task' | 'project' | 'comment';
  entityId: string;
  entityName: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

interface ActivityItemProps {
  activity: ActivityItemData;
  onClick?: (activity: ActivityItemData) => void;
}

// ============================================================================
// Activity Type Configuration
// ============================================================================

interface ActivityTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  verb: string;
  color: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  task_created: {
    icon: CirclePlus,
    verb: 'created',
    color: 'text-green-500',
    badgeVariant: 'secondary',
  },
  task_updated: {
    icon: Edit3,
    verb: 'updated',
    color: 'text-blue-500',
    badgeVariant: 'secondary',
  },
  task_deleted: {
    icon: Trash2,
    verb: 'deleted',
    color: 'text-destructive',
    badgeVariant: 'destructive',
  },
  task_moved: {
    icon: MoveRight,
    verb: 'moved',
    color: 'text-amber-500',
    badgeVariant: 'outline',
  },
  comment_added: {
    icon: MessageCircle,
    verb: 'commented on',
    color: 'text-purple-500',
    badgeVariant: 'secondary',
  },
  member_joined: {
    icon: UserPlus,
    verb: 'joined',
    color: 'text-green-500',
    badgeVariant: 'default',
  },
  member_left: {
    icon: UserMinus,
    verb: 'left',
    color: 'text-muted-foreground',
    badgeVariant: 'outline',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get user initials from name
 */
function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const firstInitial = parts[0]?.[0] || '';
    const lastInitial = parts[parts.length - 1]?.[0] || '';
    return (firstInitial + lastInitial).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Build the activity description based on type
 */
function buildActivityDescription(activity: ActivityItemData): {
  action: string;
  target: string;
  details?: string;
} {
  const config = ACTIVITY_TYPE_CONFIG[activity.type];

  switch (activity.type) {
    case 'task_moved': {
      const fromStatus = activity.metadata?.['fromStatus'] as string | undefined;
      const toStatus = activity.metadata?.['toStatus'] as string | undefined;
      const detailsText = fromStatus && toStatus ? `from ${fromStatus} to ${toStatus}` : null;
      if (detailsText) {
        return {
          action: config.verb,
          target: activity.entityName,
          details: detailsText,
        };
      }
      return {
        action: config.verb,
        target: activity.entityName,
      };
    }
    case 'member_joined':
    case 'member_left': {
      return {
        action: config.verb,
        target: activity.entityName,
      };
    }
    default: {
      return {
        action: config.verb,
        target: activity.entityName,
      };
    }
  }
}

// ============================================================================
// Component
// ============================================================================

export function ActivityItem({ activity, onClick }: ActivityItemProps) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type];
  const Icon = config.icon;

  const relativeTime = useMemo(() => {
    return formatDistanceToNow(activity.timestamp, { addSuffix: true });
  }, [activity.timestamp]);

  const { action, target, details } = useMemo(
    () => buildActivityDescription(activity),
    [activity]
  );

  const initials = useMemo(() => getUserInitials(activity.userName), [activity.userName]);

  const handleClick = () => {
    onClick?.(activity);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(activity);
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50'
      )}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      {/* User Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {activity.userAvatar && (
          <AvatarImage src={activity.userAvatar} alt={activity.userName} />
        )}
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Activity Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Main activity line */}
        <p className="text-sm leading-snug">
          <span className="font-medium">{activity.userName}</span>
          <span className="text-muted-foreground"> {action} </span>
          <span className="font-medium truncate">{target}</span>
          {details && (
            <span className="text-muted-foreground"> {details}</span>
          )}
        </p>

        {/* Timestamp and type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
          {activity.type === 'task_moved' && activity.metadata?.['toStatus'] != null && (
            <Badge variant={config.badgeVariant} className="text-xs">
              {String(activity.metadata['toStatus'] as string)}
            </Badge>
          )}
        </div>
      </div>

      {/* Activity Type Icon */}
      <div className={cn('shrink-0 mt-0.5', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      {/* Avatar skeleton */}
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
      </div>

      {/* Icon skeleton */}
      <div className="h-4 w-4 bg-muted animate-pulse rounded shrink-0" />
    </div>
  );
}
