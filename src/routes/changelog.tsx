/**
 * Changelog Page (Phase 13.3)
 *
 * Version history and change tracking with auto-generation and manual entries.
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useChangelogManager } from '@/hooks/useChangelog';
import { ChangelogGroup } from '@/components/changelog/ChangelogGroup';
import { AddChangelogModal } from '@/components/changelog/AddChangelogModal';
import { ExportButton } from '@/components/changelog/ExportButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, FileText } from 'lucide-react';
import type { ChangelogEntry, ChangelogEntryType } from '@/types/ipc';

// ============================================================================
// Component
// ============================================================================

export function ChangelogPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch changelog data
  const {
    entries,
    loading,
    error,
    createEntry,
    deleteEntry,
    exportChangelog,
  } = useChangelogManager(currentProject?.id || '');

  // Group entries by version or date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, ChangelogEntry[]> = {};

    if (!entries) return groups;

    entries.forEach((entry) => {
      const dateKey = new Date(entry.createdAt).toISOString().split('T')[0];
      const key = entry.version ?? dateKey ?? 'Unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });

    return groups;
  }, [entries]);

  // Group entries by type
  const entriesByType = useMemo(() => {
    const groups: Record<ChangelogEntryType, ChangelogEntry[]> = {
      FEATURE: [],
      FIX: [],
      IMPROVEMENT: [],
      BREAKING: [],
    };

    if (!entries) return groups;

    entries.forEach((entry) => {
      groups[entry.type].push(entry);
    });

    return groups;
  }, [entries]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: entries?.length ?? 0,
      features: entriesByType.FEATURE.length,
      fixes: entriesByType.FIX.length,
      improvements: entriesByType.IMPROVEMENT.length,
      breaking: entriesByType.BREAKING.length,
    };
  }, [entries, entriesByType]);

  // Handle create entry
  const handleCreateEntry = useCallback(
    async (data: {
      title: string;
      description?: string;
      version?: string;
      type: ChangelogEntryType;
    }) => {
      if (!currentProject) return;

      await createEntry.mutate({
        ...data,
        projectId: currentProject.id,
      });
    },
    [currentProject, createEntry]
  );

  // Handle delete entry
  const handleDeleteEntry = useCallback(
    async (entry: ChangelogEntry) => {
      if (
        window.confirm(
          `Are you sure you want to delete "${entry.title}"? This action cannot be undone.`
        )
      ) {
        await deleteEntry.mutate(entry.id);
      }
    },
    [deleteEntry]
  );

  // Handle export
  const handleExport = useCallback(async () => {
    if (!currentProject) {
      throw new Error('No project selected');
    }
    return await exportChangelog.mutate(currentProject.id);
  }, [currentProject, exportChangelog]);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Changelog</h1>
          <p className="text-muted-foreground mt-2">
            Version history and change tracking
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its changelog.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Changelog</h1>
            <p className="text-muted-foreground mt-2">
              Track changes and version history for {currentProject.name}
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButton
              onExport={handleExport}
              disabled={(entries?.length ?? 0) === 0 || exportChangelog.isPending}
            />
            <Button onClick={() => { setIsAddModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="secondary">{stats.total}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Features:</span>
            <Badge variant="default">{stats.features}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Fixes:</span>
            <Badge variant="destructive">{stats.fixes}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Improvements:</span>
            <Badge variant="secondary">{stats.improvements}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Breaking:</span>
            <Badge variant="destructive">{stats.breaking}</Badge>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-8 pt-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Loading changelog...</div>
          </div>
        ) : (
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="by-type">By Type</TabsTrigger>
            </TabsList>

            {/* Timeline View (Default) */}
            <TabsContent value="timeline" className="space-y-8">
              {(entries?.length ?? 0) === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No changelog entries yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start documenting your project's changes by adding your first entry.
                  </p>
                  <Button onClick={() => { setIsAddModalOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Entry
                  </Button>
                </div>
              ) : (
                Object.keys(groupedEntries)
                  .sort()
                  .reverse()
                  .map((key) => (
                    <ChangelogGroup
                      key={key}
                      title={key}
                      entries={groupedEntries[key] ?? []}
                      onDelete={handleDeleteEntry}
                    />
                  ))
              )}
            </TabsContent>

            {/* By Type View */}
            <TabsContent value="by-type" className="space-y-8">
              {(entries?.length ?? 0) === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No changelog entries yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start documenting your project's changes by adding your first entry.
                  </p>
                  <Button onClick={() => { setIsAddModalOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Entry
                  </Button>
                </div>
              ) : (
                <>
                  {entriesByType.BREAKING.length > 0 && (
                    <ChangelogGroup
                      title="Breaking Changes"
                      entries={entriesByType.BREAKING}
                      onDelete={handleDeleteEntry}
                    />
                  )}
                  {entriesByType.FEATURE.length > 0 && (
                    <ChangelogGroup
                      title="Features"
                      entries={entriesByType.FEATURE}
                      onDelete={handleDeleteEntry}
                    />
                  )}
                  {entriesByType.IMPROVEMENT.length > 0 && (
                    <ChangelogGroup
                      title="Improvements"
                      entries={entriesByType.IMPROVEMENT}
                      onDelete={handleDeleteEntry}
                    />
                  )}
                  {entriesByType.FIX.length > 0 && (
                    <ChangelogGroup
                      title="Bug Fixes"
                      entries={entriesByType.FIX}
                      onDelete={handleDeleteEntry}
                    />
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Add Changelog Modal */}
      <AddChangelogModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); }}
        onSubmit={handleCreateEntry}
      />
    </div>
  );
}
