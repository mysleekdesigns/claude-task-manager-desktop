/**
 * Review Progress Component
 *
 * Progress bar showing review completion status.
 * Displays overall progress with counter and optional overall score.
 */

import { Progress } from '@/components/ui/progress';
import type { ReviewProgressResponse } from '@/types/ipc';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ReviewProgressProps {
  progress: ReviewProgressResponse;
  compact?: boolean;
}

export function ReviewProgress({ progress, compact = false }: ReviewProgressProps) {
  const completedCount = progress.reviews.filter((r) => r.status === 'COMPLETED').length;
  const totalCount = progress.reviews.length;
  const percentComplete = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Progress value={percentComplete} className="h-1.5 flex-1" />
          <span className="text-muted-foreground font-medium tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with progress info */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Review Progress</span>
        <span className="font-medium tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <Progress value={percentComplete} className="h-2" />

      {/* Overall score */}
      {progress.overallScore !== undefined && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="font-medium">Overall Score</span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              progress.overallScore >= 80 && 'text-green-600 dark:text-green-400',
              progress.overallScore >= 60 &&
                progress.overallScore < 80 &&
                'text-yellow-600 dark:text-yellow-400',
              progress.overallScore < 60 && 'text-red-600 dark:text-red-400'
            )}
          >
            {progress.overallScore}
          </span>
        </div>
      )}
    </div>
  );
}
