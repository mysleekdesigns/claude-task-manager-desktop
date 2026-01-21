/**
 * IdeaFilters Component (Phase 13.2)
 *
 * Filter chips for idea status and sort dropdown for ordering ideas.
 */

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IdeaStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface IdeaFiltersProps {
  selectedStatus: IdeaStatus | 'ALL';
  onStatusChange: (status: IdeaStatus | 'ALL') => void;
  sortBy: 'votes' | 'date';
  onSortChange: (sort: 'votes' | 'date') => void;
  counts: Record<IdeaStatus | 'ALL', number>;
}

// ============================================================================
// Status Filter Configuration
// ============================================================================

const STATUS_FILTERS: {
  value: IdeaStatus | 'ALL';
  label: string;
}[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CONVERTED', label: 'Converted' },
];

// ============================================================================
// Sort Options
// ============================================================================

const SORT_OPTIONS = [
  { value: 'votes', label: 'Most Votes' },
  { value: 'date', label: 'Most Recent' },
];

// ============================================================================
// Component
// ============================================================================

export function IdeaFilters({
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  counts,
}: IdeaFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground mr-2">Status:</span>
        {STATUS_FILTERS.map((filter) => (
          <Badge
            key={filter.value}
            variant={selectedStatus === filter.value ? 'default' : 'outline'}
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => { onStatusChange(filter.value); }}
          >
            {filter.label}
            <span className="ml-1.5 text-xs">({counts[filter.value] || 0})</span>
          </Badge>
        ))}
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select value={sortBy} onValueChange={(value) => { onSortChange(value as 'votes' | 'date'); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
