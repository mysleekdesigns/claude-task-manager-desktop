/**
 * Conflict Resolution Hook
 *
 * Hook for managing sync conflict state and resolution actions.
 * Provides convenient access to conflict store with derived state.
 *
 * @module hooks/useConflictResolution
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  useConflictStore,
  selectPendingConflicts,
  selectHasConflicts,
  selectPendingCount,
  selectActiveConflict,
} from '@/stores/conflict-store';
import type {
  SyncConflict,
  ConflictResolutionType,
  ConflictEntityType,
  FieldDifference,
} from '@/types/conflict';

// ============================================================================
// Types
// ============================================================================

export interface UseConflictResolutionReturn {
  /** All pending conflicts */
  conflicts: SyncConflict[];
  /** Whether there are any pending conflicts */
  hasConflicts: boolean;
  /** Count of pending conflicts */
  pendingCount: number;
  /** Currently active conflict for resolution */
  activeConflict: SyncConflict | undefined;
  /** Whether the resolution modal is open */
  isModalOpen: boolean;
  /** Resolve a conflict with the given resolution type */
  resolveConflict: (
    conflictId: string,
    resolution: ConflictResolutionType,
    mergedData?: Record<string, unknown>
  ) => void;
  /** Dismiss a conflict without resolving */
  dismissConflict: (conflictId: string) => void;
  /** Open the resolution modal for a specific conflict */
  openConflictModal: (conflictId: string) => void;
  /** Close the resolution modal */
  closeConflictModal: () => void;
  /** Get the active conflicts for display */
  getActiveConflicts: () => SyncConflict[];
  /** Get field differences for a conflict */
  getFieldDifferences: (conflict: SyncConflict) => FieldDifference[];
  /** Resolve with local version */
  keepLocalVersion: (conflictId: string) => void;
  /** Resolve with server version */
  keepServerVersion: (conflictId: string) => void;
  /** Resolve with merged data */
  mergeVersions: (conflictId: string, mergedData: Record<string, unknown>) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the type of a value for display purposes
 */
function getValueType(value: unknown): FieldDifference['valueType'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  const type = typeof value;
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'object') return 'object';
  return 'string';
}

/**
 * Extract field differences between local and server versions
 */
function extractFieldDifferences(
  localVersion: Record<string, unknown>,
  serverVersion: Record<string, unknown>,
  conflictFields: string[]
): FieldDifference[] {
  return conflictFields.map((field) => ({
    field,
    localValue: localVersion[field],
    serverValue: serverVersion[field],
    valueType: getValueType(localVersion[field]) || getValueType(serverVersion[field]),
  }));
}

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

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing sync conflict resolution.
 *
 * Provides convenient access to conflict store with derived state
 * and action methods for resolving conflicts.
 *
 * @example
 * ```tsx
 * function ConflictManager() {
 *   const {
 *     conflicts,
 *     hasConflicts,
 *     pendingCount,
 *     resolveConflict,
 *     openConflictModal,
 *   } = useConflictResolution();
 *
 *   if (!hasConflicts) return null;
 *
 *   return (
 *     <div>
 *       <p>{pendingCount} conflicts to resolve</p>
 *       {conflicts.map((conflict) => (
 *         <button
 *           key={conflict.id}
 *           onClick={() => openConflictModal(conflict.id)}
 *         >
 *           Resolve {conflict.entityName}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConflictResolution(): UseConflictResolutionReturn {
  // Store subscriptions
  const conflicts = useConflictStore(selectPendingConflicts);
  const hasConflicts = useConflictStore(selectHasConflicts);
  const pendingCount = useConflictStore(selectPendingCount);
  const activeConflict = useConflictStore(selectActiveConflict);
  const isModalOpen = useConflictStore((state) => state.isResolutionModalOpen);

  // Store actions
  const storeResolveConflict = useConflictStore((state) => state.resolveConflict);
  const storeDismissConflict = useConflictStore((state) => state.dismissConflict);
  const setActiveConflict = useConflictStore((state) => state.setActiveConflict);
  const setResolutionModalOpen = useConflictStore((state) => state.setResolutionModalOpen);

  // Resolve a conflict with notification
  const resolveConflict = useCallback(
    (
      conflictId: string,
      resolution: ConflictResolutionType,
      mergedData?: Record<string, unknown>
    ) => {
      const conflict = useConflictStore.getState().conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      storeResolveConflict(conflictId, resolution, mergedData);

      const entityLabel = getEntityTypeLabel(conflict.entityType);
      const resolutionLabel = {
        keep_local: 'Kept local version',
        keep_server: 'Kept server version',
        merged: 'Merged changes',
      }[resolution];

      toast.success(`${entityLabel} conflict resolved`, {
        description: resolutionLabel,
      });
    },
    [storeResolveConflict]
  );

  // Dismiss a conflict
  const dismissConflict = useCallback(
    (conflictId: string) => {
      storeDismissConflict(conflictId);
      toast.info('Conflict dismissed');
    },
    [storeDismissConflict]
  );

  // Open the resolution modal for a specific conflict
  const openConflictModal = useCallback(
    (conflictId: string) => {
      setActiveConflict(conflictId);
    },
    [setActiveConflict]
  );

  // Close the resolution modal
  const closeConflictModal = useCallback(() => {
    setResolutionModalOpen(false);
  }, [setResolutionModalOpen]);

  // Get active conflicts for display
  const getActiveConflicts = useCallback(() => {
    return useConflictStore.getState().conflicts.filter((c) => c.status === 'pending');
  }, []);

  // Get field differences for a conflict
  const getFieldDifferences = useCallback((conflict: SyncConflict): FieldDifference[] => {
    return extractFieldDifferences(
      conflict.localVersion,
      conflict.serverVersion,
      conflict.conflictFields
    );
  }, []);

  // Convenience methods for resolution types
  const keepLocalVersion = useCallback(
    (conflictId: string) => {
      resolveConflict(conflictId, 'keep_local');
    },
    [resolveConflict]
  );

  const keepServerVersion = useCallback(
    (conflictId: string) => {
      resolveConflict(conflictId, 'keep_server');
    },
    [resolveConflict]
  );

  const mergeVersions = useCallback(
    (conflictId: string, mergedData: Record<string, unknown>) => {
      resolveConflict(conflictId, 'merged', mergedData);
    },
    [resolveConflict]
  );

  return {
    conflicts,
    hasConflicts,
    pendingCount,
    activeConflict,
    isModalOpen,
    resolveConflict,
    dismissConflict,
    openConflictModal,
    closeConflictModal,
    getActiveConflicts,
    getFieldDifferences,
    keepLocalVersion,
    keepServerVersion,
    mergeVersions,
  };
}

export default useConflictResolution;
