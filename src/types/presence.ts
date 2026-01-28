/**
 * Presence Types for Real-time Collaboration
 *
 * Types for user presence tracking and display in collaborative features.
 * Will be integrated with Supabase Presence in future phases.
 */

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'away' | 'offline';

/**
 * Presence user information
 */
export interface PresenceUser {
  /** Unique user identifier */
  id: string;
  /** User display name */
  name: string;
  /** User email address */
  email: string;
  /** Avatar URL (optional) */
  avatar?: string;
  /** Current presence status */
  status: PresenceStatus;
  /** Task ID if user is viewing a specific task */
  viewingTaskId?: string;
  /** Last seen timestamp */
  lastSeenAt: Date;
}

/**
 * Presence state for a project
 */
export interface ProjectPresenceState {
  /** Project ID */
  projectId: string;
  /** List of users present in the project */
  users: PresenceUser[];
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Presence change event payload
 */
export interface PresenceChangeEvent {
  /** Type of change */
  type: 'join' | 'leave' | 'update';
  /** User affected by the change */
  user: PresenceUser;
  /** Previous state (for updates) */
  previousState?: Partial<PresenceUser>;
}
