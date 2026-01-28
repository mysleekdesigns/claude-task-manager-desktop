/**
 * Conflict Store
 *
 * Zustand store for managing sync conflicts and their resolution.
 * Tracks active conflicts, resolution history, and modal state.
 *
 * @module stores/conflict-store
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  SyncConflict,
  ConflictResolution,
  ConflictState,
  ConflictActions,
} from '@/types/conflict';

// ============================================================================
// Initial State
// ============================================================================

const initialState: ConflictState = {
  conflicts: [],
  resolutionHistory: [],
  activeConflictId: null,
  isResolutionModalOpen: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Conflict store for managing sync conflicts and resolution.
 *
 * Uses subscribeWithSelector middleware for granular subscriptions.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const conflicts = useConflictStore((state) => state.conflicts);
 *
 * // Subscribe to conflict count changes
 * useConflictStore.subscribe(
 *   (state) => state.conflicts.length,
 *   (count) => console.log('Conflict count changed:', count)
 * );
 * ```
 */
export const useConflictStore = create<ConflictState & ConflictActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    addConflict: (conflict) => {
      const newConflict: SyncConflict = {
        ...conflict,
        id: crypto.randomUUID(),
        detectedAt: new Date(),
        status: 'pending',
      };

      set((state) => ({
        conflicts: [...state.conflicts, newConflict],
      }));
    },

    removeConflict: (id) => {
      set((state) => ({
        conflicts: state.conflicts.filter((c) => c.id !== id),
        activeConflictId: state.activeConflictId === id ? null : state.activeConflictId,
      }));
    },

    resolveConflict: (conflictId, resolution, mergedData, resolvedBy) => {
      const conflict = get().conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      const resolutionRecord: ConflictResolution = {
        conflictId,
        resolution,
        mergedData,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'current-user',
      };

      set((state) => ({
        conflicts: state.conflicts.map((c) =>
          c.id === conflictId ? { ...c, status: 'resolved' as const } : c
        ),
        resolutionHistory: [...state.resolutionHistory, resolutionRecord],
        activeConflictId: state.activeConflictId === conflictId ? null : state.activeConflictId,
        isResolutionModalOpen: state.activeConflictId === conflictId ? false : state.isResolutionModalOpen,
      }));

      // Remove resolved conflict after a short delay
      setTimeout(() => {
        set((state) => ({
          conflicts: state.conflicts.filter((c) => c.id !== conflictId),
        }));
      }, 2000);
    },

    dismissConflict: (conflictId) => {
      set((state) => ({
        conflicts: state.conflicts.map((c) =>
          c.id === conflictId ? { ...c, status: 'dismissed' as const } : c
        ),
        activeConflictId: state.activeConflictId === conflictId ? null : state.activeConflictId,
        isResolutionModalOpen: state.activeConflictId === conflictId ? false : state.isResolutionModalOpen,
      }));

      // Remove dismissed conflict after a short delay
      setTimeout(() => {
        set((state) => ({
          conflicts: state.conflicts.filter((c) => c.id !== conflictId),
        }));
      }, 1000);
    },

    setActiveConflict: (conflictId) => {
      set({
        activeConflictId: conflictId,
        isResolutionModalOpen: conflictId !== null,
      });
    },

    setResolutionModalOpen: (open) => {
      set({
        isResolutionModalOpen: open,
        activeConflictId: open ? get().activeConflictId : null,
      });
    },

    clearAllConflicts: () => {
      set({
        conflicts: [],
        activeConflictId: null,
        isResolutionModalOpen: false,
      });
    },

    getPendingCount: () => {
      return get().conflicts.filter((c) => c.status === 'pending').length;
    },

    getConflictById: (id) => {
      return get().conflicts.find((c) => c.id === id);
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

// Memoization cache for selectors that return arrays/objects
// This prevents infinite re-render loops caused by returning new references
let _cachedPendingConflicts: SyncConflict[] = [];
let _cachedPendingConflictsKey = '';

let _cachedActiveConflict: SyncConflict | undefined = undefined;
let _cachedActiveConflictKey = '';

/**
 * Selector for pending conflicts
 * Uses memoization to return stable reference when conflicts haven't changed
 */
export const selectPendingConflicts = (state: ConflictState): SyncConflict[] => {
  // Create a cache key based on conflicts array reference and length
  const cacheKey = `${state.conflicts.length}-${state.conflicts.map(c => `${c.id}:${c.status}`).join(',')}`;

  if (cacheKey !== _cachedPendingConflictsKey) {
    _cachedPendingConflicts = state.conflicts.filter((c) => c.status === 'pending');
    _cachedPendingConflictsKey = cacheKey;
  }

  return _cachedPendingConflicts;
};

/**
 * Selector for checking if there are any pending conflicts
 */
export const selectHasConflicts = (state: ConflictState): boolean =>
  state.conflicts.some((c) => c.status === 'pending');

/**
 * Selector for pending conflict count
 */
export const selectPendingCount = (state: ConflictState): number =>
  state.conflicts.filter((c) => c.status === 'pending').length;

/**
 * Selector for the active conflict
 * Uses memoization to return stable reference
 */
export const selectActiveConflict = (state: ConflictState & ConflictActions): SyncConflict | undefined => {
  const cacheKey = `${state.activeConflictId}-${state.conflicts.map(c => c.id).join(',')}`;

  if (cacheKey !== _cachedActiveConflictKey) {
    _cachedActiveConflict = state.activeConflictId
      ? state.conflicts.find((c) => c.id === state.activeConflictId)
      : undefined;
    _cachedActiveConflictKey = cacheKey;
  }

  return _cachedActiveConflict;
};

/**
 * Selector for conflicts by entity type
 * Note: This selector should be used with useMemo in components to avoid re-renders
 */
export const selectConflictsByType = (state: ConflictState, entityType: string): SyncConflict[] =>
  state.conflicts.filter((c) => c.entityType === entityType && c.status === 'pending');

export default useConflictStore;
