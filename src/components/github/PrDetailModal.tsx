/**
 * PR Detail Modal Component
 *
 * Modal displaying full GitHub Pull Request details including:
 * - PR body/description
 * - Files changed with additions/deletions
 * - Review comments
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  Calendar,
  GitBranch,
  FileText,
  Plus,
  Minus,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';
import type {
  GitHubPullRequest,
  GitHubPRDisplayState,
  GitHubFileChange,
  GitHubReview,
} from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface PrDetailModalProps {
  pr: GitHubPullRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function PrDetailModal({ pr, open, onOpenChange }: PrDetailModalProps) {
  if (!pr) return null;

  // Determine display state
  const getDisplayState = (): GitHubPRDisplayState => {
    if (pr.merged) return 'merged';
    return pr.state as GitHubPRDisplayState;
  };

  const displayState = getDisplayState();

  // Get state badge
  const getStateBadge = () => {
    switch (displayState) {
      case 'open':
        return {
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white',
          icon: <GitPullRequest className="h-4 w-4" />,
          label: 'Open',
        };
      case 'merged':
        return {
          variant: 'default' as const,
          className: 'bg-purple-500 hover:bg-purple-600 text-white',
          icon: <GitMerge className="h-4 w-4" />,
          label: 'Merged',
        };
      case 'closed':
        return {
          variant: 'destructive' as const,
          className: '',
          icon: <XCircle className="h-4 w-4" />,
          label: 'Closed',
        };
    }
  };

  const stateBadge = getStateBadge();

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="space-y-3">
            {/* Title Row */}
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-xl flex-1">
                {pr.title}{' '}
                <span className="text-muted-foreground font-mono">
                  #{pr.number}
                </span>
              </DialogTitle>
              <Badge
                variant={stateBadge.variant}
                className={stateBadge.className}
              >
                <span className="flex items-center gap-1.5">
                  {stateBadge.icon}
                  {stateBadge.label}
                </span>
              </Badge>
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {/* Author */}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={pr.user?.avatar_url} alt={pr.user?.login} />
                  <AvatarFallback>
                    {pr.user?.login?.[0]?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <span>{pr.user?.login ?? 'Unknown'}</span>
              </div>

              {/* Created Date */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(pr.created_at)}</span>
              </div>

              {/* Branch Info */}
              <div className="flex items-center gap-1.5">
                <GitBranch className="h-4 w-4" />
                <span className="font-mono text-xs">
                  {pr.head.ref} → {pr.base.ref}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Tabs Content */}
        <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">
              Files Changed ({pr.changed_files})
            </TabsTrigger>
            {pr.reviews && pr.reviews.length > 0 && (
              <TabsTrigger value="reviews">
                Reviews ({pr.reviews.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-4">
                {/* PR Body */}
                {pr.body ? (
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/50 rounded-lg p-4">
                      <pre className="whitespace-pre-wrap text-sm font-sans">
                        {pr.body}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4 text-center text-sm text-muted-foreground">
                    No description provided
                  </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs">Files</span>
                    </div>
                    <p className="text-2xl font-bold">{pr.changed_files}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs">Comments</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {pr.comments + (pr.review_comments ?? 0)}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-green-600">
                      <Plus className="h-4 w-4" />
                      <span className="text-xs">Additions</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {pr.additions}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-red-600">
                      <Minus className="h-4 w-4" />
                      <span className="text-xs">Deletions</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                      {pr.deletions}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Files Changed Tab */}
          <TabsContent value="files" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-2">
                {pr.files && pr.files.length > 0 ? (
                  pr.files.map((file, index) => (
                    <FileChangeItem key={`${file.filename}-${String(index)}`} file={file} />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No file changes available
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Reviews Tab */}
          {pr.reviews && pr.reviews.length > 0 && (
            <TabsContent value="reviews" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-3">
                  {pr.reviews.map((review, index) => (
                    <ReviewItem key={`${String(review.id)}-${String(index)}`} review={review} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * File Change Item
 */
function FileChangeItem({ file }: { file: GitHubFileChange }) {
  const getStatusBadge = () => {
    switch (file.status) {
      case 'added':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Added
          </Badge>
        );
      case 'removed':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            Removed
          </Badge>
        );
      case 'modified':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Modified
          </Badge>
        );
      case 'renamed':
        return (
          <Badge
            variant="outline"
            className="text-purple-600 border-purple-600"
          >
            Renamed
          </Badge>
        );
      default:
        return <Badge variant="outline">{file.status}</Badge>;
    }
  };

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm truncate" title={file.filename}>
            {file.filename}
          </p>
          {file.previous_filename && (
            <p className="text-xs text-muted-foreground">
              from: {file.previous_filename}
            </p>
          )}
        </div>
        {getStatusBadge()}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-green-600">
          <Plus className="h-3 w-3" />
          {file.additions}
        </span>
        <span className="flex items-center gap-1 text-red-600">
          <Minus className="h-3 w-3" />
          {file.deletions}
        </span>
        <span className="text-muted-foreground">
          {file.changes} change{file.changes !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * Review Item
 */
function ReviewItem({ review }: { review: GitHubReview }) {
  const getReviewIcon = () => {
    switch (review.state) {
      case 'APPROVED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'CHANGES_REQUESTED':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'COMMENTED':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      default:
        return <User className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getReviewLabel = () => {
    switch (review.state) {
      case 'APPROVED':
        return 'Approved';
      case 'CHANGES_REQUESTED':
        return 'Requested changes';
      case 'COMMENTED':
        return 'Commented';
      case 'PENDING':
        return 'Pending';
      default:
        return review.state;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        {getReviewIcon()}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={review.user?.avatar_url}
                  alt={review.user?.login}
                />
                <AvatarFallback>
                  {review.user?.login?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm">{review.user?.login ?? 'Unknown'}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(review.submitted_at)}
            </span>
          </div>
          <p className="text-xs font-medium">{getReviewLabel()}</p>
        </div>
      </div>
      {review.body ? (
        <div className="pl-8">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {review.body}
          </p>
        </div>
      ) : null}
    </div>
  );
}
