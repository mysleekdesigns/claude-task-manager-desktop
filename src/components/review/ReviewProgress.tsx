/**
 * Review Progress Component
 *
 * Progress bar showing review completion status.
 * Displays overall progress with counter and optional overall score.
 * Includes fix buttons for review types with scores below 100.
 */

import { Zap, Code, Shield, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/ipc';
import { useFix } from '@/hooks/useFix';
import type { ReviewProgressResponse, ReviewType, FixType, ReviewFinding } from '@/types/ipc';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ReviewProgressProps {
  progress: ReviewProgressResponse;
  compact?: boolean;
}

// Fix button configuration
const FIX_BUTTONS: Array<{
  reviewType: ReviewType;
  fixType: FixType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { reviewType: 'performance', fixType: 'performance', label: 'Fix Performance', Icon: Zap },
  { reviewType: 'quality', fixType: 'quality', label: 'Fix Code Quality', Icon: Code },
  { reviewType: 'security', fixType: 'security', label: 'Fix Security', Icon: Shield },
];

export function ReviewProgress({ progress, compact = false }: ReviewProgressProps) {
  // Use the fix hook for managing fix operations - only if taskId is available
  const fixHook = progress.taskId ? useFix(progress.taskId) : null;

  const completedCount = progress.reviews.filter((r) => r.status === 'COMPLETED').length;
  const totalCount = progress.reviews.length;
  const percentComplete = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get score for a specific review type
  const getReviewScore = (reviewType: ReviewType): number | undefined => {
    const review = progress.reviews.find((r) => r.reviewType === reviewType);
    return review?.score;
  };

  // Check if any fix buttons should be shown
  const hasFixableReviews = FIX_BUTTONS.some((btn) => {
    const score = getReviewScore(btn.reviewType);
    return score !== undefined && score < 100;
  });

  // Handle fix button click
  const handleFix = async (fixType: FixType, reviewType: ReviewType) => {
    if (!progress.taskId || !fixHook) return;

    try {
      // Fetch findings for this review type before starting the fix
      const findings: ReviewFinding[] = await invoke('review:getFindings', {
        taskId: progress.taskId,
        reviewType,
      }) ?? [];

      await fixHook.startFix(fixType, findings);
    } catch (err) {
      console.error(`Failed to start ${fixType} fix:`, err);
    }
  };

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

      {/* Fix buttons - only show if there are reviews with scores below 100 */}
      {hasFixableReviews && fixHook && (
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-row gap-2">
            {FIX_BUTTONS.map(({ reviewType, fixType, label, Icon }) => {
              const score = getReviewScore(reviewType);
              // Only show button if score exists and is less than 100
              if (score === undefined || score >= 100) return null;

              const fixStatus = fixHook.getFixStatus(fixType);
              const isInProgress = fixStatus?.status === 'IN_PROGRESS';
              const isCompleted = fixStatus?.status === 'COMPLETED';
              const isCyan = isInProgress || isCompleted;
              const activityMessage = fixStatus?.currentActivity;

              return (
                <Button
                  key={fixType}
                  size="sm"
                  variant="outline"
                  onClick={() => handleFix(fixType, reviewType)}
                  disabled={isInProgress}
                  className={cn(
                    'gap-1.5',
                    isCyan && 'border-cyan-500 text-cyan-400 hover:text-cyan-400 hover:border-cyan-400'
                  )}
                  title={isInProgress && activityMessage ? activityMessage : undefined}
                >
                  {isInProgress ? (
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  ) : (
                    <Icon className={cn('h-4 w-4', isCyan && 'text-cyan-400')} />
                  )}
                  {label}
                </Button>
              );
            })}
          </div>

          {/* Fix progress display - show when any fix is in progress */}
          {fixHook.hasActiveFix() && (() => {
            const activeFixes = fixHook.getTaskFixes();
            const inProgressFix = activeFixes.find((f) => f.state.status === 'IN_PROGRESS');
            const progressMessage = inProgressFix?.state.currentActivity;

            if (!progressMessage) return null;

            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                <span className="font-mono truncate" title={progressMessage}>
                  {progressMessage}
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
