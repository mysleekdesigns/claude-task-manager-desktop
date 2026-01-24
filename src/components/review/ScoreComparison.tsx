/**
 * Score Comparison Component
 *
 * Displays before/after score comparison for fix verification results.
 * Shows progress bars with visual indicators for improvement or regression.
 */

import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ScoreComparisonProps {
  /** Score before the fix was applied (0-100) */
  preFixScore: number;
  /** Score after the fix was applied (0-100) */
  postFixScore: number;
  /** The improvement in score (can be negative) */
  scoreImprovement: number;
  /** Whether the verification passed */
  passed: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ScoreBarProps {
  label: string;
  score: number;
  variant: 'before' | 'after';
  passed?: boolean;
}

function ScoreBar({ label, score, variant, passed }: ScoreBarProps) {
  // Determine color based on variant and pass status
  const getProgressClassName = () => {
    if (variant === 'before') {
      return 'bg-muted [&>div]:bg-muted-foreground/50';
    }
    // After variant uses cyan for success, amber for failure
    if (passed) {
      return 'bg-cyan-500/20 [&>div]:bg-cyan-500';
    }
    return 'bg-amber-500/20 [&>div]:bg-amber-500';
  };

  return (
    <div className="flex-1 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-1">
          <span className={cn(
            'text-2xl font-bold tabular-nums',
            variant === 'after' && passed && 'text-cyan-500',
            variant === 'after' && !passed && 'text-amber-500'
          )}>
            {score}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <Progress
          value={score}
          className={cn('h-2', getProgressClassName())}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScoreComparison({
  preFixScore,
  postFixScore,
  scoreImprovement,
  passed,
}: ScoreComparisonProps) {
  // Determine the improvement indicator
  const getImprovementIndicator = () => {
    if (scoreImprovement > 0) {
      return {
        icon: passed ? CheckCircle2 : TrendingUp,
        color: passed ? 'text-green-500' : 'text-cyan-500',
        bgColor: passed ? 'bg-green-500/10' : 'bg-cyan-500/10',
        text: `+${scoreImprovement} points improved`,
      };
    } else if (scoreImprovement < 0) {
      return {
        icon: TrendingDown,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        text: `${scoreImprovement} points`,
      };
    } else {
      return {
        icon: Minus,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        text: 'No change',
      };
    }
  };

  const indicator = getImprovementIndicator();
  const IndicatorIcon = indicator.icon;

  return (
    <div className="space-y-4">
      {/* Before/After Score Bars */}
      <div className="flex gap-6">
        <ScoreBar
          label="Before"
          score={preFixScore}
          variant="before"
        />
        <ScoreBar
          label="After"
          score={postFixScore}
          variant="after"
          passed={passed}
        />
      </div>

      {/* Improvement Indicator */}
      <div className={cn(
        'flex items-center justify-center gap-2 py-2 px-4 rounded-md',
        indicator.bgColor
      )}>
        <IndicatorIcon className={cn('h-5 w-5', indicator.color)} />
        <span className={cn('text-sm font-medium', indicator.color)}>
          {indicator.text}
        </span>
        {passed && scoreImprovement > 0 && (
          <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />
        )}
        {!passed && scoreImprovement > 0 && (
          <XCircle className="h-4 w-4 text-amber-500 ml-1" />
        )}
      </div>
    </div>
  );
}
