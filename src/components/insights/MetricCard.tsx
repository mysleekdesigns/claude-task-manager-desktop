/**
 * Metric Card Component
 *
 * Displays a single metric with icon, value, label, and optional trend indicator.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
  } | undefined;
  description?: string | undefined;
}

export function MetricCard({ icon: Icon, label, value, trend, description }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {trend !== undefined && (
            <Badge
              variant={trend.value >= 0 ? 'default' : 'secondary'}
              className="ml-2"
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
