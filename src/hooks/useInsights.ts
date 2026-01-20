/**
 * React Hook for Insights Data
 *
 * Provides hooks for fetching analytics and metrics data.
 */

import { useIPCQuery } from './useIPC';
import type { TaskStatus, Priority } from '@/types/ipc';

// ============================================================================
// Insights Types
// ============================================================================

export interface TaskMetrics {
  total: number;
  completedThisWeek: number;
  completedThisMonth: number;
  completedTotal: number;
  byStatus: Array<{
    status: TaskStatus;
    count: number;
  }>;
  byPriority: Array<{
    priority: Priority;
    count: number;
  }>;
}

export interface TimeMetrics {
  averageDurationMinutes: number;
  totalTimeMinutes: number;
  phaseBreakdown: Array<{
    phaseName: string;
    averageMinutes: number;
    taskCount: number;
  }>;
}

export interface ProductivityTrend {
  date: string;
  completedCount: number;
  createdCount: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching task metrics
 */
export function useTaskMetrics(projectId: string) {
  return useIPCQuery('insights:getTaskMetrics', [projectId] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for fetching time metrics
 */
export function useTimeMetrics(projectId: string) {
  return useIPCQuery('insights:getTimeMetrics', [projectId] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for fetching productivity trends
 */
export function useProductivityTrends(projectId: string, days: number = 30) {
  return useIPCQuery('insights:getProductivityTrends', [projectId, days] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Combined hook for all insights data
 */
export function useInsights(projectId: string) {
  const taskMetrics = useTaskMetrics(projectId);
  const timeMetrics = useTimeMetrics(projectId);
  const productivityTrends = useProductivityTrends(projectId);

  return {
    taskMetrics: {
      data: taskMetrics.data as TaskMetrics | undefined,
      loading: taskMetrics.loading,
      error: taskMetrics.error,
    },
    timeMetrics: {
      data: timeMetrics.data as TimeMetrics | undefined,
      loading: timeMetrics.loading,
      error: timeMetrics.error,
    },
    productivityTrends: {
      data: productivityTrends.data as ProductivityTrend[] | undefined,
      loading: productivityTrends.loading,
      error: productivityTrends.error,
    },
    loading: taskMetrics.loading || timeMetrics.loading || productivityTrends.loading,
    error: taskMetrics.error || timeMetrics.error || productivityTrends.error,
  };
}
