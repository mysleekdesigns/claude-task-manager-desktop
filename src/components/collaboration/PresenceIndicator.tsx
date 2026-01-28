/**
 * PresenceIndicator Component
 *
 * Small indicator dot showing user online/offline status.
 * Animates when user comes online.
 */

import { cn } from '@/lib/utils';
import type { PresenceStatus } from '@/types/presence';

/**
 * Size variants for the indicator
 */
export type PresenceIndicatorSize = 'sm' | 'md' | 'lg';

/**
 * Props for the PresenceIndicator component
 */
export interface PresenceIndicatorProps {
  /** User's presence status */
  status: PresenceStatus;
  /** Size of the indicator (default: 'sm') */
  size?: PresenceIndicatorSize;
  /** Whether to show the pulse animation (default: true for online) */
  showPulse?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Size classes for each variant
 */
const sizeClasses: Record<PresenceIndicatorSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

/**
 * Status color classes
 */
const statusClasses: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

/**
 * Pulse animation for online status
 */
const pulseClasses: Record<PresenceStatus, string> = {
  online: 'animate-pulse',
  away: '',
  offline: '',
};

/**
 * PresenceIndicator component displaying online/away/offline status
 */
export function PresenceIndicator({
  status,
  size = 'sm',
  showPulse = true,
  className,
}: PresenceIndicatorProps) {
  const shouldPulse = showPulse && status === 'online';

  return (
    <span
      className={cn(
        'inline-block rounded-full ring-2 ring-background',
        sizeClasses[size],
        statusClasses[status],
        shouldPulse && pulseClasses[status],
        className
      )}
      aria-label={`Status: ${status}`}
      role="status"
    />
  );
}

export default PresenceIndicator;
