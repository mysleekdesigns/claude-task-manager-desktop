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
