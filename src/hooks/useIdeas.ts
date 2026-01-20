/**
 * React Hook for Idea Management (Phase 13.2)
 *
 * Provides hooks for managing ideas with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  CreateIdeaInput,
  UpdateIdeaInput,
  IdeaListFilters,
} from '@/types/ipc';

// ============================================================================
// Idea Hooks
// ============================================================================

/**
 * Hook for fetching ideas for a project
 *
 * @param projectId - The project ID to fetch ideas for
 * @param filters - Optional filters for idea list
 * @returns Query result with ideas data
 */
export function useIdeas(projectId: string, filters?: IdeaListFilters) {
  return useIPCQuery('ideas:list', [projectId, filters] as any, {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for fetching a single idea by ID
 *
 * @param ideaId - The idea ID to fetch
 * @returns Query result with idea data
 */
export function useIdea(ideaId: string) {
  return useIPCQuery('ideas:get', [ideaId] as any, {
    enabled: Boolean(ideaId),
  });
}

/**
 * Hook for creating a new idea
 *
 * @returns Mutation with mutate function for creating ideas
 */
export function useCreateIdea() {
  return useIPCMutation('ideas:create');
}

/**
 * Hook for updating an idea
 *
 * @returns Mutation with mutate function for updating ideas
 */
export function useUpdateIdea() {
  return useIPCMutation('ideas:update');
}

/**
 * Hook for deleting an idea
 *
 * @returns Mutation with mutate function for deleting ideas
 */
export function useDeleteIdea() {
  return useIPCMutation('ideas:delete');
}

/**
 * Hook for voting on an idea
 *
 * @returns Mutation with mutate function for voting on ideas
 */
export function useVoteIdea() {
  return useIPCMutation('ideas:vote');
}

/**
 * Hook for converting an idea to a feature
 *
 * @returns Mutation with mutate function for converting ideas
 */
export function useConvertIdeaToFeature() {
  return useIPCMutation('ideas:convertToFeature');
}

// ============================================================================
// Composite Hook (all idea operations)
// ============================================================================

/**
 * Composite hook that provides all idea operations for a project
 *
 * @param projectId - The project ID
 * @param filters - Optional filters for idea list
 * @returns Object with ideas data and mutation functions
 *
 * @example
 * ```tsx
 * function IdeationBoard({ projectId }: { projectId: string }) {
 *   const {
 *     ideas,
 *     loading,
 *     error,
 *     createIdea,
 *     voteIdea,
 *     convertToFeature,
 *     refetch,
 *   } = useIdeaManager(projectId);
 *
 *   const handleVote = async (ideaId: string, delta: number) => {
 *     await voteIdea.mutate(ideaId, delta);
 *   };
 *
 *   return <div>{ideas.map(idea => <IdeaCard key={idea.id} idea={idea} />)}</div>;
 * }
 * ```
 */
export function useIdeaManager(projectId: string, filters?: IdeaListFilters) {
  const { data: ideas = [], loading, error, refetch } = useIdeas(projectId, filters);
  const createIdea = useCreateIdea();
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();
  const voteIdea = useVoteIdea();
  const convertToFeature = useConvertIdeaToFeature();

  // Refetch ideas after mutations
  const handleCreate = useCallback(
    async (data: CreateIdeaInput) => {
      const result = await createIdea.mutate(data);
      await refetch();
      return result;
    },
    [createIdea, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, data: UpdateIdeaInput) => {
      const result = await updateIdea.mutate(id, data);
      await refetch();
      return result;
    },
    [updateIdea, refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteIdea.mutate(id);
      await refetch();
    },
    [deleteIdea, refetch]
  );

  const handleVote = useCallback(
    async (ideaId: string, delta: number) => {
      const result = await voteIdea.mutate(ideaId, delta);
      await refetch();
      return result;
    },
    [voteIdea, refetch]
  );

  const handleConvert = useCallback(
    async (ideaId: string) => {
      const result = await convertToFeature.mutate(ideaId as any);
      await refetch();
      return result;
    },
    [convertToFeature, refetch]
  );

  return {
    ideas,
    loading,
    error,
    refetch,
    createIdea: {
      mutate: handleCreate,
      loading: createIdea.loading,
      error: createIdea.error,
    },
    updateIdea: {
      mutate: handleUpdate,
      loading: updateIdea.loading,
      error: updateIdea.error,
    },
    deleteIdea: {
      mutate: handleDelete,
      loading: deleteIdea.loading,
      error: deleteIdea.error,
    },
    voteIdea: {
      mutate: handleVote,
      loading: voteIdea.loading,
      error: voteIdea.error,
    },
    convertToFeature: {
      mutate: handleConvert,
      loading: convertToFeature.loading,
      error: convertToFeature.error,
    },
  };
}
