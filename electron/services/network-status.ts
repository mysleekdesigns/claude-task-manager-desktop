/**
 * Network Status Service
 *
 * Monitors network connectivity using multiple strategies:
 * - Electron's net.isOnline() API (reliable for offline detection)
 * - Periodic Supabase ping (verifies actual cloud connectivity)
 * - Exponential backoff during recovery
 *
 * Connection states:
 * - 'online': Connected to internet and Supabase is reachable
 * - 'offline': No network connection detected
 * - 'reconnecting': Network detected but verifying Supabase connectivity
 *
 * @module electron/services/network-status
 * @phase 18 - Offline Support & Conflict Resolution
 */

import { net } from 'electron';
import Store from 'electron-store';
import { supabaseService } from './supabase.js';

/**
 * Network connection states
 */
export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

/**
 * Network status details returned to consumers
 */
export interface NetworkStatusInfo {
  status: NetworkStatus;
  isOnline: boolean;
  lastOnlineAt: string | null;
  lastCheckedAt: string | null;
  supabaseReachable: boolean;
}

/**
 * Callback type for network status change events
 */
type NetworkStatusCallback = (status: NetworkStatusInfo) => void;

/**
 * electron-store schema for network status persistence
 */
interface NetworkStatusStore {
  lastKnownStatus: NetworkStatus;
  lastOnlineAt: string | null;
  lastCheckedAt: string | null;
}

/**
 * Minimal store interface matching the electron-store methods we use
 */
interface NetworkStatusStoreInterface {
  get<K extends keyof NetworkStatusStore>(key: K): NetworkStatusStore[K];
  set<K extends keyof NetworkStatusStore>(key: K, value: NetworkStatusStore[K]): void;
}

/**
 * In-memory fallback store for when electron-store cannot write to disk
 * (e.g., during E2E tests or sandboxed environments)
 */
class InMemoryNetworkStatusStore implements NetworkStatusStoreInterface {
  private data: NetworkStatusStore = {
    lastKnownStatus: 'offline',
    lastOnlineAt: null,
    lastCheckedAt: null,
  };

  get<K extends keyof NetworkStatusStore>(key: K): NetworkStatusStore[K] {
    return this.data[key];
  }

  set<K extends keyof NetworkStatusStore>(key: K, value: NetworkStatusStore[K]): void {
    this.data[key] = value;
  }
}

/**
 * Default ping interval when online (30 seconds)
 */
const ONLINE_PING_INTERVAL_MS = 30_000;

/**
 * Ping interval when reconnecting (5 seconds)
 */
const RECONNECTING_PING_INTERVAL_MS = 5_000;

/**
 * Minimum interval between pings (prevents excessive requests)
 */
const MIN_PING_INTERVAL_MS = 2_000;

/**
 * Timeout for Supabase ping requests
 */
const PING_TIMEOUT_MS = 10_000;

/**
 * Number of consecutive successful pings required to transition from reconnecting to online
 */
const RECONNECT_SUCCESS_THRESHOLD = 2;

/**
 * NetworkStatusService Class
 *
 * Singleton service that monitors network connectivity and provides
 * status updates to the application. Uses multiple detection strategies
 * for reliable online/offline state management.
 */
class NetworkStatusService {
  private store: NetworkStatusStoreInterface;
  private currentStatus: NetworkStatus = 'offline';
  private supabaseReachable = false;
  private statusCallbacks: Set<NetworkStatusCallback> = new Set();
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private consecutiveSuccessfulPings = 0;
  private lastPingTime = 0;
  private initialized = false;

  constructor() {
    // Initialize electron-store for network status persistence
    // Falls back to in-memory storage on permission errors (e.g., E2E tests, sandboxed environments)
    try {
      this.store = new Store<NetworkStatusStore>({
        name: 'network-status',
        defaults: {
          lastKnownStatus: 'offline',
          lastOnlineAt: null,
          lastCheckedAt: null,
        },
      });
    } catch (error) {
      // Handle EPERM and other permission errors by falling back to in-memory storage
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'EPERM' || errorCode === 'EACCES' || errorCode === 'EROFS') {
        console.warn(
          `[NetworkStatus] Cannot write to disk (${errorCode}), using in-memory storage. ` +
            'Network status will not persist across app restarts.'
        );
        this.store = new InMemoryNetworkStatusStore();
      } else {
        // For unexpected errors, still fall back but log more details
        console.warn(
          '[NetworkStatus] Failed to initialize electron-store, using in-memory fallback:',
          error
        );
        this.store = new InMemoryNetworkStatusStore();
      }
    }

    // Initialize from stored state
    this.currentStatus = this.store.get('lastKnownStatus');
  }

  /**
   * Initialize the network status service.
   *
   * Sets up network monitoring using Electron's net module and
   * starts periodic Supabase ping checks.
   */
  initialize(): void {
    if (this.initialized) {
      console.log('[NetworkStatus] Already initialized');
      return;
    }

    console.log('[NetworkStatus] Initializing network status service...');

    // Perform initial check
    this.performNetworkCheck();

    // Start periodic ping interval
    this.startPingInterval();

    this.initialized = true;
    console.log('[NetworkStatus] Network status service initialized');
  }

  /**
   * Start the periodic ping interval.
   * Interval adjusts based on current connection state.
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    const interval =
      this.currentStatus === 'reconnecting'
        ? RECONNECTING_PING_INTERVAL_MS
        : ONLINE_PING_INTERVAL_MS;

    this.pingIntervalId = setInterval(() => {
      this.performNetworkCheck();
    }, interval);

    console.log(`[NetworkStatus] Started ping interval: ${interval}ms`);
  }

  /**
   * Stop the periodic ping interval.
   */
  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  /**
   * Perform a network connectivity check.
   *
   * Uses multiple strategies:
   * 1. Electron's net.isOnline() for basic network detection
   * 2. Supabase ping for actual cloud connectivity
   */
  async performNetworkCheck(): Promise<NetworkStatusInfo> {
    const now = Date.now();

    // Rate limit pings to prevent excessive requests
    if (now - this.lastPingTime < MIN_PING_INTERVAL_MS) {
      return this.getStatus();
    }

    this.lastPingTime = now;

    // Step 1: Check basic network connectivity via Electron
    const netOnline = net.isOnline();

    if (!netOnline) {
      // net.isOnline() false is reliable - we're definitely offline
      this.updateStatus('offline', false);
      return this.getStatus();
    }

    // Step 2: Network appears online, verify Supabase connectivity
    // If currently offline, transition to reconnecting first
    if (this.currentStatus === 'offline') {
      this.updateStatus('reconnecting', false);
      this.consecutiveSuccessfulPings = 0;
      // Restart interval with faster ping rate
      this.startPingInterval();
    }

    // Step 3: Ping Supabase to verify actual connectivity
    const supabaseReachable = await this.pingSupabase();

    if (supabaseReachable) {
      this.consecutiveSuccessfulPings++;

      if (
        this.currentStatus === 'reconnecting' &&
        this.consecutiveSuccessfulPings >= RECONNECT_SUCCESS_THRESHOLD
      ) {
        // Enough successful pings, we're back online
        this.updateStatus('online', true);
        // Restart interval with normal ping rate
        this.startPingInterval();
      } else if (this.currentStatus === 'online') {
        // Already online, just update reachability
        this.supabaseReachable = true;
        this.updateLastChecked();
      }
    } else {
      this.consecutiveSuccessfulPings = 0;

      if (this.currentStatus === 'online') {
        // Was online, now can't reach Supabase - start reconnecting
        this.updateStatus('reconnecting', false);
        this.startPingInterval();
      }
      // If already reconnecting, stay in that state
    }

    return this.getStatus();
  }

  /**
   * Ping Supabase to verify connectivity.
   *
   * @returns true if Supabase is reachable
   */
  private async pingSupabase(): Promise<boolean> {
    if (!supabaseService.isInitialized()) {
      // Supabase not configured - consider it reachable if net is online
      // This allows offline-only mode to work
      return net.isOnline();
    }

    try {
      const supabase = supabaseService.getClient();

      // Use a simple health check - query a small amount of data
      // We use a promise race to implement timeout
      const pingPromise = supabase.from('projects').select('id').limit(1);

      const timeoutPromise = new Promise<{ error: { message: string } }>(
        (resolve) => {
          setTimeout(() => {
            resolve({ error: { message: 'Ping timeout' } });
          }, PING_TIMEOUT_MS);
        }
      );

      const result = await Promise.race([pingPromise, timeoutPromise]);

      // Check if we got an error (either from Supabase or timeout)
      if ('error' in result && result.error) {
        console.log('[NetworkStatus] Supabase ping failed:', result.error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.log(
        '[NetworkStatus] Supabase ping error:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Update the current network status and notify listeners.
   *
   * @param newStatus - The new network status
   * @param supabaseReachable - Whether Supabase is reachable
   */
  private updateStatus(newStatus: NetworkStatus, supabaseReachable: boolean): void {
    const previousStatus = this.currentStatus;
    this.currentStatus = newStatus;
    this.supabaseReachable = supabaseReachable;

    // Update persistence
    this.store.set('lastKnownStatus', newStatus);
    this.store.set('lastCheckedAt', new Date().toISOString());

    if (newStatus === 'online') {
      this.store.set('lastOnlineAt', new Date().toISOString());
    }

    // Log status changes
    if (previousStatus !== newStatus) {
      console.log(`[NetworkStatus] Status changed: ${previousStatus} -> ${newStatus}`);
    }

    // Notify all callbacks
    this.notifyStatusChange();
  }

  /**
   * Update the last checked timestamp without changing status.
   */
  private updateLastChecked(): void {
    this.store.set('lastCheckedAt', new Date().toISOString());
  }

  /**
   * Notify all registered callbacks of a status change.
   */
  private notifyStatusChange(): void {
    const statusInfo = this.getStatus();

    this.statusCallbacks.forEach((callback) => {
      try {
        callback(statusInfo);
      } catch (error) {
        console.error('[NetworkStatus] Error in status callback:', error);
      }
    });
  }

  /**
   * Get the current network status information.
   *
   * @returns Current network status details
   */
  getStatus(): NetworkStatusInfo {
    return {
      status: this.currentStatus,
      isOnline: this.currentStatus === 'online',
      lastOnlineAt: this.store.get('lastOnlineAt'),
      lastCheckedAt: this.store.get('lastCheckedAt'),
      supabaseReachable: this.supabaseReachable,
    };
  }

  /**
   * Subscribe to network status changes.
   *
   * @param callback - Function to call when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(callback: NetworkStatusCallback): () => void {
    this.statusCallbacks.add(callback);

    // Immediately call with current status
    callback(this.getStatus());

    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Manually trigger a connectivity check.
   *
   * Useful for user-initiated "retry" actions or after
   * app comes back from sleep/background.
   *
   * @returns Current network status after check
   */
  async ping(): Promise<NetworkStatusInfo> {
    // Reset ping time to allow immediate check
    this.lastPingTime = 0;
    return this.performNetworkCheck();
  }

  /**
   * Check if currently online (simple boolean check).
   *
   * @returns true if status is 'online'
   */
  isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Check if currently offline (includes reconnecting state).
   *
   * @returns true if status is 'offline' or 'reconnecting'
   */
  isOffline(): boolean {
    return this.currentStatus !== 'online';
  }

  /**
   * Clean up resources when service is being shut down.
   */
  cleanup(): void {
    this.stopPingInterval();
    this.statusCallbacks.clear();
    console.log('[NetworkStatus] Cleanup complete');
  }
}

// Export singleton instance
export const networkStatusService = new NetworkStatusService();
