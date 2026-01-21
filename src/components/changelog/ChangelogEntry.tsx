/**
 * Changelog Entry Component
 *
 * Displays a single changelog entry with type badge, title, description, and linked task.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Sparkles, Bug, Zap, AlertTriangle, Link } from 'lucide-react';
import type { ChangelogEntry } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ChangelogEntryProps {
  entry: ChangelogEntry;
  onEdit?: ((entry: ChangelogEntry) => void) | undefined;
  onDelete?: ((entry: ChangelogEntry) => void) | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function ChangelogEntryComponent({ entry, onEdit, onDelete }: ChangelogEntryProps) {
  const typeConfig = {
    FEATURE: {
      label: 'Feature',
      variant: 'default' as const,
      icon: Sparkles,
      color: 'text-blue-600',
    },
    FIX: {
      label: 'Bug Fix',
      variant: 'destructive' as const,
      icon: Bug,
      color: 'text-red-600',
    },
    IMPROVEMENT: {
      label: 'Improvement',
      variant: 'secondary' as const,
      icon: Zap,
      color: 'text-green-600',
    },
    BREAKING: {
      label: 'Breaking Change',
      variant: 'destructive' as const,
      icon: AlertTriangle,
      color: 'text-orange-600',
    },
  };

  const config = typeConfig[entry.type];
  const TypeIcon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={config.variant} className="flex items-center gap-1">
                <TypeIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              {entry.version && (
                <Badge variant="outline" className="text-xs">
                  v{entry.version}
                </Badge>
              )}
            </div>
            <h4 className="font-semibold text-lg">{entry.title}</h4>
          </div>

          {/* Actions dropdown */}
          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => { onEdit(entry); }}>
                    Edit
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => { onDelete(entry); }}
                    className="text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      {(entry.description || entry.task) && (
        <CardContent className="pt-0">
          {entry.description && (
            <p className="text-sm text-muted-foreground mb-2">
              {entry.description}
            </p>
          )}

          {entry.task && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Link className="h-3 w-3" />
              <span>
                Linked to task:{' '}
                <span className="font-medium">{entry.task.title}</span>
              </span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
