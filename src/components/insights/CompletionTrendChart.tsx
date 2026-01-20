/**
 * Completion Trend Chart
 *
 * Line chart showing task completions over time.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';

interface CompletionTrendChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
}

export function CompletionTrendChart({ data }: CompletionTrendChartProps) {
  const { maxCount, points, chartWidth, chartHeight } = useMemo(() => {
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const chartWidth = 100;
    const chartHeight = 60;

    // Generate SVG path points
    const points = data.map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * chartWidth;
      const y = chartHeight - (item.count / maxCount) * chartHeight;
      return { x, y, count: item.count, date: item.date };
    });

    return { maxCount, points, chartWidth, chartHeight };
  }, [data]);

  // Generate SVG path for line
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }, [points]);

  // Generate SVG path for filled area
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return `${path} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  }, [points, chartWidth, chartHeight]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Task Completion Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* SVG Chart */}
          <div className="w-full h-48 bg-muted/30 rounded-lg p-4">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Area fill */}
              <path
                d={areaPath}
                fill="currentColor"
                className="text-primary/20"
              />
              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
                vectorEffect="non-scaling-stroke"
              />
              {/* Points */}
              {points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  fill="currentColor"
                  className="text-primary"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data[0]?.date || 'Start'}</span>
            <span className="font-medium">
              Peak: {maxCount} task{maxCount !== 1 ? 's' : ''}
            </span>
            <span>{data[data.length - 1]?.date || 'End'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
