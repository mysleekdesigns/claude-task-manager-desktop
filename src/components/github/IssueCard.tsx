/**
 * Issue Card Component
 *
 * Displays a GitHub issue in a card format with summary information.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { MessageSquare, Calendar } from 'lucide-react';
import type { GitHubIssue } from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface IssueCardProps {
  issue: GitHubIssue;
  onClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function IssueCard({ issue, onClick }: IssueCardProps) {
  // Format date as relative time
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
      return `${String(diffMins)} min ago`;
    } else if (diffHours < 24) {
      return `${String(diffHours)} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${String(diffDays)} day${diffDays > 1 ? 's' : ''} ago`;
    }
  };

  // Get badge variant for state
  const getStateBadgeVariant = (state: string): 'default' | 'secondary' => {
    return state === 'open' ? 'default' : 'secondary';
  };

  // Get label color with opacity
  const getLabelStyle = (color: string) => {
    return {
      backgroundColor: `#${color}20`,
      borderColor: `#${color}`,
      color: `#${color}`,
    };
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Issue number and title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-muted-foreground font-mono">
                #{issue.number}
              </span>
              <Badge variant={getStateBadgeVariant(issue.state)}>
                {issue.state}
              </Badge>
            </div>
            <h4 className="font-semibold text-base leading-tight line-clamp-2">
              {issue.title}
            </h4>
          </div>

          {/* Author avatar */}
          <Avatar className="h-8 w-8 flex-shrink-0">
            <img
              src={issue.user.avatar_url}
              alt={issue.user.login}
              className="h-full w-full object-cover"
            />
          </Avatar>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {issue.labels.slice(0, 3).map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="text-xs"
                style={getLabelStyle(label.color)}
              >
                {label.name}
              </Badge>
            ))}
            {issue.labels.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{issue.labels.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Assignees */}
        {issue.assignees.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Assigned to:</span>
            <div className="flex -space-x-2">
              {issue.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                  <img
                    src={assignee.avatar_url}
                    alt={assignee.login}
                    className="h-full w-full object-cover"
                  />
                </Avatar>
              ))}
            </div>
            {issue.assignees.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{issue.assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: Created date and comments */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">
              {getTimeAgo(issue.created_at)}
            </span>
          </div>

          {issue.comments > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs">{issue.comments}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
