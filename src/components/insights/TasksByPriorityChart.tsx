/**
 * Tasks by Priority Chart
 *
 * Visual breakdown of tasks by their priority using a bar chart.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Priority } from '@/types/ipc';

interface TasksByPriorityChartProps {
  data: {
    priority: Priority;
    count: number;
  }[];
}

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-orange-400',
  URGENT: 'bg-red-500',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function TasksByPriorityChart({ data }: TasksByPriorityChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tasks by Priority</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            const barWidth = (item.count / maxCount) * 100;

            return (
              <div key={item.priority} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{PRIORITY_LABELS[item.priority]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{item.count}</span>
                    <Badge variant="secondary" className="text-xs">
                      {percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${PRIORITY_COLORS[item.priority]} transition-all duration-500 flex items-center justify-end pr-2`}
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
