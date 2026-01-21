/**
 * React Hook for Roadmap Management (Phase 9)
 *
 * Provides hooks for managing roadmap phases, features, and milestones with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  CreatePhaseInput,
  UpdatePhaseInput,
  CreateFeatureInput,
  UpdateFeatureInput,
  CreateMilestoneInput,
} from '@/types/ipc';

// ============================================================================
// Phase Hooks
// ============================================================================

/**
 * Hook for fetching phases for a project
 *
 * @param projectId - The project ID to fetch phases for
 * @returns Query result with phases data
 */
export function usePhases(projectId: string) {
  return useIPCQuery('phases:list', [projectId], {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for creating a new phase
 *
 * @returns Mutation with mutate function for creating phases
 */
export function useCreatePhase() {
  return useIPCMutation('phases:create');
}

/**
 * Hook for updating a phase
 *
 * @returns Mutation with mutate function for updating phases
 */
export function useUpdatePhase() {
  return useIPCMutation('phases:update');
}

/**
 * Hook for deleting a phase
 *
 * @returns Mutation with mutate function for deleting phases
 */
export function useDeletePhase() {
  return useIPCMutation('phases:delete');
}

/**
 * Hook for reordering phases
 *
 * @returns Mutation with mutate function for reordering phases
 */
export function useReorderPhases() {
  return useIPCMutation('phases:reorder');
}

// ============================================================================
// Feature Hooks
// ============================================================================

/**
 * Hook for fetching features for a project
 *
 * @param projectId - The project ID to fetch features for
 * @returns Query result with features data
 */
export function useFeatures(projectId: string) {
  return useIPCQuery('features:list', [{ projectId }], {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for creating a new feature
 *
 * @returns Mutation with mutate function for creating features
 */
export function useCreateFeature() {
  return useIPCMutation('features:create');
}

/**
 * Hook for updating a feature
 *
 * @returns Mutation with mutate function for updating features
 */
export function useUpdateFeature() {
  return useIPCMutation('features:update');
}

/**
 * Hook for deleting a feature
 *
 * @returns Mutation with mutate function for deleting features
 */
export function useDeleteFeature() {
  return useIPCMutation('features:delete');
}

// ============================================================================
// Milestone Hooks
// ============================================================================

/**
 * Hook for creating a new milestone
 *
 * @returns Mutation with mutate function for creating milestones
 */
export function useCreateMilestone() {
  return useIPCMutation('milestones:create');
}

/**
 * Hook for toggling milestone completion
 *
 * @returns Mutation with mutate function for toggling milestones
 */
export function useToggleMilestone() {
  return useIPCMutation('milestones:toggle');
}

/**
 * Hook for deleting a milestone
 *
 * @returns Mutation with mutate function for deleting milestones
 */
export function useDeleteMilestone() {
  return useIPCMutation('milestones:delete');
}

// ============================================================================
// Combined Roadmap Management Hook
// ============================================================================

/**
 * Combined hook for complete roadmap management
 *
 * @param projectId - The project ID to manage roadmap for
 * @returns Object with phases, features data and mutation functions
 */
export function useRoadmapManager(projectId: string) {
  const phasesQuery = usePhases(projectId);
  const featuresQuery = useFeatures(projectId);

  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const reorderPhases = useReorderPhases();

  const createFeature = useCreateFeature();
  const updateFeature = useUpdateFeature();
  const deleteFeature = useDeleteFeature();

  const createMilestone = useCreateMilestone();
  const toggleMilestone = useToggleMilestone();
  const deleteMilestone = useDeleteMilestone();

  // Wrapper functions that auto-refresh data
  const handleCreatePhase = useCallback(
    async (data: CreatePhaseInput) => {
      const result = await createPhase.mutate(data);
      await phasesQuery.refetch();
      return result;
    },
    [createPhase, phasesQuery]
  );

  const handleUpdatePhase = useCallback(
    async (id: string, data: UpdatePhaseInput) => {
      const result = await updatePhase.mutate(id, data);
      await phasesQuery.refetch();
      return result;
    },
    [updatePhase, phasesQuery]
  );

  const handleDeletePhase = useCallback(
    async (id: string) => {
      await deletePhase.mutate(id);
      await phasesQuery.refetch();
      await featuresQuery.refetch();
    },
    [deletePhase, phasesQuery, featuresQuery]
  );

  const handleReorderPhases = useCallback(
    async (updates: { phaseId: string; order: number }[]) => {
      await reorderPhases.mutate(updates);
      await phasesQuery.refetch();
    },
    [reorderPhases, phasesQuery]
  );

  const handleCreateFeature = useCallback(
    async (data: CreateFeatureInput) => {
      const result = await createFeature.mutate(data);
      await featuresQuery.refetch();
      return result;
    },
    [createFeature, featuresQuery]
  );

  const handleUpdateFeature = useCallback(
    async (id: string, data: UpdateFeatureInput) => {
      const result = await updateFeature.mutate(id, data);
      await featuresQuery.refetch();
      return result;
    },
    [updateFeature, featuresQuery]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      await deleteFeature.mutate(id);
      await featuresQuery.refetch();
    },
    [deleteFeature, featuresQuery]
  );

  const handleCreateMilestone = useCallback(
    async (data: CreateMilestoneInput) => {
      const result = await createMilestone.mutate(data);
      await phasesQuery.refetch();
      return result;
    },
    [createMilestone, phasesQuery]
  );

  const handleToggleMilestone = useCallback(
    async (id: string) => {
      const result = await toggleMilestone.mutate(id);
      await phasesQuery.refetch();
      return result;
    },
    [toggleMilestone, phasesQuery]
  );

  const handleDeleteMilestone = useCallback(
    async (id: string) => {
      await deleteMilestone.mutate(id);
      await phasesQuery.refetch();
    },
    [deleteMilestone, phasesQuery]
  );

  return {
    // Data
    phases: phasesQuery.data || [],
    features: featuresQuery.data || [],
    loading: phasesQuery.loading || featuresQuery.loading,
    error: phasesQuery.error || featuresQuery.error,
    refetch: () => {
      phasesQuery.refetch();
      featuresQuery.refetch();
    },

    // Phase mutations
    createPhase: {
      mutate: handleCreatePhase,
      loading: createPhase.loading,
      error: createPhase.error,
    },
    updatePhase: {
      mutate: handleUpdatePhase,
      loading: updatePhase.loading,
      error: updatePhase.error,
    },
    deletePhase: {
      mutate: handleDeletePhase,
      loading: deletePhase.loading,
      error: deletePhase.error,
    },
    reorderPhases: {
      mutate: handleReorderPhases,
      loading: reorderPhases.loading,
      error: reorderPhases.error,
    },

    // Feature mutations
    createFeature: {
      mutate: handleCreateFeature,
      loading: createFeature.loading,
      error: createFeature.error,
    },
    updateFeature: {
      mutate: handleUpdateFeature,
      loading: updateFeature.loading,
      error: updateFeature.error,
    },
    deleteFeature: {
      mutate: handleDeleteFeature,
      loading: deleteFeature.loading,
      error: deleteFeature.error,
    },

    // Milestone mutations
    createMilestone: {
      mutate: handleCreateMilestone,
      loading: createMilestone.loading,
      error: createMilestone.error,
    },
    toggleMilestone: {
      mutate: handleToggleMilestone,
      loading: toggleMilestone.loading,
      error: toggleMilestone.error,
    },
    deleteMilestone: {
      mutate: handleDeleteMilestone,
      loading: deleteMilestone.loading,
      error: deleteMilestone.error,
    },
  };
}
