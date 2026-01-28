/**
 * Task Card Highlight Component
 *
 * Wrapper component that adds highlight animation effects to task cards
 * when they have been recently updated. Uses CSS animations for performance.
 */

import { memo, useEffect, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TaskUpdateType } from '@/hooks/useTaskRealtimeUpdates';

// ============================================================================
// Types
// ============================================================================

interface TaskCardHighlightProps {
  /** The task card content to wrap */
  children: ReactNode;
  /** Whether this task should be highlighted */
  isHighlighted: boolean;
  /** Type of update (affects animation style) */
  updateType?: TaskUpdateType | undefined;
  /** Duration of the highlight animation in milliseconds */
  highlightDuration?: number | undefined;
  /** Callback when the highlight animation ends */
  onHighlightEnd?: (() => void) | undefined;
  /** Additional class names */
  className?: string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Default duration for the highlight effect */
const DEFAULT_HIGHLIGHT_DURATION = 3000;

// ============================================================================
// Component
// ============================================================================

function TaskCardHighlightComponent({
  children,
  isHighlighted,
  updateType = 'updated',
  highlightDuration = DEFAULT_HIGHLIGHT_DURATION,
  onHighlightEnd,
  className,
}: TaskCardHighlightProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(isHighlighted);

  // Start animation when highlight becomes active
  useEffect(() => {
    if (isHighlighted) {
      setIsAnimating(true);
      setShouldRender(true);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        onHighlightEnd?.();
      }, highlightDuration);

      return () => clearTimeout(timer);
    } else {
      // Allow exit animation to complete before removing render state
      const exitTimer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match exit animation duration

      return () => clearTimeout(exitTimer);
    }
  }, [isHighlighted, highlightDuration, onHighlightEnd]);

  // Get animation classes based on update type
  const getAnimationClass = useCallback(() => {
    if (!isAnimating && !isHighlighted) {
      return '';
    }

    switch (updateType) {
      case 'created':
        return 'animate-task-fade-in';
      case 'deleted':
        return 'animate-task-fade-out';
      case 'moved':
        return 'animate-task-move-highlight';
      case 'updated':
      default:
        return 'animate-task-highlight';
    }
  }, [updateType, isAnimating, isHighlighted]);

  // Get glow effect classes based on update type
  const getGlowClass = useCallback(() => {
    if (!shouldRender || !isAnimating) {
      return '';
    }

    switch (updateType) {
      case 'created':
        return 'ring-2 ring-green-400/50 shadow-[0_0_20px_rgba(74,222,128,0.3)]';
      case 'deleted':
        return 'ring-2 ring-red-400/50 shadow-[0_0_20px_rgba(248,113,113,0.3)]';
      case 'moved':
        return 'ring-2 ring-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.3)]';
      case 'updated':
      default:
        return 'ring-2 ring-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.3)]';
    }
  }, [updateType, shouldRender, isAnimating]);

  return (
    <div
      className={cn(
        'relative transition-all duration-300 rounded-lg',
        getAnimationClass(),
        getGlowClass(),
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

/**
 * Memoized TaskCardHighlight component.
 * Re-renders when highlight state or children change.
 */
export const TaskCardHighlight = memo(TaskCardHighlightComponent);

export default TaskCardHighlight;
