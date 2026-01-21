/**
 * Time per Phase Chart
 *
 * Bar chart showing average time spent per task phase.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimePerPhaseChartProps {
  data: {
    phaseName: string;
    averageMinutes: number;
    taskCount: number;
  }[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${String(Math.round(minutes))}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${String(hours)}h ${String(mins)}m` : `${String(hours)}h`;
}

export function TimePerPhaseChart({ data }: TimePerPhaseChartProps) {
  const maxMinutes = Math.max(...data.map((item) => item.averageMinutes), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Average Time per Phase</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => {
            const barWidth = (item.averageMinutes / maxMinutes) * 100;
            const colorClass = [
              'bg-blue-400',
              'bg-purple-400',
              'bg-amber-400',
              'bg-green-400',
              'bg-indigo-400',
            ][index % 5];

            return (
              <div key={item.phaseName ?? `phase-${String(index)}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.phaseName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatDuration(item.averageMinutes)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.taskCount} task{item.taskCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${colorClass} transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{ width: `${String(barWidth)}%` }}
                  >
                    {item.averageMinutes > 0 && (
                      <span className="text-xs font-semibold text-white drop-shadow-md">
                        {formatDuration(item.averageMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No phase data available yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
