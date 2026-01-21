/**
 * Issues List Component
 *
 * Displays a list of GitHub issues with filtering and sorting options.
 */

import { useState, useMemo } from 'react';
import { IssueCard } from './IssueCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';
import type { GitHubIssue } from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface IssuesListProps {
  issues: GitHubIssue[];
  loading?: boolean;
  onIssueClick: (issue: GitHubIssue) => void;
}

// ============================================================================
// Component
// ============================================================================

export function IssuesList({ issues, loading = false, onIssueClick }: IssuesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    state: 'all' as 'open' | 'closed' | 'all',
    sort: 'created' as 'created' | 'updated' | 'comments',
    direction: 'desc' as 'asc' | 'desc',
  });
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Extract all unique labels from issues
  const allLabels = useMemo(() => {
    const labelSet = new Set<string>();
    issues.forEach((issue) => {
      issue.labels.forEach((label) => labelSet.add(label.name));
    });
    return Array.from(labelSet).sort();
  }, [issues]);

  // Filter and sort issues
  const filteredIssues = useMemo(() => {
    let result = [...issues];

    // Filter by state
    if (filters.state && filters.state !== 'all') {
      result = result.filter((issue) => issue.state === filters.state);
    }

    // Filter by selected label
    if (selectedLabel) {
      result = result.filter((issue) =>
        issue.labels.some((label) => label.name === selectedLabel)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.number.toString().includes(query) ||
          issue.body?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (filters.sort) {
        case 'updated':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case 'comments':
          aValue = a.comments;
          bValue = b.comments;
          break;
        case 'created':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      return filters.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return result;
  }, [issues, filters, searchQuery, selectedLabel]);

  // Handle filter changes
  const handleStateChange = (value: string) => {
    setFilters((prev) => ({ ...prev, state: value as 'open' | 'closed' | 'all' }));
  };

  const handleSortChange = (value: string) => {
    setFilters((prev) => ({ ...prev, sort: value as 'created' | 'updated' | 'comments' }));
  };

  const handleDirectionChange = (value: string) => {
    setFilters((prev) => ({ ...prev, direction: value as 'asc' | 'desc' }));
  };

  const clearLabelFilter = () => {
    setSelectedLabel(null);
  };

  // Get issue count by state
  const openCount = issues.filter((i) => i.state === 'open').length;
  const closedCount = issues.filter((i) => i.state === 'closed').length;

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues by title, number, or body..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            className="pl-10"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          {/* State filter */}
          <Select value={filters.state} onValueChange={handleStateChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({issues.length})</SelectItem>
              <SelectItem value="open">Open ({openCount})</SelectItem>
              <SelectItem value="closed">Closed ({closedCount})</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort by */}
          <Select value={filters.sort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort direction */}
          <Select value={filters.direction} onValueChange={handleDirectionChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest</SelectItem>
              <SelectItem value="asc">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Labels filter */}
        {allLabels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Labels:</span>
            {allLabels.slice(0, 10).map((label) => (
              <Badge
                key={label}
                variant={selectedLabel === label ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => { setSelectedLabel(selectedLabel === label ? null : label); }}
              >
                {label}
              </Badge>
            ))}
            {allLabels.length > 10 && (
              <span className="text-xs text-muted-foreground">
                +{allLabels.length - 10} more
              </span>
            )}
          </div>
        )}

        {/* Active filter indicator */}
        {selectedLabel && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            <Badge variant="secondary" className="gap-1">
              {selectedLabel}
              <Button
                variant="ghost"
                size="icon"
                className="h-3 w-3 p-0 hover:bg-transparent"
                onClick={clearLabelFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredIssues.length} of {issues.length} issues
      </div>

      {/* Issues grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Loading issues...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || selectedLabel
              ? 'No issues match your filters'
              : 'No issues found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClick={() => { onIssueClick(issue); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
