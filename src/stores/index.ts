/**
 * Stores Index
 *
 * Central export point for all Zustand stores.
 *
 * @module stores
 */

export {
  useNetworkStore,
  initNetworkListeners,
  selectHasPendingChanges,
  selectEffectiveStatus,
  selectSyncSummary,
  type NetworkState,
  type NetworkActions,
  type NetworkStatus,
  type PendingChange,
} from './network-store';

export {
  useConflictStore,
  selectPendingConflicts,
  selectHasConflicts,
  selectPendingCount,
  selectActiveConflict,
  selectConflictsByType,
} from './conflict-store';

export type { ConflictState, ConflictActions } from '@/types/conflict';
