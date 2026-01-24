/**
 * Review Results Component
 *
 * Displays review results with accordion-style collapsible sections.
 * Shows findings organized by review type with severity indicators.
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Code,
  Zap,
  FileText,
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Loader2,
  Wand2,
  HelpCircle,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/ipc';
import type {
  ReviewType,
  ReviewFinding,
  FindingSeverity,
  ReviewStatus,
  FixType,
} from '@/types/ipc';
import { cn } from '@/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const REVIEW_ICONS: Record<ReviewType, React.ComponentType<{ className?: string }>> = {
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

const SEVERITY_ICONS: Record<FindingSeverity, React.ComponentType<{ className?: string }>> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle,
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
};

// ============================================================================
// Types
// ============================================================================

interface ReviewData {
  reviewType: ReviewType;
  status: ReviewStatus;
  score?: number;
  summary?: string;
  findings: ReviewFinding[];
  findingsCount: number;
}

interface ReviewResultsProps {
  taskId: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface FindingItemProps {
  finding: ReviewFinding;
}

function FindingItem({ finding }: FindingItemProps) {
  // Use fallback icon if severity is not in the record
  const SeverityIcon = SEVERITY_ICONS[finding.severity] ?? HelpCircle;
  const severityColorClass = SEVERITY_COLORS[finding.severity] ?? 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <div className="flex gap-3 p-3 bg-muted rounded-md">
      <SeverityIcon
        className={cn('h-5 w-5 shrink-0', severityColorClass.split(' ')[0])}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{finding.title}</div>
        <p className="text-sm text-muted-foreground mt-1">
          {finding.description}
        </p>
        {finding.file && (
          <code className="text-xs mt-2 block text-muted-foreground font-mono">
            {finding.file}
            {finding.line !== undefined ? `:${finding.line}` : ''}
          </code>
        )}
      </div>
      <Badge className={cn('shrink-0 h-fit', severityColorClass)}>
        {finding.severity}
      </Badge>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReviewResults({ taskId }: ReviewResultsProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<string[]>([]);
  const [fixingTypes, setFixingTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Fetch review data
    invoke('review:getProgress', taskId)
      .then((progress) => {
        if (progress?.reviews) {
          // Map the progress reviews to ReviewData format
          const reviewData: ReviewData[] = progress.reviews.map((r) => {
            const data: ReviewData = {
              reviewType: r.reviewType,
              status: r.status,
              findings: [], // Findings are fetched on-demand when accordion is expanded
              findingsCount: r.findingsCount,
            };
            if (r.score !== undefined) {
              data.score = r.score;
            }
            if (r.summary !== undefined) {
              data.summary = r.summary;
            }
            return data;
          });
          setReviews(reviewData);
        } else {
          setReviews([]);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch review results:', err);
        setError(
          err instanceof Error ? err : new Error('Failed to load reviews')
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [taskId]);

  // Fetch findings when an accordion is expanded
  const handleAccordionChange = async (values: string[]) => {
    setExpandedReviews(values);

    // Find newly expanded reviews that don't have findings loaded yet
    for (const reviewType of values) {
      const review = reviews.find((r) => r.reviewType === reviewType);
      if (review && review.findings.length === 0 && review.findingsCount > 0) {
        try {
          const findings = await invoke('review:getFindings', {
            taskId,
            reviewType: reviewType as ReviewType,
          });
          if (findings) {
            setReviews((prev) =>
              prev.map((r) =>
                r.reviewType === reviewType ? { ...r, findings } : r
              )
            );
          }
        } catch (err) {
          console.error(`Failed to fetch findings for ${reviewType}:`, err);
        }
      }
    }
  };

  // Handle fix issues button click
  const handleFixIssues = async (reviewType: ReviewType, findings: ReviewFinding[]) => {
    if (!taskId) return;

    // Only allow fixing for review types that support fixes
    const fixableTypes: FixType[] = ['security', 'quality'];
    if (!fixableTypes.includes(reviewType as FixType)) {
      console.warn(`Fix not supported for review type: ${reviewType}`);
      return;
    }

    setFixingTypes((prev) => new Set(prev).add(reviewType));
    try {
      await invoke('fix:start', { taskId, fixType: reviewType as FixType, findings });
    } catch (err) {
      console.error('Failed to start fix:', err);
    } finally {
      setFixingTypes((prev) => {
        const next = new Set(prev);
        next.delete(reviewType);
        return next;
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading reviews...
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center text-sm text-destructive py-8">
        {error.message}
      </div>
    );
  }

  // Empty state
  if (reviews.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No reviews yet
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      className="space-y-2"
      value={expandedReviews}
      onValueChange={handleAccordionChange}
    >
      {reviews.map((review) => {
        // Use fallback icon if reviewType is not in the record
        const Icon = REVIEW_ICONS[review.reviewType] ?? HelpCircle;
        // Use findingsCount from the progress response, not the loaded findings array
        const findingsCount = review.findingsCount;
        const isComplete = review.status === 'COMPLETED';

        // Get score badge variant based on score
        const getScoreVariant = (
          score: number
        ): 'default' | 'secondary' | 'destructive' => {
          if (score >= 80) return 'default';
          if (score >= 60) return 'secondary';
          return 'destructive';
        };

        return (
          <AccordionItem
            key={review.reviewType}
            value={review.reviewType}
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
              <div className="flex items-center gap-3 w-full">
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left capitalize">
                  {REVIEW_LABELS[review.reviewType]}
                </span>
                {!isComplete && review.status === 'RUNNING' && (
                  <Badge variant="secondary" className="mr-2">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Running
                  </Badge>
                )}
                {review.score !== undefined && (
                  <Badge
                    variant={getScoreVariant(review.score)}
                    className="mr-2 tabular-nums"
                  >
                    {review.score}
                  </Badge>
                )}
                <Badge variant="outline" className="tabular-nums">
                  {findingsCount} finding{findingsCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {/* Summary */}
              {review.summary && (
                <p className="text-sm text-muted-foreground mb-4">
                  {review.summary}
                </p>
              )}

              {/* Findings */}
              {findingsCount > 0 && review.findings.length === 0 ? (
                // Findings are being loaded
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading findings...
                  </span>
                </div>
              ) : review.findings.length > 0 ? (
                <div className="space-y-2">
                  {review.findings.map((finding, i) => (
                    <FindingItem key={i} finding={finding} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">No issues found</p>
                </div>
              )}

              {/* Fix Issues Button - only for fixable review types */}
              {review.findingsCount > 0 &&
                review.status === 'COMPLETED' &&
                ['security', 'quality'].includes(review.reviewType) && (
                <div className="mt-4 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleFixIssues(review.reviewType, review.findings || [])
                    }
                    disabled={fixingTypes.has(review.reviewType)}
                    className="gap-2"
                  >
                    {fixingTypes.has(review.reviewType) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Fixing Issues...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Fix Issues
                      </>
                    )}
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
