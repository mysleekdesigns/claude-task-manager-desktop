/**
 * Activity Feed Component
 *
 * Displays a scrollable feed of recent activities by collaborators.
 * Supports filtering by project and real-time updates (placeholder mock for now).
 * Shows loading skeleton while fetching and empty state when no activities exist.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ActivityIcon, Filter, RefreshCw } from 'lucide-react';
import { ActivityItem, ActivityItemSkeleton, type ActivityItemData, type ActivityType } from './ActivityItem';

// ============================================================================
// Types
// ============================================================================

interface ActivityFeedProps {
  /** Optional project ID to filter activities */
  projectId?: string;
  /** Optional title for the feed card */
  title?: string;
  /** Maximum height for the scrollable area */
  maxHeight?: string;
  /** Whether to show the filter controls */
  showFilters?: boolean;
  /** Whether to show in compact mode (sidebar panel) */
  compact?: boolean;
  /** Callback when an activity item is clicked */
  onActivityClick?: (activity: ActivityItemData) => void;
  /** Custom class name */
  className?: string;
}

type ActivityFilterType = 'all' | ActivityType;

// ============================================================================
// Mock Data Generator
// ============================================================================

/**
 * Generate mock activity data for demonstration
 * In production, this would be replaced with real IPC calls
 */
function generateMockActivities(projectId?: string): ActivityItemData[] {
  const now = new Date();

  const mockActivities: ActivityItemData[] = [
    {
      id: '1',
      type: 'task_created',
      userId: 'user-1',
      userName: 'John Doe',
      entityType: 'task',
      entityId: 'task-1',
      entityName: 'Implement user authentication',
      timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
      id: '2',
      type: 'task_moved',
      userId: 'user-2',
      userName: 'Jane Smith',
      entityType: 'task',
      entityId: 'task-2',
      entityName: 'Fix login bug',
      metadata: {
        fromStatus: 'IN_PROGRESS',
        toStatus: 'COMPLETED',
      },
      timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
    },
    {
      id: '3',
      type: 'comment_added',
      userId: 'user-1',
      userName: 'John Doe',
      entityType: 'comment',
      entityId: 'comment-1',
      entityName: 'Dashboard refactoring',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
    },
    {
      id: '4',
      type: 'task_updated',
      userId: 'user-3',
      userName: 'Alice Johnson',
      entityType: 'task',
      entityId: 'task-3',
      entityName: 'API integration',
      timestamp: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
    },
    {
      id: '5',
      type: 'member_joined',
      userId: 'user-4',
      userName: 'Bob Wilson',
      entityType: 'project',
      entityId: projectId ?? 'project-1',
      entityName: 'Claude Tasks Desktop',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: '6',
      type: 'task_created',
      userId: 'user-2',
      userName: 'Jane Smith',
      entityType: 'task',
      entityId: 'task-4',
      entityName: 'Add keyboard shortcuts',
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
    {
      id: '7',
      type: 'task_deleted',
      userId: 'user-1',
      userName: 'John Doe',
      entityType: 'task',
      entityId: 'task-5',
      entityName: 'Deprecated feature cleanup',
      timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
    {
      id: '8',
      type: 'task_moved',
      userId: 'user-3',
      userName: 'Alice Johnson',
      entityType: 'task',
      entityId: 'task-6',
      entityName: 'Performance optimization',
      metadata: {
        fromStatus: 'PLANNING',
        toStatus: 'IN_PROGRESS',
      },
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  ];

  return mockActivities;
}

// ============================================================================
// Component
// ============================================================================

export function ActivityFeed({
  projectId,
  title = 'Activity Feed',
  maxHeight = '400px',
  showFilters = true,
  compact = false,
  onActivityClick,
  className,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ActivityFilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch activities (mock implementation)
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      const data = generateMockActivities(projectId);
      setActivities(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh simulation (real-time updates placeholder)
  useEffect(() => {
    const interval = setInterval(() => {
      // In production, this would be replaced with WebSocket/IPC event subscription
      // For now, just refresh every 30 seconds
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const data = generateMockActivities(projectId);
      setActivities(data);
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filterType === 'all') {
      return activities;
    }
    return activities.filter((activity) => activity.type === filterType);
  }, [activities, filterType]);

  // Activity type counts for badges
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ActivityType, number>> = {};
    activities.forEach((activity) => {
      counts[activity.type] = (counts[activity.type] || 0) + 1;
    });
    return counts;
  }, [activities]);

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityItemSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (filteredActivities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ActivityIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filterType !== 'all'
              ? 'No activities match the selected filter'
              : 'No recent activity'}
          </p>
          {filterType !== 'all' && (
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => setFilterType('all')}
            >
              Clear filter
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredActivities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            {...(onActivityClick ? { onClick: onActivityClick } : {})}
          />
        ))}
      </div>
    );
  };

  // Compact mode for sidebar panel
  if (compact) {
    return (
      <div className={className}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Activities list */}
        <ScrollArea style={{ maxHeight }}>
          {renderContent()}
        </ScrollArea>
      </div>
    );
  }

  // Full card mode
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ActivityIcon className="h-5 w-5" />
            {title}
            {!loading && (
              <Badge variant="secondary" className="text-xs font-normal">
                {filteredActivities.length}
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 mt-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filterType}
              onValueChange={(value) => setFilterType(value as ActivityFilterType)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activities ({activities.length})</SelectItem>
                <SelectItem value="task_created">
                  Created ({typeCounts.task_created || 0})
                </SelectItem>
                <SelectItem value="task_updated">
                  Updated ({typeCounts.task_updated || 0})
                </SelectItem>
                <SelectItem value="task_moved">
                  Moved ({typeCounts.task_moved || 0})
                </SelectItem>
                <SelectItem value="task_deleted">
                  Deleted ({typeCounts.task_deleted || 0})
                </SelectItem>
                <SelectItem value="comment_added">
                  Comments ({typeCounts.comment_added || 0})
                </SelectItem>
                <SelectItem value="member_joined">
                  Joined ({typeCounts.member_joined || 0})
                </SelectItem>
                <SelectItem value="member_left">
                  Left ({typeCounts.member_left || 0})
                </SelectItem>
              </SelectContent>
            </Select>

            {filterType !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setFilterType('all')}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }}>
          {renderContent()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sidebar Panel Variant
// ============================================================================

interface ActivityFeedPanelProps {
  projectId?: string;
  className?: string;
  onActivityClick?: (activity: ActivityItemData) => void;
}

/**
 * A compact version of ActivityFeed designed for use in a sidebar panel
 */
export function ActivityFeedPanel({
  projectId,
  className,
  onActivityClick,
}: ActivityFeedPanelProps) {
  return (
    <ActivityFeed
      {...(projectId ? { projectId } : {})}
      title="Recent Activity"
      maxHeight="300px"
      showFilters={false}
      compact={true}
      {...(onActivityClick ? { onActivityClick } : {})}
      {...(className ? { className } : {})}
    />
  );
}
