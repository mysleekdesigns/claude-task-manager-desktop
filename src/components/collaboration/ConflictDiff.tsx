/**
 * Conflict Diff Component
 *
 * Displays field-by-field differences between local and server versions.
 * Highlights changed fields and shows old/new values with appropriate formatting.
 *
 * @module components/collaboration/ConflictDiff
 */

import { useMemo } from 'react';
import {
  ArrowRight,
  Calendar,
  Hash,
  List,
  Type,
  ToggleLeft,
  Braces,
  CircleSlash,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { FieldDifference } from '@/types/conflict';

// ============================================================================
// Types
// ============================================================================

export interface ConflictDiffProps {
  /** List of field differences to display */
  differences: FieldDifference[];
  /** Optional className for styling */
  className?: string;
  /** Maximum height for the diff container */
  maxHeight?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon for a field value type
 */
function TypeIcon({ type }: { type: FieldDifference['valueType'] }) {
  const iconClass = 'h-3.5 w-3.5 text-muted-foreground';

  switch (type) {
    case 'string':
      return <Type className={iconClass} />;
    case 'number':
      return <Hash className={iconClass} />;
    case 'boolean':
      return <ToggleLeft className={iconClass} />;
    case 'date':
      return <Calendar className={iconClass} />;
    case 'array':
      return <List className={iconClass} />;
    case 'object':
      return <Braces className={iconClass} />;
    case 'null':
      return <CircleSlash className={iconClass} />;
    default:
      return <Type className={iconClass} />;
  }
}

/**
 * Format a value for display based on its type
 */
function formatValue(value: unknown, type: FieldDifference['valueType']): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      // Handle ISO date strings
      const date = new Date(String(value));
      return isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    case 'array':
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.length <= 3) {
          return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
        }
        return `[${value.slice(0, 3).map((v) => JSON.stringify(v)).join(', ')}, ... +${value.length - 3} more]`;
      }
      return JSON.stringify(value);
    case 'object':
      try {
        const json = JSON.stringify(value, null, 2);
        if (json.length > 100) {
          return json.substring(0, 100) + '...';
        }
        return json;
      } catch {
        return String(value);
      }
    case 'null':
      return 'null';
    default:
      return String(value);
  }
}

/**
 * Format a field name for display (camelCase to Title Case)
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Single field difference row
 */
function DiffRow({ difference }: { difference: FieldDifference }) {
  const { field, localValue, serverValue, valueType } = difference;

  const formattedLocal = formatValue(localValue, valueType);
  const formattedServer = formatValue(serverValue, valueType);
  const isLongValue = formattedLocal.length > 50 || formattedServer.length > 50;

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-amber-200/50 dark:border-amber-800/50">
      {/* Field Header */}
      <div className="flex items-center gap-2">
        <TypeIcon type={valueType} />
        <span className="font-medium text-sm">{formatFieldName(field)}</span>
        <Badge variant="outline" className="text-xs ml-auto">
          {valueType}
        </Badge>
      </div>

      {/* Values Comparison */}
      <div
        className={cn(
          'grid gap-2',
          isLongValue ? 'grid-cols-1' : 'grid-cols-[1fr_auto_1fr]'
        )}
      >
        {/* Local Value */}
        <div
          className={cn(
            'rounded-md p-2 text-sm',
            'bg-amber-50 dark:bg-amber-950/30',
            'border border-amber-200 dark:border-amber-800'
          )}
        >
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            Your Version
          </p>
          <p
            className={cn(
              'font-mono text-xs break-all',
              localValue === null && 'italic text-muted-foreground'
            )}
          >
            {formattedLocal}
          </p>
        </div>

        {/* Arrow (only for side-by-side) */}
        {!isLongValue && (
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Server Value */}
        <div
          className={cn(
            'rounded-md p-2 text-sm',
            'bg-blue-50 dark:bg-blue-950/30',
            'border border-blue-200 dark:border-blue-800'
          )}
        >
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            Server Version
          </p>
          <p
            className={cn(
              'font-mono text-xs break-all',
              serverValue === null && 'italic text-muted-foreground'
            )}
          >
            {formattedServer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConflictDiff displays field-by-field differences between versions.
 *
 * Features:
 * - Type-aware value formatting
 * - Visual indication of changes
 * - Support for different data types
 * - Responsive layout for long values
 *
 * @example
 * ```tsx
 * <ConflictDiff
 *   differences={[
 *     {
 *       field: 'title',
 *       localValue: 'My Task',
 *       serverValue: 'Updated Task',
 *       valueType: 'string',
 *     },
 *   ]}
 * />
 * ```
 */
export function ConflictDiff({
  differences,
  className,
  maxHeight = '400px',
}: ConflictDiffProps) {
  // Sort differences by field name for consistent display
  const sortedDifferences = useMemo(() => {
    return [...differences].sort((a, b) => a.field.localeCompare(b.field));
  }, [differences]);

  if (differences.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No differences found</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-sm font-medium text-muted-foreground">
          {differences.length} field{differences.length !== 1 ? 's' : ''} with
          conflicts
        </p>
      </div>

      {/* Differences List */}
      <ScrollArea className={cn('pr-4')} style={{ maxHeight }}>
        <div className="space-y-3">
          {sortedDifferences.map((diff, index) => (
            <div key={diff.field}>
              <DiffRow difference={diff} />
              {index < sortedDifferences.length - 1 && (
                <Separator className="my-3 bg-transparent" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ConflictDiff;
