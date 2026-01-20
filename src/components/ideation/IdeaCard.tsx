/**
 * IdeaCard Component (Phase 13.2)
 *
 * Displays an idea with voting buttons, status badge, and convert to feature action.
 */

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  MoreVertical,
  Trash2,
  User,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Idea, IdeaStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface IdeaCardProps {
  idea: Idea;
  onVote: (ideaId: string, delta: number) => Promise<void>;
  onConvert: (ideaId: string) => Promise<void>;
  onDelete: (ideaId: string) => Promise<void>;
  isVoting?: boolean;
  isConverting?: boolean;
  isDeleting?: boolean;
}

// ============================================================================
// Status Badge Configuration
// ============================================================================

const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'default' },
  APPROVED: { label: 'Approved', variant: 'outline' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  CONVERTED: { label: 'Converted', variant: 'outline' },
};

// ============================================================================
// Component
// ============================================================================

export function IdeaCard({
  idea,
  onVote,
  onConvert,
  onDelete,
  isVoting,
  isConverting,
  isDeleting,
}: IdeaCardProps) {
  const [votingDirection, setVotingDirection] = useState<'up' | 'down' | null>(null);

  const statusConfig = STATUS_CONFIG[idea.status];
  const canConvert = idea.status === 'APPROVED';
  const canDelete = idea.status !== 'CONVERTED';

  const handleVote = async (delta: number) => {
    setVotingDirection(delta > 0 ? 'up' : 'down');
    try {
      await onVote(idea.id, delta);
    } finally {
      setVotingDirection(null);
    }
  };

  const handleConvert = async () => {
    await onConvert(idea.id);
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${idea.title}"? This action cannot be undone.`
      )
    ) {
      await onDelete(idea.id);
    }
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{idea.title}</h3>
            <Badge variant={statusConfig.variant} className="mt-2">
              {statusConfig.label}
            </Badge>
          </div>

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isDeleting}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canConvert && (
                <>
                  <DropdownMenuItem
                    onClick={handleConvert}
                    disabled={!!isConverting}
                    className="cursor-pointer"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Convert to Feature
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={!!isDeleting}
                  className="text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        {idea.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {idea.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description provided</p>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-3 border-t">
        {/* Vote Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVote(1)}
            disabled={isVoting}
            className={votingDirection === 'up' ? 'bg-green-50 dark:bg-green-950' : ''}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            <span className="font-semibold">{idea.votes > 0 ? idea.votes : 0}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVote(-1)}
            disabled={isVoting}
            className={votingDirection === 'down' ? 'bg-red-50 dark:bg-red-950' : ''}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {idea.createdBy && (
            <div className="flex items-center gap-1" title={idea.createdBy.email}>
              <User className="h-3 w-3" />
              <span className="truncate max-w-[100px]">
                {idea.createdBy.name || idea.createdBy.email}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1" title={idea.createdAt}>
            <Calendar className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
