/**
 * Tasks by Status Chart
 *
 * Visual breakdown of tasks by their status using a bar chart.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/types/ipc';

interface TasksByStatusChartProps {
  data: {
    status: TaskStatus;
    count: number;
  }[];
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: 'bg-slate-400',
  PLANNING: 'bg-blue-400',
  IN_PROGRESS: 'bg-amber-400',
  AI_REVIEW: 'bg-purple-400',
  HUMAN_REVIEW: 'bg-indigo-400',
  COMPLETED: 'bg-green-400',
  CANCELLED: 'bg-red-400',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  AI_REVIEW: 'AI Review',
  HUMAN_REVIEW: 'Human Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function TasksByStatusChart({ data }: TasksByStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tasks by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            const barWidth = (item.count / maxCount) * 100;

            return (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{STATUS_LABELS[item.status]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{item.count}</span>
                    <Badge variant="secondary" className="text-xs">
                      {percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${STATUS_COLORS[item.status]} transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{ width: `${String(barWidth)}%` }}
                  >
                    {item.count > 0 && (
                      <span className="text-xs font-semibold text-white drop-shadow-md">
                        {item.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
