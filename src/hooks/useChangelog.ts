/**
 * React Hook for Changelog Management (Phase 13.3)
 *
 * Provides hooks for managing changelog entries with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  CreateChangelogInput,
  UpdateChangelogInput,
} from '@/types/ipc';

// ============================================================================
// Changelog Hooks
// ============================================================================

/**
 * Hook for fetching changelog entries for a project
 *
 * @param projectId - The project ID to fetch changelog entries for
 * @returns Query result with changelog entries data
 */
export function useChangelogEntries(projectId: string) {
  return useIPCQuery('changelog:list', [projectId], {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for creating a new changelog entry
 *
 * @returns Mutation with mutate function for creating changelog entries
 */
export function useCreateChangelogEntry() {
  return useIPCMutation('changelog:create');
}

/**
 * Hook for updating a changelog entry
 *
 * @returns Mutation with mutate function for updating changelog entries
 */
export function useUpdateChangelogEntry() {
  return useIPCMutation('changelog:update');
}

/**
 * Hook for deleting a changelog entry
 *
 * @returns Mutation with mutate function for deleting changelog entries
 */
export function useDeleteChangelogEntry() {
  return useIPCMutation('changelog:delete');
}

/**
 * Hook for exporting changelog as markdown
 *
 * @returns Mutation with mutate function for exporting changelog
 */
export function useExportChangelog() {
  return useIPCMutation('changelog:export');
}

// ============================================================================
// Composite Hook (all changelog operations)
// ============================================================================

/**
 * Composite hook that provides all changelog operations for a project
 *
 * @param projectId - The project ID
 * @returns Object with changelog entries data and mutation functions
 */
export function useChangelogManager(projectId: string) {
  const { data: entries, loading, error, refetch } = useChangelogEntries(projectId);
  const createEntry = useCreateChangelogEntry();
  const updateEntry = useUpdateChangelogEntry();
  const deleteEntry = useDeleteChangelogEntry();
  const exportChangelog = useExportChangelog();

  // Refetch entries after mutations
  const handleCreate = useCallback(
    async (data: CreateChangelogInput) => {
      await createEntry.mutate(data);
      await refetch();
    },
    [createEntry, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, data: UpdateChangelogInput) => {
      await updateEntry.mutate(id, data);
      await refetch();
    },
    [updateEntry, refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEntry.mutate(id);
      await refetch();
    },
    [deleteEntry, refetch]
  );

  const handleExport = useCallback(
    async (projectId: string) => {
      return await exportChangelog.mutate(projectId);
    },
    [exportChangelog]
  );

  return {
    entries,
    loading,
    error,
    createEntry: {
      mutate: handleCreate,
      isPending: createEntry.loading,
    },
    updateEntry: {
      mutate: handleUpdate,
      isPending: updateEntry.loading,
    },
    deleteEntry: {
      mutate: handleDelete,
      isPending: deleteEntry.loading,
    },
    exportChangelog: {
      mutate: handleExport,
      isPending: exportChangelog.loading,
    },
    refetch,
  };
}
