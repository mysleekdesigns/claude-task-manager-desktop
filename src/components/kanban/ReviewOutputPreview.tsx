/**
 * Review Output Preview Component
 *
 * Displays real-time AI review progress on task cards.
 * Shows the status of each review agent (security, quality, performance, etc.)
 * and the current activity message.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Shield, Code, Zap, FileText, Search } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { useFixStore } from '@/store/useFixStore';
import type { ReviewType, ReviewProgressResponse, ReviewStatus, FixType, FixVerificationResult } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const REVIEW_ICONS: Record<ReviewType, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  quality: Code,
  performance: Zap,
  documentation: FileText,
  research: Search,
};

const REVIEW_LABELS: Record<ReviewType, string> = {
  security: 'Security',
  quality: 'Quality',
  performance: 'Performance',
  documentation: 'Documentation',
  research: 'Research',
};

// ============================================================================
// Types
// ============================================================================

interface ReviewAgentProgress {
  reviewType: ReviewType;
  status: ReviewStatus;
  score?: number;
  summary?: string;
  findingsCount: number;
}

interface ReviewProgressEvent {
  taskId: string;
  currentActivity?: {
    reviewType: ReviewType;
    message: string;
    timestamp: number;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reviews: ReviewAgentProgress[];
  overallScore?: number | undefined;
}

interface ReviewOutputPreviewProps {
  taskId: string;
}

// ============================================================================
// Component
// ============================================================================

export function ReviewOutputPreview({ taskId }: ReviewOutputPreviewProps) {
  const [progress, setProgress] = useState<ReviewProgressEvent | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>('Starting review...');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Subscribe to verifyingReviewTypes state to trigger re-renders when it changes
  // The isReviewTypeVerifying method alone doesn't cause re-renders because it uses get()
  const { isReviewTypeVerifying, verifyingReviewTypes, clearVerifyingReviewType } = useReviewStore();
  const { setFixVerified } = useFixStore();

  const handleProgress = useCallback((data: ReviewProgressEvent) => {
    // Debounce rapid updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setProgress(data);

      if (data.currentActivity) {
        setCurrentMessage(data.currentActivity.message);
      } else if (data.reviews.length === 0) {
        // No reviews created yet - show starting message
        // This handles the initial state when review just started
        if (data.status === 'in_progress' || data.status === 'pending') {
          setCurrentMessage('Starting review...');
        }
      } else {
        // Find the first running review
        const running = data.reviews.find((r) => r.status === 'RUNNING');
        if (running) {
          setCurrentMessage(`${REVIEW_LABELS[running.reviewType]} review in progress...`);
        } else {
          // Check if all completed
          const allCompleted = data.reviews.every((r) => r.status === 'COMPLETED');
          if (allCompleted && data.reviews.length > 0) {
            setCurrentMessage('All reviews completed');
          }
        }
      }
    }, 50);
  }, []);

  useEffect(() => {
    const disposers: Array<() => void> = [];

    // Subscribe to review progress events
    const channel = `review:progress:${taskId}` as const;
    const dispose = window.electron.on(channel, (...args: unknown[]) => {
      const data = args[0] as ReviewProgressEvent | undefined;
      if (data?.reviews) {
        handleProgress(data);
      }
    });
    disposers.push(dispose);

    // Subscribe to fix:verified and fix:progress events for each fixable review type
    // This ensures the message updates and state is cleared when verification completes
    const fixableReviewTypes: ReviewType[] = ['security', 'quality', 'performance'];
    for (const reviewType of fixableReviewTypes) {
      // Subscribe to fix:verified events
      const verifyChannel = `fix:verified:${taskId}:${reviewType}` as const;
      const disposeVerify = window.electron.on(verifyChannel, (...args: unknown[]) => {
        // The fix:verified event payload has verification data nested in a verification object
        const payload = args[0] as {
          verification?: FixVerificationResult;
          canRetry?: boolean;
        } | undefined;
        console.log('[ReviewOutputPreview] fix:verified event received:', { reviewType, payload });
        const data = payload?.verification;
        if (data) {
          // Update the message to show verification result
          const resultMessage = data.passed
            ? `${REVIEW_LABELS[reviewType]} verification passed`
            : `${REVIEW_LABELS[reviewType]} verification: ${data.summary ?? 'Issues remain'}`;
          console.log('[ReviewOutputPreview] Setting currentMessage to:', resultMessage);
          setCurrentMessage(resultMessage);

          // Clear the verifying state for this review type
          console.log('[ReviewOutputPreview] Clearing verifying state for:', reviewType);
          clearVerifyingReviewType(taskId, reviewType);

          // Update the fix store with the verification result
          setFixVerified(taskId, reviewType as FixType, {
            preFixScore: data.preFixScore,
            postFixScore: data.postFixScore,
            scoreImprovement: data.scoreImprovement,
            remainingFindingsCount: data.remainingFindings.length,
            passed: data.passed,
            summary: data.summary,
          }, payload?.canRetry ?? false);
        } else {
          console.warn('[ReviewOutputPreview] fix:verified event missing verification data:', payload);
        }
      });
      disposers.push(disposeVerify);

      // Subscribe to fix:progress events to catch VERIFIED_SUCCESS/VERIFIED_FAILED status
      const progressChannel = `fix:progress:${taskId}:${reviewType}` as const;
      const disposeProgress = window.electron.on(progressChannel, (...args: unknown[]) => {
        const data = args[0] as {
          status?: string;
          verification?: FixVerificationResult;
          canRetry?: boolean;
          currentActivity?: { message?: string };
        } | undefined;
        console.log('[ReviewOutputPreview] fix:progress event received:', { reviewType, status: data?.status });

        if (data?.status === 'VERIFIED_SUCCESS' || data?.status === 'VERIFIED_FAILED') {
          // Verification completed via progress event - clear verifying state
          console.log('[ReviewOutputPreview] Clearing verifying state via progress event for:', reviewType);
          clearVerifyingReviewType(taskId, reviewType);

          // Update message from current activity if available
          if (data.currentActivity?.message) {
            setCurrentMessage(data.currentActivity.message);
          }

          // Update fix store if verification data is available
          if (data.verification) {
            const v = data.verification;
            setFixVerified(taskId, reviewType as FixType, {
              preFixScore: v.preFixScore,
              postFixScore: v.postFixScore,
              scoreImprovement: v.scoreImprovement,
              remainingFindingsCount: v.remainingFindings.length,
              passed: v.passed,
              summary: v.summary,
            }, data.canRetry ?? false);
          }
        } else if (data?.status === 'VERIFYING') {
          // Verification started - mark as verifying
          console.log('[ReviewOutputPreview] Setting verifying state via progress event for:', reviewType);
          // Note: We don't set verifying state here as it's handled by the main useFix hook
          // But we can update the message
          if (data.currentActivity?.message) {
            setCurrentMessage(data.currentActivity.message);
          }
        }
      });
      disposers.push(disposeProgress);
    }

    // Fetch initial progress
    window.electron
      .invoke('review:getProgress', taskId)
      .then((result: unknown) => {
        const data = result as ReviewProgressResponse | null;
        if (data?.reviews) {
          const initialProgress: ReviewProgressEvent = {
            taskId: data.taskId,
            status: data.status,
            reviews: data.reviews,
            overallScore: data.overallScore,
          };
          handleProgress(initialProgress);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch review progress:', err);
      });

    return () => {
      for (const disposeFunc of disposers) {
        disposeFunc();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [taskId, handleProgress, clearVerifyingReviewType, setFixVerified]);

  // Update message when verification state changes
  // This effect runs when verifyingReviewTypes changes (when setVerifyingReviewType/clearVerifyingReviewType is called)
  useEffect(() => {
    const verifyingSet = verifyingReviewTypes.get(taskId);
    console.log('[ReviewOutputPreview] verifyingReviewTypes changed:', {
      taskId,
      verifyingSet: verifyingSet ? Array.from(verifyingSet) : null,
      size: verifyingSet?.size ?? 0,
    });
    if (verifyingSet && verifyingSet.size > 0) {
      // Get the first verifying review type and show its message
      const verifyingType = verifyingSet.values().next().value;
      if (verifyingType) {
        setCurrentMessage(`Running ${REVIEW_LABELS[verifyingType]} verification review...`);
      }
    }
    // Note: When verification completes, the fix:verified event handler updates the message
  }, [taskId, verifyingReviewTypes]);

  // Deduplicate reviews by reviewType to prevent duplicate icons during re-review
  // When a verification review runs for a single category, we want to show only one icon
  // Prefer RUNNING status over COMPLETED (latest state), then latest entry
  const uniqueReviews = useMemo(() => {
    if (!progress?.reviews) return [];
    const reviewMap = new Map<ReviewType, (typeof progress.reviews)[0]>();
    for (const review of progress.reviews) {
      const existing = reviewMap.get(review.reviewType);
      // Keep the entry if:
      // 1. We don't have one yet
      // 2. New entry is RUNNING (prefer showing active state)
      // 3. Existing is not RUNNING and we have a new entry (take latest)
      if (!existing || review.status === 'RUNNING' || existing.status !== 'RUNNING') {
        reviewMap.set(review.reviewType, review);
      }
    }
    return Array.from(reviewMap.values());
  }, [progress?.reviews]);

  // Show loading state when progress hasn't been fetched yet
  if (!progress) {
    return (
      <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
          <span className="text-xs font-mono text-zinc-500">Loading review status...</span>
        </div>
      </div>
    );
  }

  // Count completed/total using deduplicated reviews
  const completedCount = uniqueReviews.filter((r) => r.status === 'COMPLETED').length;
  const totalCount = uniqueReviews.length;
  // Check if any verification is running for this task
  const isVerificationRunning = uniqueReviews.some((r) => isReviewTypeVerifying(taskId, r.reviewType));
  // Check if any review is running OR any review type is being re-verified
  // Also consider "in_progress" with no reviews yet as running (reviews are being created)
  const hasRunning = uniqueReviews.some((r) => r.status === 'RUNNING')
    || isVerificationRunning
    || (progress.status === 'in_progress' && totalCount === 0);
  const hasFailed = uniqueReviews.some((r) => r.status === 'FAILED');
  // Only mark as completed if:
  // 1. progress.status is 'completed' AND
  // 2. No verification is running AND
  // 3. There are actually reviews present (prevents showing "Completed" when reviews haven't started yet)
  // 4. All reviews are actually completed (handles race condition where status is stale)
  const isAllCompleted = progress.status === 'completed'
    && !isVerificationRunning
    && totalCount > 0
    && completedCount === totalCount;

  return (
    <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md overflow-hidden">
      {/* Progress indicator with review agent icons */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex gap-1">
          {uniqueReviews.map((review) => {
            // Safely get the icon - fallback to Shield if the review type is not recognized
            const AgentIcon = REVIEW_ICONS[review.reviewType] ?? Shield;
            // Check if this review type is being re-verified (fix verification)
            const isVerifying = isReviewTypeVerifying(taskId, review.reviewType);
            return (
              <div
                key={review.reviewType}
                className={`w-5 h-5 rounded flex items-center justify-center ${
                  isVerifying
                    ? 'bg-blue-500/20 text-blue-400' // Blue during re-verification
                    : review.status === 'COMPLETED'
                      ? 'bg-green-500/20 text-green-400'
                      : review.status === 'FAILED'
                        ? 'bg-red-500/20 text-red-400'
                        : review.status === 'RUNNING'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-zinc-700/50 text-zinc-500'
                }`}
                title={`${REVIEW_LABELS[review.reviewType] ?? review.reviewType}: ${isVerifying ? 'verifying' : review.status.toLowerCase()}`}
              >
                <AgentIcon className="w-3 h-3" />
              </div>
            );
          })}
        </div>
        <span className="text-xs text-zinc-500">
          {completedCount}/{totalCount} reviews
        </span>
        {progress.overallScore !== undefined && isAllCompleted && (
          <span
            className={`text-xs font-medium ${
              progress.overallScore >= 80
                ? 'text-green-400'
                : progress.overallScore >= 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}
          >
            Score: {progress.overallScore}%
          </span>
        )}
      </div>

      {/* Current activity */}
      <div className="flex items-start gap-2 min-w-0">
        <span
          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
            hasFailed
              ? 'bg-red-500'
              : hasRunning
                ? 'bg-blue-500 animate-pulse'
                : isAllCompleted
                  ? 'bg-green-500'
                  : 'bg-zinc-500'
          }`}
        />
        <span
          className={`text-xs font-mono break-words min-w-0 line-clamp-2 ${
            hasFailed ? 'text-red-400' : 'text-zinc-300'
          }`}
          title={currentMessage}
        >
          {currentMessage}
        </span>
      </div>
    </div>
  );
}
