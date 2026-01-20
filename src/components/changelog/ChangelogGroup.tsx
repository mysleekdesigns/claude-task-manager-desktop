/**
 * Changelog Group Component
 *
 * Groups changelog entries by date or version.
 */

import { ChangelogEntryComponent } from './ChangelogEntry';
import type { ChangelogEntry } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ChangelogGroupProps {
  title: string;
  entries: ChangelogEntry[];
  onEdit?: ((entry: ChangelogEntry) => void) | undefined;
  onDelete?: ((entry: ChangelogEntry) => void) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function ChangelogGroup({ title, entries, onEdit, onDelete }: ChangelogGroupProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Group Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{title}</h2>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <ChangelogEntryComponent
            key={entry.id}
            entry={entry}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
