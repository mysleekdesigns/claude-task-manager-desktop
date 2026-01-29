/**
 * Human Review Details Component
 *
 * Displays AI review results when a human reviewer clicks on a task card
 * in HUMAN_REVIEW status. Shows findings grouped by severity with
 * copy-to-clipboard functionality in multiple formats.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Code,
  Zap,
  FileText,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Loader2,
  ExternalLink,
  HelpCircle,
  User,
  Copy,
  Check,
  ChevronDown,
  Globe,
  Code2,
  Github,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { invoke } from '@/lib/ipc';
import { CopyReviewButton } from './CopyReviewButton';
import { cn } from '@/lib/utils';
import type {
  Task,
  ReviewType,
  ReviewFinding,
  FindingSeverity,
  ReviewStatus,
  HumanReview,
} from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const REVIEW_ICONS: Record<
  ReviewType,
  React.ComponentType<{ className?: string }>
> = {
  security: Shield,
  quality: Code,
  performance: Zap,
  documentation: FileText,
  research: Search,
};

const REVIEW_LABELS: Record<ReviewType, string> = {
  security: 'Security',
  quality: 'Code Quality',
  performance: 'Performance',
  documentation: 'Documentation',
  research: 'Research',
};

const SEVERITY_ICONS: Record<
  FindingSeverity,
  React.ComponentType<{ className?: string }>
> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical:
    'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  high: 'text-red-500 bg-red-500/10 dark:bg-red-500/20 dark:text-red-400 border-red-500/30 dark:border-red-500/40',
  medium:
    'text-amber-500 bg-amber-500/10 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/40',
  low: 'text-green-500 bg-green-500/10 dark:bg-green-500/20 dark:text-green-400 border-green-500/30 dark:border-green-500/40',
};

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  quality: 'Quality',
  performance: 'Performance',
  documentation: 'Documentation',
  research: 'Research',
};

// ============================================================================
// Types
// ============================================================================

type HumanReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

interface ReviewWithFindings {
  reviewType: ReviewType;
  status: ReviewStatus;
  score?: number;
  summary?: string;
  findings: ReviewFinding[];
  findingsCount: number;
}

interface HumanReviewDetailsProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'lg';
  className?: string;
}

function ScoreBadge({ score, size = 'sm', className }: ScoreBadgeProps) {
  const getScoreColor = (s: number): string => {
    if (s >= 80)
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s >= 60)
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-lg',
          getScoreColor(score),
          className
        )}
      >
        <span>{score}</span>
        <span className="text-sm font-normal opacity-75">/100</span>
      </div>
    );
  }

  return <Badge className={cn(getScoreColor(score), className)}>{score}</Badge>;
}

interface ReviewStatusBadgeProps {
  status: HumanReviewStatus;
}

function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  const config: Record<
    HumanReviewStatus,
    { label: string; variant: 'default' | 'secondary' | 'outline' }
  > = {
    PENDING: { label: 'Pending', variant: 'secondary' },
    IN_PROGRESS: { label: 'In Progress', variant: 'default' },
    COMPLETED: { label: 'Completed', variant: 'outline' },
  };

  const { label, variant } = config[status] || config.PENDING;

  return <Badge variant={variant}>{label}</Badge>;
}

interface FindingCardProps {
  finding: ReviewFinding;
  category: ReviewType;
}

/**
 * Formats a single finding for copying to clipboard in a format suitable for an AI agent.
 */
function formatSingleFinding(finding: ReviewFinding): string {
  const location = finding.file
    ? `${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}`
    : '';

  const lines: string[] = [];
  lines.push(`Fix this ${finding.severity} issue:`);
  lines.push('');
  if (location) {
    lines.push(`Location: ${location}`);
  }
  lines.push(`Issue: ${finding.title}`);
  lines.push(`Description: ${finding.description}`);

  return lines.join('\n');
}

function FindingCard({ finding, category }: FindingCardProps) {
  const [copied, setCopied] = useState(false);
  const SeverityIcon = SEVERITY_ICONS[finding.severity] || HelpCircle;
  const severityColor =
    SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.medium;

  const handleFileClick = useCallback(() => {
    // Copy the file location to clipboard
    const location = finding.file
      ? `${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}`
      : '';
    if (location) {
      navigator.clipboard.writeText(location).catch(console.error);
    }
  }, [finding.file, finding.line]);

  const handleCopyFinding = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const content = formatSingleFinding(finding);

      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        toast.success('Finding copied to clipboard');

        // Reset after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (err) {
        console.error('Failed to copy finding:', err);
        toast.error('Failed to copy to clipboard');
      }
    },
    [finding]
  );

  const handleResearch = useCallback(
    async (searchType: 'google' | 'stackoverflow' | 'github') => {
      // Build the finding data, only including optional fields if they have values
      const findingData: {
        title: string;
        description: string;
        severity: string;
        category:
          | 'security'
          | 'quality'
          | 'performance'
          | 'documentation'
          | 'research';
        file?: string;
        line?: number;
      } = {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: category as
          | 'security'
          | 'quality'
          | 'performance'
          | 'documentation'
          | 'research',
      };

      // Only add file/line if they are defined
      if (finding.file) {
        findingData.file = finding.file;
      }
      if (finding.line !== undefined) {
        findingData.line = finding.line;
      }

      try {
        switch (searchType) {
          case 'google':
            await invoke('research:searchSolution', findingData);
            break;
          case 'stackoverflow':
            await invoke('research:searchStackOverflow', findingData);
            break;
          case 'github':
            await invoke('research:searchGitHub', findingData);
            break;
        }
        toast.success('Opening search...');
      } catch (err) {
        console.error(`Failed to open ${searchType} search:`, err);
        toast.error(
          `Failed to open search: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [finding, category]
  );

  return (
    <div className={cn('p-4 rounded-lg border w-full', severityColor)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <SeverityIcon className="h-5 w-5 shrink-0" />
          <span className="font-medium text-sm truncate">{finding.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Copy and Research button group */}
          <div className="flex items-center">
            <button
              onClick={handleCopyFinding}
              className={cn(
                'p-1 rounded-l hover:bg-black/10 dark:hover:bg-white/10 transition-colors',
                copied && 'text-green-600 dark:text-green-400'
              )}
              title="Copy finding for AI agent"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4 opacity-60 hover:opacity-100" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded-r hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center"
                  title="Research solutions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Search className="h-4 w-4 opacity-60 hover:opacity-100" />
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={() => handleResearch('google')}>
                  <Globe className="h-4 w-4 mr-2" />
                  Search Google
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleResearch('stackoverflow')}
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  Search Stack Overflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleResearch('github')}>
                  <Github className="h-4 w-4 mr-2" />
                  Search GitHub
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[category] || category}
          </Badge>
          <Badge className={cn('text-xs', severityColor)}>
            {SEVERITY_LABELS[finding.severity]}
          </Badge>
        </div>
      </div>

      {/* File Location */}
      {finding.file && (
        <button
          onClick={handleFileClick}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-2"
          title="Click to copy location"
        >
          <ExternalLink className="h-3 w-3" />
          <span>
            {finding.file}
            {finding.line !== undefined ? `:${finding.line}` : ''}
          </span>
        </button>
      )}

      {/* Description */}
      <p className="text-sm leading-relaxed">{finding.description}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HumanReviewDetails({
  task,
  isOpen,
  onClose,
}: HumanReviewDetailsProps) {
  const [reviews, setReviews] = useState<ReviewWithFindings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallScore, setOverallScore] = useState<number | undefined>();
  const [humanReview, setHumanReview] = useState<HumanReview | null>(null);

  // Fetch review data when task changes or sheet opens
  useEffect(() => {
    if (!task || !isOpen) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch human review data (includes reviewer)
        const humanReviewData = await invoke('humanReview:get', task.id);
        setHumanReview(humanReviewData);

        // Fetch review progress
        const progress = await invoke('review:getProgress', task.id);

        if (progress?.reviews) {
          // Fetch findings for each review
          const reviewsData: ReviewWithFindings[] = [];

          for (const review of progress.reviews) {
            let findings: ReviewFinding[] = [];

            if (review.status === 'COMPLETED' && review.findingsCount > 0) {
              try {
                const fetchedFindings = await invoke('review:getFindings', {
                  taskId: task.id,
                  reviewType: review.reviewType,
                });
                findings = fetchedFindings || [];
              } catch (err) {
                console.error(
                  `Failed to fetch findings for ${review.reviewType}:`,
                  err
                );
              }
            }

            const reviewItem: ReviewWithFindings = {
              reviewType: review.reviewType,
              status: review.status,
              findings,
              findingsCount: review.findingsCount,
            };
            if (review.score !== undefined) {
              reviewItem.score = review.score;
            }
            if (review.summary !== undefined) {
              reviewItem.summary = review.summary;
            }
            reviewsData.push(reviewItem);
          }

          setReviews(reviewsData);
          setOverallScore(progress.overallScore);
        } else {
          setReviews([]);
          setOverallScore(undefined);
        }
      } catch (err) {
        console.error('Failed to fetch review data:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load review data'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [task, isOpen]);

  // Group all findings by severity
  const findingsBySeverity = useMemo(() => {
    const grouped = new Map<
      FindingSeverity,
      Array<{ finding: ReviewFinding; category: ReviewType }>
    >();

    for (const severity of SEVERITY_ORDER) {
      grouped.set(severity, []);
    }

    for (const review of reviews) {
      for (const finding of review.findings) {
        const list = grouped.get(finding.severity);
        if (list) {
          list.push({ finding, category: review.reviewType });
        }
      }
    }

    return grouped;
  }, [reviews]);

  // Count findings by severity
  const findingsCounts = useMemo(() => {
    const counts: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const [severity, items] of findingsBySeverity) {
      counts[severity] = items.length;
    }

    return counts;
  }, [findingsBySeverity]);

  const totalFindings = Object.values(findingsCounts).reduce(
    (a, b) => a + b,
    0
  );

  // Prepare data for copy button
  const copyData = useMemo(() => {
    const data: {
      taskTitle: string;
      taskDescription?: string;
      overallScore?: number;
      reviews: Array<{
        reviewType: ReviewType;
        score?: number;
        summary?: string;
        findings: ReviewFinding[];
      }>;
    } = {
      taskTitle: task?.title || '',
      reviews: reviews.map((r) => {
        const reviewItem: {
          reviewType: ReviewType;
          score?: number;
          summary?: string;
          findings: ReviewFinding[];
        } = {
          reviewType: r.reviewType,
          findings: r.findings,
        };
        if (r.score !== undefined) {
          reviewItem.score = r.score;
        }
        if (r.summary !== undefined) {
          reviewItem.summary = r.summary;
        }
        return reviewItem;
      }),
    };
    if (task?.description) {
      data.taskDescription = task.description;
    }
    if (overallScore !== undefined) {
      data.overallScore = overallScore;
    }
    return data;
  }, [task?.title, task?.description, overallScore, reviews]);

  // Handle keyboard shortcut (Cmd/Ctrl+Shift+C)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        // Trigger the copy button's dropdown
        const copyButton = document.querySelector('[data-copy-review-button]');
        if (copyButton instanceof HTMLElement) {
          copyButton.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!task) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0 h-full max-h-screen"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold line-clamp-2">
                {task.title}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground mt-1">
                Review AI findings before marking complete
              </SheetDescription>
            </div>
            {!isLoading && reviews.length > 0 && (
              <CopyReviewButton reviewData={copyData} className="shrink-0" />
            )}
          </div>

          {/* Summary Badges */}
          {!isLoading && reviews.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {overallScore !== undefined && (
                <ScoreBadge score={overallScore} size="lg" />
              )}
              <div className="flex flex-wrap gap-1.5">
                {SEVERITY_ORDER.map((severity) => {
                  const count = findingsCounts[severity];
                  if (count === 0) return null;

                  const severityColor = SEVERITY_COLORS[severity]
                    .split(' ')
                    .slice(0, 2)
                    .join(' ');
                  return (
                    <Badge
                      key={severity}
                      className={cn('text-xs', severityColor)}
                    >
                      {count} {SEVERITY_LABELS[severity]}
                    </Badge>
                  );
                })}
                {totalFindings === 0 && (
                  <Badge variant="outline" className="text-xs">
                    No issues
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Assigned Reviewer */}
          {humanReview?.reviewer && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              <Avatar className="h-8 w-8">
                {humanReview.reviewer.avatar && (
                  <AvatarImage
                    src={humanReview.reviewer.avatar}
                    alt={humanReview.reviewer.name || ''}
                  />
                )}
                <AvatarFallback>
                  {humanReview.reviewer.name
                    ? humanReview.reviewer.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : (humanReview.reviewer.email[0] ?? '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {humanReview.reviewer.name || humanReview.reviewer.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assigned Reviewer
                </p>
              </div>
              <ReviewStatusBadge status={humanReview.status} />
            </div>
          )}

          {!humanReview?.reviewer && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-sm">No reviewer assigned</span>
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading review results...
                </span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No review results available.
                </p>
              </div>
            ) : (
              <>
                {/* Review Type Scores */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Review Scores</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {reviews.map((review) => {
                      const Icon =
                        REVIEW_ICONS[review.reviewType] || HelpCircle;
                      return (
                        <div
                          key={review.reviewType}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {REVIEW_LABELS[review.reviewType]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.score !== undefined && (
                              <ScoreBadge score={review.score} />
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs tabular-nums"
                            >
                              {review.findingsCount}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Findings Grouped by Severity */}
                <Accordion
                  type="single"
                  collapsible
                  className="space-y-2 w-full"
                >
                  {SEVERITY_ORDER.map((severity) => {
                    const items = findingsBySeverity.get(severity) || [];
                    if (items.length === 0) return null;

                    const SeverityIcon = SEVERITY_ICONS[severity];

                    return (
                      <AccordionItem
                        key={severity}
                        value={severity}
                        className="border rounded-lg w-full overflow-hidden"
                      >
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <SeverityIcon
                              className={cn(
                                'h-4 w-4',
                                SEVERITY_COLORS[severity].split(' ')[0]
                              )}
                            />
                            <span className="text-sm font-semibold">
                              {SEVERITY_LABELS[severity]} Issues ({items.length}
                              )
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-3">
                            {items.map((item, index) => (
                              <FindingCard
                                key={`${item.category}-${index}`}
                                finding={item.finding}
                                category={item.category}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>

                {/* No findings message */}
                {totalFindings === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                    <h3 className="font-medium text-lg">All Checks Passed</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      No issues were found during the AI review.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
