/**
 * Insights Dashboard Page
 * Analytics and metrics for project progress
 */

import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useInsights } from '@/hooks/useInsights';
import { MetricCard } from '@/components/insights/MetricCard';
import { TasksByStatusChart } from '@/components/insights/TasksByStatusChart';
import { TasksByPriorityChart } from '@/components/insights/TasksByPriorityChart';
import { CompletionTrendChart } from '@/components/insights/CompletionTrendChart';
import { TimePerPhaseChart } from '@/components/insights/TimePerPhaseChart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Clock,
  ListTodo,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

export function InsightsPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  const {
    taskMetrics,
    timeMetrics,
    productivityTrends,
    loading,
    error,
  } = useInsights(currentProject?.id || '');

  // Format completion trend data for chart
  const completionTrendData = useMemo(() => {
    if (!productivityTrends.data) return [];
    return productivityTrends.data.map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      count: item.completedCount,
    }));
  }, [productivityTrends.data]);

  // Calculate average task duration in human-readable format
  const averageDuration = useMemo(() => {
    if (!timeMetrics.data) return 'N/A';
    const minutes = timeMetrics.data.averageDurationMinutes;
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [timeMetrics.data]);

  // Calculate completion rate trend
  const completionTrend = useMemo(() => {
    if (!taskMetrics.data) return undefined;
    const thisWeek = taskMetrics.data.completedThisWeek;
    const thisMonth = taskMetrics.data.completedThisMonth;

    // Simple trend calculation (this week vs average weekly from this month)
    const avgWeekly = thisMonth / 4;
    if (avgWeekly === 0) return undefined;

    const percentChange = ((thisWeek - avgWeekly) / avgWeekly) * 100;
    return {
      value: Math.round(percentChange),
      label: 'vs avg',
    };
  }, [taskMetrics.data]);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Insights</h1>
          <p className="text-muted-foreground mt-2">
            Analytics and metrics for your development workflow
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view insights.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">{currentProject.name}</h1>
        <p className="text-muted-foreground mt-2">
          Analytics and metrics for your development workflow
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-8 pt-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Loading insights...</div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="time">Time Tracking</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={ListTodo}
                  label="Total Tasks"
                  value={taskMetrics.data?.total ?? 0}
                  description="All tasks in project"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Completed This Week"
                  value={taskMetrics.data?.completedThisWeek ?? 0}
                  trend={completionTrend || undefined}
                  description="Tasks completed in last 7 days"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Completed This Month"
                  value={taskMetrics.data?.completedThisMonth ?? 0}
                  description="Tasks completed in last 30 days"
                />
                <MetricCard
                  icon={Clock}
                  label="Avg Task Duration"
                  value={averageDuration}
                  description="Average time per task"
                />
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TasksByStatusChart
                  data={taskMetrics.data?.byStatus ?? []}
                />
                <TasksByPriorityChart
                  data={taskMetrics.data?.byPriority ?? []}
                />
              </div>
            </TabsContent>

            {/* Time Tracking Tab */}
            <TabsContent value="time" className="space-y-6">
              {/* Time Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  icon={Clock}
                  label="Average Duration"
                  value={averageDuration}
                  description="Average time to complete a task"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Total Time Tracked"
                  value={
                    timeMetrics.data
                      ? `${Math.round(timeMetrics.data.totalTimeMinutes / 60)}h`
                      : 'N/A'
                  }
                  description="Total time across all tasks"
                />
                <MetricCard
                  icon={ListTodo}
                  label="Tasks with Phases"
                  value={
                    timeMetrics.data?.phaseBreakdown.reduce(
                      (sum, p) => sum + p.taskCount,
                      0
                    ) ?? 0
                  }
                  description="Tasks with tracked phases"
                />
              </div>

              {/* Phase Breakdown */}
              <TimePerPhaseChart
                data={timeMetrics.data?.phaseBreakdown ?? []}
              />
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-6">
              {/* Trend Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricCard
                  icon={TrendingUp}
                  label="Completion Rate"
                  value={
                    taskMetrics.data && taskMetrics.data.total > 0
                      ? `${Math.round(
                          (taskMetrics.data.completedTotal / taskMetrics.data.total) * 100
                        )}%`
                      : '0%'
                  }
                  description="Percentage of completed tasks"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Total Completed"
                  value={taskMetrics.data?.completedTotal ?? 0}
                  description="All-time completed tasks"
                />
              </div>

              {/* Completion Trend Chart */}
              <CompletionTrendChart data={completionTrendData} />

              {/* Productivity Summary */}
              {productivityTrends.data && productivityTrends.data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetricCard
                    icon={CheckCircle2}
                    label="Most Productive Day"
                    value={
                      productivityTrends.data.reduce((max, item) =>
                        item.completedCount > max.completedCount ? item : max
                      ).completedCount
                    }
                    description={new Date(
                      productivityTrends.data.reduce((max, item) =>
                        item.completedCount > max.completedCount ? item : max
                      ).date
                    ).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Avg Daily Completion"
                    value={Math.round(
                      productivityTrends.data.reduce(
                        (sum, item) => sum + item.completedCount,
                        0
                      ) / productivityTrends.data.length
                    )}
                    description="Average tasks per day"
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
