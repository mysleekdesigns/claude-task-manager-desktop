/**
 * PR Card Component
 *
 * Individual card displaying GitHub Pull Request summary.
 * Shows PR number, title, state, branch info, review status, and created date.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  GitPullRequest,
  GitMerge,
  Clock,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { GitHubPullRequest, GitHubPRDisplayState } from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface PrCardProps {
  pr: GitHubPullRequest;
  onClick?: (() => void) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function PrCard({ pr, onClick }: PrCardProps) {
  // Determine display state
  const getDisplayState = (): GitHubPRDisplayState => {
    if (pr.merged) return 'merged';
    return pr.state as GitHubPRDisplayState;
  };

  const displayState = getDisplayState();

  // Get state badge variant and icon
  const getStateBadge = () => {
    switch (displayState) {
      case 'open':
        return {
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white',
          icon: <GitPullRequest className="h-3 w-3" />,
          label: 'Open',
        };
      case 'merged':
        return {
          variant: 'default' as const,
          className: 'bg-purple-500 hover:bg-purple-600 text-white',
          icon: <GitMerge className="h-3 w-3" />,
          label: 'Merged',
        };
      case 'closed':
        return {
          variant: 'destructive' as const,
          className: '',
          icon: <XCircle className="h-3 w-3" />,
          label: 'Closed',
        };
    }
  };

  const stateBadge = getStateBadge();

  // Format time ago
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  };

  // Get review status
  const getReviewStatus = () => {
    if (!pr.reviews || pr.reviews.length === 0) {
      return null;
    }

    // Check for the most relevant review state
    const hasApproved = pr.reviews.some((r) => r.state === 'APPROVED');
    const hasChangesRequested = pr.reviews.some(
      (r) => r.state === 'CHANGES_REQUESTED'
    );

    if (hasChangesRequested) {
      return {
        icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" />,
        label: 'Changes requested',
      };
    }

    if (hasApproved) {
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
        label: 'Approved',
      };
    }

    return null;
  };

  const reviewStatus = getReviewStatus();

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top Row: PR Number + State Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm font-mono">#{pr.number}</span>
          </div>
          <Badge variant={stateBadge.variant} className={stateBadge.className}>
            <span className="flex items-center gap-1">
              {stateBadge.icon}
              {stateBadge.label}
            </span>
          </Badge>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-base leading-tight">{pr.title}</h4>

        {/* Branch Info: head → base */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
            {pr.head.ref}
          </span>
          <span>→</span>
          <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
            {pr.base.ref}
          </span>
        </div>

        {/* Review Status (if any) */}
        {reviewStatus && (
          <div className="flex items-center gap-1.5">
            {reviewStatus.icon}
            <span className="text-xs text-muted-foreground">
              {reviewStatus.label}
            </span>
          </div>
        )}

        {/* Bottom Row: Author, Stats, Time */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          {/* Left Side: Author */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={pr.user?.avatar_url} alt={pr.user?.login} />
              <AvatarFallback>{pr.user?.login?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {pr.user?.login ?? 'Unknown'}
            </span>
          </div>

          {/* Right Side: Stats + Time */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {/* Comments */}
            {(pr.comments > 0 || (pr.review_comments ?? 0) > 0) && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{pr.comments + (pr.review_comments ?? 0)}</span>
              </div>
            )}

            {/* Files Changed */}
            {pr.changed_files > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{pr.changed_files}</span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{getTimeAgo(pr.created_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
