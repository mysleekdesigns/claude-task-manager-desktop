/**
 * Review Progress Component
 *
 * Multi-segment progress bar showing each review agent status with icons.
 * Displays overall progress and individual review statuses.
 */

import {
  Shield,
  Code,
  TestTube,
  Zap,
  FileText,
  Search,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ReviewProgressResponse, ReviewType, ReviewStatus } from '@/types/ipc';
import { cn } from '@/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const REVIEW_ICONS: Record<ReviewType, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  quality: Code,
  testing: TestTube,
  performance: Zap,
  documentation: FileText,
  research: Search,
};

const REVIEW_LABELS: Record<ReviewType, string> = {
  security: 'Security',
  quality: 'Code Quality',
  testing: 'Test Coverage',
  performance: 'Performance',
  documentation: 'Documentation',
  research: 'Research',
};

// ============================================================================
// Types
// ============================================================================

interface ReviewProgressProps {
  progress: ReviewProgressResponse;
  compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ReviewItemProps {
  reviewType: ReviewType;
  status: ReviewStatus;
  score?: number;
}

function ReviewItem({ reviewType, status, score }: ReviewItemProps) {
  const Icon = REVIEW_ICONS[reviewType];
  const isComplete = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isRunning = status === 'RUNNING';

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md text-sm transition-colors',
        isComplete && 'bg-green-500/10 text-green-600 dark:text-green-400',
        isFailed && 'bg-red-500/10 text-red-600 dark:text-red-400',
        isRunning && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        !isComplete && !isFailed && !isRunning && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{REVIEW_LABELS[reviewType]}</span>
      {isComplete && <Check className="h-4 w-4 shrink-0" />}
      {isRunning && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
      {isFailed && <AlertCircle className="h-4 w-4 shrink-0" />}
      {score !== undefined && (
        <span className="font-medium tabular-nums">{score}</span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

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

      {/* Review items grid */}
      <div className="grid grid-cols-2 gap-2">
        {progress.reviews.map((review) => (
          <ReviewItem
            key={review.reviewType}
            reviewType={review.reviewType}
            status={review.status}
            {...(review.score !== undefined && { score: review.score })}
          />
        ))}
      </div>

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
