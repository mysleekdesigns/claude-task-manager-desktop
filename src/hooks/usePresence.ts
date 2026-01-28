/**
 * usePresence Hook
 *
 * Hook for managing user presence state in a project.
 * Currently uses mock data - will be integrated with Supabase Presence
 * in Phase 19.3 (Supabase Realtime Integration).
 *
 * @example
 * ```typescript
 * function ProjectHeader({ projectId }: { projectId: string }) {
 *   const { users, isLoading, myPresence, updateMyPresence } = usePresence(projectId);
 *
 *   return (
 *     <div>
 *       <UserPresence users={users} />
 *       <span>{users.length} online</span>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { PresenceUser, PresenceStatus } from '@/types/presence';

/**
 * Hook options
 */
export interface UsePresenceOptions {
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
  /** Poll interval in ms for simulating realtime (default: 30000) */
  pollInterval?: number;
}

/**
 * Hook return type
 */
export interface UsePresenceResult {
  /** List of users currently present in the project */
  users: PresenceUser[];
  /** Count of online users */
  onlineCount: number;
  /** Whether the presence data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Current user's presence state */
  myPresence: PresenceUser | null;
  /** Update current user's presence (e.g., viewing task) */
  updateMyPresence: (updates: Partial<Pick<PresenceUser, 'viewingTaskId' | 'status'>>) => void;
  /** Manually refresh presence data */
  refresh: () => void;
}

/**
 * Generate mock presence users for development
 * This will be replaced with actual Supabase Presence data
 */
function generateMockUsers(currentUserId?: string): PresenceUser[] {
  const mockUsers: PresenceUser[] = [
    {
      id: 'user-1',
      name: 'Alice Chen',
      email: 'alice@example.com',
      status: 'online',
      lastSeenAt: new Date(),
    },
    {
      id: 'user-2',
      name: 'Bob Martinez',
      email: 'bob@example.com',
      status: 'online',
      viewingTaskId: 'task-123',
      lastSeenAt: new Date(),
    },
    {
      id: 'user-3',
      name: 'Carol Smith',
      email: 'carol@example.com',
      status: 'away',
      lastSeenAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
      id: 'user-4',
      name: 'David Kim',
      email: 'david@example.com',
      status: 'online',
      lastSeenAt: new Date(),
    },
    {
      id: 'user-5',
      name: 'Emma Wilson',
      email: 'emma@example.com',
      status: 'online',
      viewingTaskId: 'task-456',
      lastSeenAt: new Date(),
    },
  ];

  // Filter out current user if provided
  if (currentUserId) {
    return mockUsers.filter(u => u.id !== currentUserId);
  }

  return mockUsers;
}

/**
 * Hook for managing user presence in a project
 */
export function usePresence(
  projectId: string | undefined,
  options: UsePresenceOptions = {}
): UsePresenceResult {
  const { enabled = true } = options;
  const { user } = useAuth();

  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [myViewingTaskId, setMyViewingTaskId] = useState<string | undefined>();
  const [myStatus, setMyStatus] = useState<PresenceStatus>('online');

  // My presence state derived from current user
  // Note: lastSeenAt is updated periodically, not on every render
  const myPresence = useMemo<PresenceUser | null>(() => {
    if (!user) return null;
    const presence: PresenceUser = {
      id: user.id,
      name: user.name || 'Unknown User',
      email: user.email,
      status: myStatus,
      lastSeenAt: new Date(), // This is fine - useMemo only recomputes when deps change
    };
    // Only add optional properties if they have values
    if (user.avatar) {
      presence.avatar = user.avatar;
    }
    if (myViewingTaskId) {
      presence.viewingTaskId = myViewingTaskId;
    }
    return presence;
  }, [user, myStatus, myViewingTaskId]);

  // Fetch presence data (mock for now)
  const fetchPresence = useCallback(() => {
    if (!projectId || !enabled) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Simulate async fetch with mock data
    setTimeout(() => {
      try {
        const mockUsers = generateMockUsers(user?.id);
        setUsers(mockUsers);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch presence'));
        setIsLoading(false);
      }
    }, 100);
  }, [projectId, enabled, user?.id]);

  // Initial fetch and cleanup
  useEffect(() => {
    fetchPresence();
  }, [fetchPresence]);

  // Update my presence
  const updateMyPresence = useCallback(
    (updates: Partial<Pick<PresenceUser, 'viewingTaskId' | 'status'>>) => {
      if (updates.viewingTaskId !== undefined) {
        setMyViewingTaskId(updates.viewingTaskId);
      }
      if (updates.status !== undefined) {
        setMyStatus(updates.status);
      }
      // In the future, this will broadcast to Supabase Presence
    },
    []
  );

  // Count of online users (excluding self)
  const onlineCount = useMemo(() => {
    return users.filter(u => u.status === 'online').length;
  }, [users]);

  return {
    users,
    onlineCount,
    isLoading,
    error,
    myPresence,
    updateMyPresence,
    refresh: fetchPresence,
  };
}

export default usePresence;
