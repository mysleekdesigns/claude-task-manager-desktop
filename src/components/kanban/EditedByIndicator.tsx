/**
 * Edited By Indicator Component
 *
 * Displays a small indicator showing who recently edited a task.
 * Shows an avatar and name, and automatically fades out after a configurable duration.
 */

import { memo, useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { TaskEditor } from '@/hooks/useTaskRealtimeUpdates';

// ============================================================================
// Types
// ============================================================================

interface EditedByIndicatorProps {
  /** The editor information to display */
  editor: TaskEditor;
  /** Duration before the indicator fades out (in milliseconds) */
  fadeOutDelay?: number;
  /** Callback when the indicator has completely faded out */
  onFadeOut?: () => void;
  /** Additional class names */
  className?: string;
  /** Variant for positioning */
  variant?: 'inline' | 'floating';
}

// ============================================================================
// Constants
// ============================================================================

/** Default delay before fade out begins */
const DEFAULT_FADE_OUT_DELAY = 2500;

/** Duration of the fade animation */
const FADE_ANIMATION_DURATION = 500;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from a name for avatar fallback
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ============================================================================
// Component
// ============================================================================

function EditedByIndicatorComponent({
  editor,
  fadeOutDelay = DEFAULT_FADE_OUT_DELAY,
  onFadeOut,
  className,
  variant = 'floating',
}: EditedByIndicatorProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  // Handle fade out timing
  useEffect(() => {
    // Start fade animation
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, fadeOutDelay);

    // Complete fade and trigger callback
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onFadeOut?.();
    }, fadeOutDelay + FADE_ANIMATION_DURATION);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [fadeOutDelay, onFadeOut]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Get display name (truncate if too long)
  const displayName = editor.name.length > 12
    ? `${editor.name.slice(0, 12)}...`
    : editor.name;

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-500',
          isFading && 'opacity-0',
          className
        )}
      >
        <Avatar className="h-4 w-4">
          <AvatarImage src={editor.avatar} alt={editor.name} />
          <AvatarFallback className="text-[8px] bg-muted">
            {getInitials(editor.name)}
          </AvatarFallback>
        </Avatar>
        <span className="italic">Edited by {displayName}</span>
      </div>
    );
  }

  // Floating variant (positioned at bottom-right of parent)
  return (
    <div
      className={cn(
        'absolute bottom-1 right-1 z-10',
        'flex items-center gap-1.5 px-2 py-1 rounded-full',
        'bg-background/90 backdrop-blur-sm border border-border shadow-sm',
        'text-xs text-muted-foreground',
        'transition-all duration-500 ease-in-out',
        'animate-edited-by-enter',
        isFading && 'opacity-0 translate-y-1',
        className
      )}
    >
      <Avatar className="h-4 w-4 ring-1 ring-border">
        <AvatarImage src={editor.avatar} alt={editor.name} />
        <AvatarFallback className="text-[8px] bg-muted text-foreground">
          {getInitials(editor.name)}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium whitespace-nowrap">
        {displayName}
      </span>
    </div>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

/**
 * Memoized EditedByIndicator component.
 * Re-renders when editor information changes.
 */
export const EditedByIndicator = memo(
  EditedByIndicatorComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.editor.id === nextProps.editor.id &&
      prevProps.editor.name === nextProps.editor.name &&
      prevProps.editor.avatar === nextProps.editor.avatar &&
      prevProps.variant === nextProps.variant
    );
  }
);

export default EditedByIndicator;
