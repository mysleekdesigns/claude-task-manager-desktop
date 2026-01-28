/**
 * Conflict Resolution Modal Component
 *
 * Modal dialog for resolving sync conflicts with side-by-side comparison.
 * Allows users to keep local version, server version, or merge changes.
 *
 * @module components/collaboration/ConflictResolutionModal
 */

import { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  GitMerge,
  Monitor,
  Cloud,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConflictDiff } from './ConflictDiff';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import { useConflictStore, selectActiveConflict } from '@/stores/conflict-store';
import { cn } from '@/lib/utils';
import type { ConflictEntityType, FieldDifference } from '@/types/conflict';

// ============================================================================
// Types
// ============================================================================

export interface ConflictResolutionModalProps {
  /** Optional className for styling */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get entity type display name
 */
function getEntityTypeLabel(entityType: ConflictEntityType): string {
  const labels: Record<ConflictEntityType, string> = {
    task: 'Task',
    project: 'Project',
    memory: 'Memory',
  };
  return labels[entityType] || entityType;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format value for JSON display
 */
function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Version preview card
 */
function VersionCard({
  title,
  icon: Icon,
  data,
  variant,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: Record<string, unknown>;
  variant: 'local' | 'server';
  className?: string;
}) {
  const variantStyles = {
    local: {
      border: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      header: 'bg-amber-100 dark:bg-amber-900/30',
      icon: 'text-amber-600 dark:text-amber-400',
    },
    server: {
      border: 'border-blue-200 dark:border-blue-800',
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      header: 'bg-blue-100 dark:bg-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Card className={cn(styles.border, styles.bg, 'overflow-hidden', className)}>
      <CardHeader className={cn('py-3 px-4', styles.header)}>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={cn('h-4 w-4', styles.icon)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[250px]">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {formatJsonValue(data)}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConflictResolutionModal provides a UI for resolving sync conflicts.
 *
 * Features:
 * - Side-by-side version comparison
 * - Field-by-field diff view
 * - Quick resolution actions (Keep Mine, Keep Theirs, Merge)
 * - Tabbed interface for different views
 *
 * @example
 * ```tsx
 * // Include once in your app layout
 * <ConflictResolutionModal />
 * ```
 */
export function ConflictResolutionModal({
  className,
}: ConflictResolutionModalProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'local' | 'server'>('diff');

  // Store state
  const isOpen = useConflictStore((state) => state.isResolutionModalOpen);
  const activeConflict = useConflictStore(selectActiveConflict);

  // Resolution actions
  const {
    closeConflictModal,
    keepLocalVersion,
    keepServerVersion,
    getFieldDifferences,
  } = useConflictResolution();

  // Get field differences
  const differences = useMemo<FieldDifference[]>(() => {
    if (!activeConflict) return [];
    return getFieldDifferences(activeConflict);
  }, [activeConflict, getFieldDifferences]);

  // Handle resolution
  const handleKeepLocal = useCallback(async () => {
    if (!activeConflict) return;
    setIsResolving(true);
    try {
      keepLocalVersion(activeConflict.id);
    } finally {
      setIsResolving(false);
    }
  }, [activeConflict, keepLocalVersion]);

  const handleKeepServer = useCallback(async () => {
    if (!activeConflict) return;
    setIsResolving(true);
    try {
      keepServerVersion(activeConflict.id);
    } finally {
      setIsResolving(false);
    }
  }, [activeConflict, keepServerVersion]);

  const handleClose = useCallback(() => {
    if (!isResolving) {
      closeConflictModal();
      setActiveTab('diff');
    }
  }, [isResolving, closeConflictModal]);

  // Don't render if no conflict
  if (!activeConflict) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn('sm:max-w-[900px] max-h-[90vh]', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Resolve Sync Conflict
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline">
              {getEntityTypeLabel(activeConflict.entityType)}
            </Badge>
            <span className="font-medium">{activeConflict.entityName}</span>
            <span className="text-muted-foreground">
              - Detected {formatDate(activeConflict.detectedAt)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Info */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">
              {differences.length} conflicting field{differences.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <Separator />

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diff" className="gap-2">
              <GitMerge className="h-4 w-4" />
              Differences
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-2">
              <Monitor className="h-4 w-4" />
              Your Version
            </TabsTrigger>
            <TabsTrigger value="server" className="gap-2">
              <Cloud className="h-4 w-4" />
              Server Version
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diff" className="mt-4">
            <ConflictDiff differences={differences} maxHeight="350px" />
          </TabsContent>

          <TabsContent value="local" className="mt-4">
            <VersionCard
              title="Your Version (Local)"
              icon={Monitor}
              data={activeConflict.localVersion}
              variant="local"
            />
          </TabsContent>

          <TabsContent value="server" className="mt-4">
            <VersionCard
              title="Server Version"
              icon={Cloud}
              data={activeConflict.serverVersion}
              variant="server"
            />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Resolution Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Choose which version to keep. This action cannot be undone.</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleKeepLocal}
              disabled={isResolving}
              className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 dark:text-amber-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Keep Mine
            </Button>
            <Button
              onClick={handleKeepServer}
              disabled={isResolving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Keep Theirs
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictResolutionModal;
