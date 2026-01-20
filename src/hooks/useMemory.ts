/**
 * React Hook for Memory Management (Phase 10)
 *
 * Provides hooks for managing project memories with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListFilters,
} from '@/types/ipc';

// ============================================================================
// Memory Hooks
// ============================================================================

/**
 * Hook for fetching memories for a project
 *
 * @param projectId - The project ID to fetch memories for
 * @param filters - Optional filters for memory list
 * @returns Query result with memories data
 */
export function useMemories(projectId: string, filters?: MemoryListFilters) {
  return useIPCQuery('memories:list', [projectId, filters] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for fetching a single memory by ID
 *
 * @param memoryId - The memory ID to fetch
 * @returns Query result with memory data
 */
export function useMemory(memoryId: string) {
  return useIPCQuery('memories:get', [memoryId] as any, {
    enabled: Boolean(memoryId),
  });
}

/**
 * Hook for creating a new memory
 *
 * @returns Mutation with mutate function for creating memories
 */
export function useCreateMemory() {
  return useIPCMutation('memories:create');
}

/**
 * Hook for updating a memory
 *
 * @returns Mutation with mutate function for updating memories
 */
export function useUpdateMemory() {
  return useIPCMutation('memories:update');
}

/**
 * Hook for deleting a memory
 *
 * @returns Mutation with mutate function for deleting memories
 */
export function useDeleteMemory() {
  return useIPCMutation('memories:delete');
}

// ============================================================================
// Composite Hook (all memory operations)
// ============================================================================

/**
 * Composite hook that provides all memory operations for a project
 *
 * @param projectId - The project ID
 * @param filters - Optional filters for memory list
 * @returns Object with memories data and mutation functions
 */
export function useMemoryManager(projectId: string, filters?: MemoryListFilters) {
  const { data: memories = [], loading, error, refetch } = useMemories(projectId, filters);
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();

  // Refetch memories after mutations
  const handleCreate = useCallback(
    async (data: CreateMemoryInput) => {
      await createMemory.mutate(data);
      await refetch();
    },
    [createMemory, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, data: UpdateMemoryInput) => {
      await updateMemory.mutate(id, data);
      await refetch();
    },
    [updateMemory, refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMemory.mutate(id);
      await refetch();
    },
    [deleteMemory, refetch]
  );

  return {
    memories,
    loading,
    error,
    createMemory: {
      mutate: handleCreate,
      isPending: createMemory.loading,
    },
    updateMemory: {
      mutate: handleUpdate,
      isPending: updateMemory.loading,
    },
    deleteMemory: {
      mutate: handleDelete,
      isPending: deleteMemory.loading,
    },
    refetch,
  };
}
