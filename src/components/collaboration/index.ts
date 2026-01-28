/**
 * Collaboration Components
 *
 * Components for team collaboration features including:
 * - Activity feeds and real-time activity tracking
 * - Conflict detection and resolution
 * - User presence and avatars
 * - Pending invitations
 *
 * @module components/collaboration
 */

// Activity Feed Components
export { ActivityFeed, ActivityFeedPanel } from './ActivityFeed';
export {
  ActivityItem,
  ActivityItemSkeleton,
  type ActivityItemData,
  type ActivityType,
} from './ActivityItem';

// Conflict Resolution Components
export { ConflictNotification, useConflictNotifications } from './ConflictNotification';
export type { ConflictNotificationProps } from './ConflictNotification';

export { ConflictResolutionModal } from './ConflictResolutionModal';
export type { ConflictResolutionModalProps } from './ConflictResolutionModal';

export { ConflictDiff } from './ConflictDiff';
export type { ConflictDiffProps } from './ConflictDiff';

// Presence and Avatar Components
export { AvatarStack } from './AvatarStack';
export type { AvatarStackProps, AvatarStackSize } from './AvatarStack';

export { PresenceIndicator } from './PresenceIndicator';
export type { PresenceIndicatorProps, PresenceIndicatorSize } from './PresenceIndicator';

export { UserPresence } from './UserPresence';
export type { UserPresenceProps } from './UserPresence';

// Team Management Components
export { PendingInvitations } from './PendingInvitations';
