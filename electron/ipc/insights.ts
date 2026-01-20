/**
 * Insights IPC Handlers
 *
 * IPC handlers for analytics and metrics data (Phase 13).
 */

import { ipcMain } from 'electron';
import type {
  TaskMetrics,
  TimeMetrics,
  ProductivityTrend,
  TaskStatus,
  Priority,
} from '../../src/types/ipc.js';
import { databaseService } from '../services/database.js';

/**
 * List of channels managed by this module
 */
const CHANNELS = [
  'insights:getTaskMetrics',
  'insights:getTimeMetrics',
  'insights:getProductivityTrends',
] as const;

/**
 * Register all insights-related IPC handlers
 */
export function registerInsightsHandlers() {
  const prisma = databaseService.getClient();

  /**
   * Get task metrics for insights dashboard
   */
  ipcMain.handle('insights:getTaskMetrics', async (_, projectId: string): Promise<TaskMetrics> => {
    // Get all tasks for the project
    const tasks = await prisma.task.findMany({
      where: { projectId },
    });

    // Calculate date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count tasks by criteria
    const completedThisWeek = tasks.filter(
      (t) =>
        t.status === 'COMPLETED' &&
        new Date(t.updatedAt) >= oneWeekAgo
    ).length;

    const completedThisMonth = tasks.filter(
      (t) =>
        t.status === 'COMPLETED' &&
        new Date(t.updatedAt) >= oneMonthAgo
    ).length;

    const completedTotal = tasks.filter((t) => t.status === 'COMPLETED').length;

    // Group by status
    const statusCounts = new Map<TaskStatus, number>();
    tasks.forEach((task) => {
      const status = task.status as TaskStatus;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    const byStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Group by priority
    const priorityCounts = new Map<Priority, number>();
    tasks.forEach((task) => {
      const priority = task.priority as Priority;
      priorityCounts.set(priority, (priorityCounts.get(priority) || 0) + 1);
    });

    const byPriority = Array.from(priorityCounts.entries()).map(([priority, count]) => ({
      priority,
      count,
    }));

    return {
      total: tasks.length,
      completedThisWeek,
      completedThisMonth,
      completedTotal,
      byStatus,
      byPriority,
    };
  });

  /**
   * Get time metrics for insights dashboard
   */
  ipcMain.handle('insights:getTimeMetrics', async (_, projectId: string): Promise<TimeMetrics> => {
    // Get all completed tasks with phases
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      include: {
        phases: true,
      },
    });

    // Calculate average task duration based on phases
    let totalMinutes = 0;
    let tasksWithPhases = 0;

    const phaseTimeMap = new Map<string, { totalMinutes: number; count: number }>();

    tasks.forEach((task) => {
      if (task.phases && task.phases.length > 0) {
        tasksWithPhases++;

        task.phases.forEach((phase) => {
          if (phase.startedAt && phase.endedAt) {
            const startTime = new Date(phase.startedAt).getTime();
            const endTime = new Date(phase.endedAt).getTime();
            const durationMinutes = (endTime - startTime) / (1000 * 60);

            totalMinutes += durationMinutes;

            // Track per-phase metrics
            const existing = phaseTimeMap.get(phase.name) || { totalMinutes: 0, count: 0 };
            phaseTimeMap.set(phase.name, {
              totalMinutes: existing.totalMinutes + durationMinutes,
              count: existing.count + 1,
            });
          }
        });
      }
    });

    const averageDurationMinutes = tasksWithPhases > 0 ? totalMinutes / tasksWithPhases : 0;

    // Build phase breakdown
    const phaseBreakdown = Array.from(phaseTimeMap.entries()).map(([phaseName, data]) => ({
      phaseName,
      averageMinutes: data.totalMinutes / data.count,
      taskCount: data.count,
    }));

    return {
      averageDurationMinutes,
      totalTimeMinutes: totalMinutes,
      phaseBreakdown,
    };
  });

  /**
   * Get productivity trends over time
   */
  ipcMain.handle(
    'insights:getProductivityTrends',
    async (_, projectId: string, days: number = 30): Promise<ProductivityTrend[]> => {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Get all tasks for the project
      const tasks = await prisma.task.findMany({
        where: { projectId },
      });

      // Build trend data for each day
      const trendMap = new Map<string, { completedCount: number; createdCount: number }>();

      // Initialize all dates with zero counts
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0]!;
        trendMap.set(dateStr, { completedCount: 0, createdCount: 0 });
      }

      // Count completed tasks by date
      tasks.forEach((task) => {
        // Count created tasks
        const createdDate = new Date(task.createdAt);
        if (createdDate >= startDate) {
          const dateStr = createdDate.toISOString().split('T')[0]!;
          const existing = trendMap.get(dateStr);
          if (existing) {
            existing.createdCount++;
          }
        }

        // Count completed tasks
        if (task.status === 'COMPLETED') {
          const completedDate = new Date(task.updatedAt);
          if (completedDate >= startDate) {
            const dateStr = completedDate.toISOString().split('T')[0]!;
            const existing = trendMap.get(dateStr);
            if (existing) {
              existing.completedCount++;
            }
          }
        }
      });

      // Convert to array and sort by date
      return Array.from(trendMap.entries())
        .map(([date, counts]) => ({
          date,
          completedCount: counts.completedCount,
          createdCount: counts.createdCount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  );
}

/**
 * Unregister all insights-related IPC handlers
 */
export function unregisterInsightsHandlers() {
  CHANNELS.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
