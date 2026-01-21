/**
 * Issue Detail Modal Component
 *
 * Displays full GitHub issue details including body, comments, and actions.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExternalLink,
  Calendar,
  MessageSquare,
  GitBranch,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GitHubIssue, GitHubIssueComment } from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface IssueDetailModalProps {
  issue: GitHubIssue | null;
  comments?: GitHubIssueComment[];
  isOpen: boolean;
  onClose: () => void;
  onCreateTask?: (issue: GitHubIssue) => void;
  loadingComments?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function IssueDetailModal({
  issue,
  comments = [],
  isOpen,
  onClose,
  onCreateTask,
  loadingComments = false,
}: IssueDetailModalProps) {
  const [creatingTask, setCreatingTask] = useState(false);

  if (!issue) return null;

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

  // Handle create task
  const handleCreateTask = () => {
    if (!onCreateTask) return;

    setCreatingTask(true);
    try {
      onCreateTask(issue);
      onClose();
    } catch (error) {
      console.error('Failed to create task from issue:', error);
    } finally {
      setCreatingTask(false);
    }
  };

  // Get label color style
  const getLabelStyle = (color: string) => {
    return {
      backgroundColor: `#${color}20`,
      borderColor: `#${color}`,
      color: `#${color}`,
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          {/* Issue header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground font-mono">
                    #{issue.number}
                  </span>
                  <Badge variant={issue.state === 'open' ? 'default' : 'secondary'}>
                    {issue.state === 'open' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {issue.state}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl leading-tight">
                  {issue.title}
                </DialogTitle>
              </div>

              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on GitHub"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <img
                    src={issue.user.avatar_url}
                    alt={issue.user.login}
                    className="h-full w-full object-cover"
                  />
                </Avatar>
                <span>
                  <strong>{issue.user.login}</strong> opened this issue
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(issue.created_at)}
              </div>
              {issue.comments > 0 && (
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {issue.comments} comments
                </div>
              )}
            </div>

            {/* Labels and assignees */}
            <div className="flex items-center gap-3 flex-wrap">
              {issue.labels.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {issue.labels.map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="text-xs"
                      style={getLabelStyle(label.color)}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              )}

              {issue.assignees.length > 0 && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Assigned to:</span>
                    <div className="flex -space-x-2">
                      {issue.assignees.map((assignee) => (
                        <Avatar
                          key={assignee.id}
                          className="h-6 w-6 border-2 border-background"
                          title={assignee.login}
                        >
                          <img
                            src={assignee.avatar_url}
                            alt={assignee.login}
                            className="h-full w-full object-cover"
                          />
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments">
                Comments {issue.comments > 0 && `(${String(issue.comments)})`}
              </TabsTrigger>
            </TabsList>

            {/* Details tab */}
            <TabsContent value="details" className="space-y-4 py-4">
              {issue.body ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {issue.body}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No description provided.</p>
              )}
            </TabsContent>

            {/* Comments tab */}
            <TabsContent value="comments" className="space-y-4 py-4">
              {loadingComments ? (
                <div className="text-center py-8">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <img
                            src={comment.user.avatar_url}
                            alt={comment.user.login}
                            className="h-full w-full object-cover"
                          />
                        </Avatar>
                        <strong className="text-sm">{comment.user.login}</strong>
                        <span className="text-xs text-muted-foreground">
                          commented {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <div className="pl-8 prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {comment.body}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <Separator />

        {/* Footer actions */}
        <div className="px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          {onCreateTask && (
            <Button onClick={handleCreateTask} disabled={creatingTask}>
              <GitBranch className="h-4 w-4 mr-2" />
              {creatingTask ? 'Creating Task...' : 'Create Task from Issue'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
