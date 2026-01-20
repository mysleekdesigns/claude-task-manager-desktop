/**
 * PR List Component
 *
 * List of Pull Request cards with filtering and sorting capabilities.
 */

import { useState, useMemo } from 'react';
import { PrCard } from './PrCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import type { GitHubPullRequest, GitHubPRDisplayState } from '@/types/github';

// ============================================================================
// Types
// ============================================================================

interface PrListProps {
  prs: GitHubPullRequest[];
  loading?: boolean;
  onPrClick?: ((pr: GitHubPullRequest) => void) | undefined;
}

type SortOption = 'created' | 'updated' | 'comments';
type StateFilter = 'all' | 'open' | 'merged' | 'closed';

// ============================================================================
// Component
// ============================================================================

export function PrList({ prs, loading = false, onPrClick }: PrListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('created');

  // Get display state for PR
  const getDisplayState = (pr: GitHubPullRequest): GitHubPRDisplayState => {
    if (pr.merged) return 'merged';
    return pr.state as GitHubPRDisplayState;
  };

  // Filter and sort PRs
  const filteredAndSortedPrs = useMemo(() => {
    let result = [...prs];

    // Filter by state
    if (stateFilter !== 'all') {
      result = result.filter((pr) => getDisplayState(pr) === stateFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (pr) =>
          pr.title.toLowerCase().includes(query) ||
          pr.number.toString().includes(query) ||
          pr.user.login.toLowerCase().includes(query) ||
          pr.head.ref.toLowerCase().includes(query) ||
          pr.base.ref.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case 'updated':
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        case 'comments':
          return (
            b.comments +
            (b.review_comments ?? 0) -
            (a.comments + (a.review_comments ?? 0))
          );
        default:
          return 0;
      }
    });

    return result;
  }, [prs, stateFilter, searchQuery, sortBy]);

  // Count by state
  const stateCounts = useMemo(() => {
    const counts = {
      all: prs.length,
      open: 0,
      merged: 0,
      closed: 0,
    };

    prs.forEach((pr) => {
      const state = getDisplayState(pr);
      counts[state]++;
    });

    return counts;
  }, [prs]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pull requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* State Filter */}
        <Select
          value={stateFilter}
          onValueChange={(value) => setStateFilter(value as StateFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({stateCounts.all})</SelectItem>
            <SelectItem value="open">Open ({stateCounts.open})</SelectItem>
            <SelectItem value="merged">
              Merged ({stateCounts.merged})
            </SelectItem>
            <SelectItem value="closed">
              Closed ({stateCounts.closed})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortOption)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Recently created</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="comments">Most commented</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedPrs.length} pull request
          {filteredAndSortedPrs.length !== 1 ? 's' : ''}
        </p>
        {(searchQuery || stateFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStateFilter('all');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading pull requests...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedPrs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {prs.length === 0
            ? 'No pull requests found'
            : 'No pull requests match your filters'}
        </div>
      )}

      {/* PR List */}
      {!loading && filteredAndSortedPrs.length > 0 && (
        <div className="space-y-3">
          {filteredAndSortedPrs.map((pr) => (
            <PrCard
              key={pr.id}
              pr={pr}
              onClick={() => onPrClick?.(pr)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
