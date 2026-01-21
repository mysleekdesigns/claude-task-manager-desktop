/**
 * Feature Item Component
 *
 * Individual feature display with MoSCoW priority, status, and actions.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Play, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Feature, MoscowPriority, FeatureStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface FeatureItemProps {
  feature: Feature;
  onBuild?: ((feature: Feature) => void) | undefined;
  onEdit?: ((feature: Feature) => void) | undefined;
  onDelete?: ((feature: Feature) => void) | undefined;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get MoSCoW priority badge variant and color
 */
function getPriorityBadge(priority: MoscowPriority) {
  const variants = {
    MUST: { variant: 'destructive' as const, label: 'Must Have' },
    SHOULD: { variant: 'default' as const, label: 'Should Have' },
    COULD: { variant: 'secondary' as const, label: 'Could Have' },
    WONT: { variant: 'outline' as const, label: "Won't Have" },
  };
  return variants[priority];
}

/**
 * Get status badge variant
 */
function getStatusBadge(status: FeatureStatus) {
  const variants = {
    planned: { variant: 'outline' as const, label: 'Planned' },
    in_progress: { variant: 'default' as const, label: 'In Progress' },
    completed: { variant: 'secondary' as const, label: 'Completed' },
    cancelled: { variant: 'outline' as const, label: 'Cancelled' },
  };
  return variants[status];
}

// ============================================================================
// Component
// ============================================================================

export function FeatureItem({
  feature,
  onBuild,
  onEdit,
  onDelete,
}: FeatureItemProps) {
  const priorityBadge = getPriorityBadge(feature.priority);
  const statusBadge = getStatusBadge(feature.status);

  const handleBuildClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBuild) {
      onBuild(feature);
    }
  };

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* Left side: Priority and content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Priority and Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={priorityBadge.variant} className="text-xs">
            {priorityBadge.label}
          </Badge>
          <Badge variant={statusBadge.variant} className="text-xs">
            {statusBadge.label}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm leading-tight">
          {feature.title}
        </h4>

        {/* Description - truncated */}
        {feature.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {feature.description}
          </p>
        )}
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Build Button - only show if not completed/cancelled */}
        {feature.status !== 'completed' && feature.status !== 'cancelled' && (
          <Button
            size="sm"
            onClick={handleBuildClick}
            className="h-8 px-3 text-xs gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white"
            title="Create task from feature"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Build
          </Button>
        )}

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => { e.stopPropagation(); }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Feature actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => { e.stopPropagation(); }}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onEdit && (
              <DropdownMenuItem onClick={() => { onEdit(feature); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { onDelete(feature); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
