/**
 * Review Output Preview Component
 *
 * Displays real-time AI review progress on task cards.
 * Shows the status of each review agent (security, quality, performance, etc.)
 * and the current activity message.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, Code, Zap, FileText, Search } from 'lucide-react';
import type { ReviewType, ReviewProgressResponse, ReviewStatus } from '@/types/ipc';

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
  const [activeReviewType, setActiveReviewType] = useState<ReviewType | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleProgress = useCallback((data: ReviewProgressEvent) => {
    // Debounce rapid updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setProgress(data);

      if (data.currentActivity) {
        setCurrentMessage(data.currentActivity.message);
        setActiveReviewType(data.currentActivity.reviewType);
      } else {
        // Find the first running review
        const running = data.reviews.find((r) => r.status === 'RUNNING');
        if (running) {
          setCurrentMessage(`${REVIEW_LABELS[running.reviewType]} review in progress...`);
          setActiveReviewType(running.reviewType);
        } else {
          // Check if all completed
          const allCompleted = data.reviews.every((r) => r.status === 'COMPLETED');
          if (allCompleted && data.reviews.length > 0) {
            setCurrentMessage('All reviews completed');
            setActiveReviewType(null);
          }
        }
      }
    }, 50);
  }, []);

  useEffect(() => {
    // Subscribe to review progress events
    const channel = `review:progress:${taskId}` as const;
    const dispose = window.electron.on(channel, (...args: unknown[]) => {
      const data = args[0] as ReviewProgressEvent | undefined;
      if (data?.reviews) {
        handleProgress(data);
      }
    });

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
      dispose();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [taskId, handleProgress]);

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

  // Count completed/total
  const completedCount = progress.reviews.filter((r) => r.status === 'COMPLETED').length;
  const totalCount = progress.reviews.length;
  const hasRunning = progress.reviews.some((r) => r.status === 'RUNNING');
  const hasFailed = progress.reviews.some((r) => r.status === 'FAILED');
  const isAllCompleted = progress.status === 'completed';

  // Safely get the icon - fallback to Shield if the review type is not recognized
  const Icon = activeReviewType && REVIEW_ICONS[activeReviewType]
    ? REVIEW_ICONS[activeReviewType]
    : Shield;

  return (
    <div className="mt-2 p-2 bg-zinc-900/95 border border-zinc-800 rounded-md overflow-hidden">
      {/* Progress indicator with review agent icons */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex gap-1">
          {progress.reviews.map((review) => {
            // Safely get the icon - fallback to Shield if the review type is not recognized
            const AgentIcon = REVIEW_ICONS[review.reviewType] ?? Shield;
            return (
              <div
                key={review.reviewType}
                className={`w-5 h-5 rounded flex items-center justify-center ${
                  review.status === 'COMPLETED'
                    ? 'bg-green-500/20 text-green-400'
                    : review.status === 'FAILED'
                      ? 'bg-red-500/20 text-red-400'
                      : review.status === 'RUNNING'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-700/50 text-zinc-500'
                }`}
                title={`${REVIEW_LABELS[review.reviewType] ?? review.reviewType}: ${review.status.toLowerCase()}`}
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
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3 h-3 text-zinc-400 flex-shrink-0" />
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
    </div>
  );
}
