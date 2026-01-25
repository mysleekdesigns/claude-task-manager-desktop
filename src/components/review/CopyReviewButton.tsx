/**
 * Copy Review Button Component
 *
 * A reusable button with format dropdown for copying AI review results
 * to the clipboard in different formats (Plain Text, Markdown, AI Agent).
 */

import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { ReviewFinding, FindingSeverity, ReviewType } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

export type CopyFormat = 'plain' | 'markdown' | 'agent';

interface ReviewData {
  taskTitle: string;
  taskDescription?: string;
  overallScore?: number;
  reviews: Array<{
    reviewType: ReviewType;
    score?: number;
    summary?: string;
    findings: ReviewFinding[];
  }>;
}

interface CopyReviewButtonProps {
  reviewData: ReviewData;
  className?: string;
}

// ============================================================================
// Format Helpers
// ============================================================================

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'CRITICAL ISSUES',
  high: 'HIGH PRIORITY',
  medium: 'MEDIUM PRIORITY',
  low: 'LOW PRIORITY',
};

function groupFindingsBySeverity(findings: ReviewFinding[]): Map<FindingSeverity, ReviewFinding[]> {
  const grouped = new Map<FindingSeverity, ReviewFinding[]>();
  for (const severity of SEVERITY_ORDER) {
    grouped.set(severity, []);
  }
  for (const finding of findings) {
    const list = grouped.get(finding.severity);
    if (list) {
      list.push(finding);
    }
  }
  return grouped;
}

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

function countFindingsBySeverity(findings: ReviewFinding[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    counts[finding.severity] = counts[finding.severity] + 1;
  }
  return counts;
}

// ============================================================================
// Plain Text Format
// ============================================================================

function formatPlainText(data: ReviewData): string {
  const lines: string[] = [];
  const divider = '='.repeat(80);
  const subDivider = '-'.repeat(80);

  // Header
  lines.push(divider);
  lines.push('AI CODE REVIEW RESULTS');
  lines.push(divider);

  // Task info
  lines.push(`Task: ${data.taskTitle}`);
  if (data.taskDescription) {
    lines.push(`Description: ${data.taskDescription}`);
  }

  // Collect all findings
  const allFindings: ReviewFinding[] = [];
  for (const review of data.reviews) {
    allFindings.push(...review.findings);
  }

  // Summary line
  const counts = countFindingsBySeverity(allFindings);
  const summaryParts: string[] = [];
  if (data.overallScore !== undefined) {
    summaryParts.push(`Score: ${data.overallScore}/100`);
  }
  if (counts.critical > 0) summaryParts.push(`${counts.critical} critical`);
  if (counts.high > 0) summaryParts.push(`${counts.high} high`);
  if (counts.medium > 0) summaryParts.push(`${counts.medium} medium`);
  if (counts.low > 0) summaryParts.push(`${counts.low} low`);

  if (summaryParts.length > 0) {
    lines.push(`Issues: ${summaryParts.join(' | ')}`);
  }
  lines.push('');

  // Group by severity
  const grouped = groupFindingsBySeverity(allFindings);

  for (const severity of SEVERITY_ORDER) {
    const severityFindings = grouped.get(severity) || [];
    if (severityFindings.length === 0) continue;

    lines.push(subDivider);
    lines.push(SEVERITY_LABELS[severity]);
    lines.push(subDivider);
    lines.push('');

    severityFindings.forEach((finding, index) => {
      const location = finding.file
        ? `${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}`
        : 'General';

      lines.push(`[${index + 1}] ${location}`);
      lines.push(`    Type: ${finding.title}`);
      lines.push(`    Issue: ${finding.description}`);
      lines.push('');
    });
  }

  if (allFindings.length === 0) {
    lines.push('No issues found. All checks passed.');
  }

  return lines.join('\n');
}

// ============================================================================
// Markdown Format
// ============================================================================

function formatMarkdown(data: ReviewData): string {
  const lines: string[] = [];

  // Header
  lines.push('# AI Code Review Results');
  lines.push('');
  lines.push(`**Task:** ${data.taskTitle}`);
  if (data.taskDescription) {
    lines.push(`**Description:** ${data.taskDescription}`);
  }
  if (data.overallScore !== undefined) {
    const scoreEmoji = data.overallScore >= 80 ? ':white_check_mark:' : data.overallScore >= 60 ? ':warning:' : ':x:';
    lines.push(`**Overall Score:** ${data.overallScore}/100 ${scoreEmoji}`);
  }
  lines.push('');

  // Collect all findings
  const allFindings: ReviewFinding[] = [];
  for (const review of data.reviews) {
    allFindings.push(...review.findings);
  }

  // Summary table
  const counts = countFindingsBySeverity(allFindings);
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Critical | ${counts.critical} |`);
  lines.push(`| High | ${counts.high} |`);
  lines.push(`| Medium | ${counts.medium} |`);
  lines.push(`| Low | ${counts.low} |`);
  lines.push('');

  // Group by severity
  const grouped = groupFindingsBySeverity(allFindings);

  for (const severity of SEVERITY_ORDER) {
    const severityFindings = grouped.get(severity) || [];
    if (severityFindings.length === 0) continue;

    lines.push(`## ${SEVERITY_LABELS[severity]}`);
    lines.push('');

    for (const finding of severityFindings) {
      const location = finding.file
        ? `\`${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}\``
        : '_General_';

      lines.push(`### ${finding.title}`);
      lines.push('');
      lines.push(`**Location:** ${location}`);
      lines.push('');
      lines.push(finding.description);
      lines.push('');
    }
  }

  if (allFindings.length === 0) {
    lines.push('## Result');
    lines.push('');
    lines.push('No issues found. All checks passed. :white_check_mark:');
  }

  return lines.join('\n');
}

// ============================================================================
// AI Agent Format (Minimal Prompt)
// ============================================================================

function formatAgentPrompt(data: ReviewData): string {
  const lines: string[] = [];

  lines.push('Fix the following code review issues:');
  lines.push('');

  // Collect all findings, prioritized by severity
  const allFindings: ReviewFinding[] = [];
  for (const review of data.reviews) {
    allFindings.push(...review.findings);
  }

  // Sort by severity
  const sortedFindings = [...allFindings].sort((a, b) => {
    return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  });

  for (const finding of sortedFindings) {
    const location = finding.file
      ? `${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}`
      : '';

    const prefix = location ? `[${location}] ` : '';
    lines.push(`- ${prefix}${finding.title}: ${finding.description}`);
  }

  if (sortedFindings.length === 0) {
    lines.push('No issues to fix.');
  }

  return lines.join('\n');
}

// ============================================================================
// Component
// ============================================================================

export function CopyReviewButton({ reviewData, className }: CopyReviewButtonProps) {
  const [copied, setCopied] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<CopyFormat>('plain');

  const formatLabels: Record<CopyFormat, string> = {
    plain: 'Plain Text',
    markdown: 'Markdown',
    agent: 'AI Agent',
  };

  const handleCopy = useCallback(async (format: CopyFormat) => {
    let content: string;

    switch (format) {
      case 'markdown':
        content = formatMarkdown(reviewData);
        break;
      case 'agent':
        content = formatAgentPrompt(reviewData);
        break;
      case 'plain':
      default:
        content = formatPlainText(reviewData);
        break;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setSelectedFormat(format);
      toast.success('Copied to clipboard');

      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  }, [reviewData]);

  // Handle keyboard shortcut (Cmd/Ctrl+Shift+C)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      handleCopy(selectedFormat);
    }
  }, [handleCopy, selectedFormat]);

  return (
    <div className={className} onKeyDown={handleKeyDown} tabIndex={-1}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleCopy('plain')}>
            {formatLabels.plain}
            <span className="ml-auto text-xs text-muted-foreground">Terminal</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy('markdown')}>
            {formatLabels.markdown}
            <span className="ml-auto text-xs text-muted-foreground">GitHub/Docs</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy('agent')}>
            {formatLabels.agent}
            <span className="ml-auto text-xs text-muted-foreground">Prompt</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { formatPlainText, formatMarkdown, formatAgentPrompt };
