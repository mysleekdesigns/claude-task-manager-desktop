/**
 * Phase Badge Component
 *
 * Displays the PRD phase number and name when a task is phase-scoped.
 * Uses a distinct purple/violet color to distinguish from status badges.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PhaseBadgeProps {
  phaseNumber: number | null | undefined;
  phaseName: string | null | undefined;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters for truncated phase name */
const MAX_NAME_LENGTH = 12;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncates a phase name to fit within the badge.
 * Adds ellipsis if the name exceeds MAX_NAME_LENGTH.
 */
const truncatePhaseName = (name: string): string => {
  if (name.length <= MAX_NAME_LENGTH) {
    return name;
  }
  return `${name.slice(0, MAX_NAME_LENGTH - 1)}...`;
};

/**
 * Formats the badge label based on phase number and name.
 * Examples: "Phase 1", "Phase 3: Auth"
 */
const formatPhaseLabel = (
  phaseNumber: number,
  phaseName: string | null | undefined
): string => {
  const baseLabel = `Phase ${String(phaseNumber)}`;

  if (!phaseName) {
    return baseLabel;
  }

  return `${baseLabel}: ${truncatePhaseName(phaseName)}`;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Badge component that displays PRD phase information.
 * Renders nothing if phaseNumber is null or undefined.
 */
export function PhaseBadge({ phaseNumber, phaseName, className }: PhaseBadgeProps) {
  // Don't render if no phase number is set
  if (phaseNumber === null || phaseNumber === undefined) {
    return null;
  }

  const label = formatPhaseLabel(phaseNumber, phaseName);

  // Build full title for tooltip (shows full name if truncated)
  const fullTitle = phaseName
    ? `Phase ${String(phaseNumber)}: ${phaseName}`
    : `Phase ${String(phaseNumber)}`;

  return (
    <Badge
      variant="outline"
      className={cn(
        // Purple/violet styling to distinguish from other badges
        'border-violet-300 bg-violet-50 text-violet-700',
        'dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300',
        'text-xs',
        className
      )}
      title={fullTitle}
    >
      {label}
    </Badge>
  );
}
