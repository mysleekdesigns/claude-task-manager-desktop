/**
 * Supabase Real-Time Service
 *
 * Manages real-time subscriptions to Supabase Postgres Changes for collaborative sync.
 * Handles subscription lifecycle: connect, reconnect with exponential backoff, cleanup.
 * Forwards changes to renderer via IPC.
 *
 * @module electron/services/realtime
 * @phase 17 - Real-Time Sync Engine
 */

import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from '@supabase/supabase-js';
import { BrowserWindow } from 'electron';
import { supabaseService, ConnectionStatus } from './supabase';

// ============================================================================
// Types
// ============================================================================

/**
 * Table names that support real-time subscriptions
 */
export type SyncTableName = 'projects' | 'tasks' | 'project_members';

/**
 * Change event types from Postgres
 */
export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Payload structure for real-time changes sent to renderer
 */
export interface RealtimeChangePayload<T = Record<string, unknown>> {
  eventType: ChangeEventType;
  table: SyncTableName;
  old: Partial<T>;
  new: Partial<T>;
  commitTimestamp: string;
  schema: string;
}

/**
 * Subscription status for a specific project
 */
export interface SubscriptionStatus {
  projectId: string;
  channelName: string;
  status: 'connecting' | 'subscribed' | 'error' | 'closed';
  error?: string;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
}

/**
 * Options for creating a subscription
 */
interface SubscriptionOptions {
  projectId: string;
  tables?: SyncTableName[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TABLES: SyncTableName[] = ['projects', 'tasks', 'project_members'];
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// ============================================================================
// RealtimeService Class
// ============================================================================

/**
 * Service for managing Supabase real-time subscriptions
 *
 * Provides:
 * - Per-project channel subscriptions with Postgres Changes listeners
 * - Automatic reconnection with exponential backoff
 * - IPC forwarding to renderer process
 * - Subscription lifecycle management
 */
class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptionStatuses: Map<string, SubscriptionStatus> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isCleaningUp = false;

  // ============================================================================
  // Window Management
  // ============================================================================

  /**
   * Set the main window reference for IPC communication
   *
   * @param window - The main BrowserWindow instance
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Clear the main window reference (e.g., on window close)
   */
  public clearMainWindow(): void {
    this.mainWindow = null;
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe to real-time changes for a specific project
   *
   * Creates a Supabase channel with Postgres Changes listeners for:
   * - projects (filtered by id)
   * - tasks (filtered by project_id)
   * - project_members (filtered by project_id)
   *
   * @param projectId - The project ID to subscribe to
   * @param options - Optional subscription options
   * @throws Error if Supabase is not initialized
   */
  public async subscribeToProject(
    projectId: string,
    options?: Partial<Omit<SubscriptionOptions, 'projectId'>>
  ): Promise<void> {
    // Check if Supabase is initialized
    if (!supabaseService.isInitialized()) {
      console.warn('Supabase not initialized, skipping real-time subscription');
      return;
    }

    const channelName = this.getChannelName(projectId);
    const tables = options?.tables ?? DEFAULT_TABLES;

    // Don't duplicate subscriptions
    if (this.channels.has(channelName)) {
      console.log(`Already subscribed to project ${projectId}`);
      return;
    }

    // Initialize subscription status
    this.subscriptionStatuses.set(channelName, {
      projectId,
      channelName,
      status: 'connecting',
      reconnectAttempts: 0,
    });

    // Broadcast connecting status
    this.broadcastStatus('connecting');

    try {
      const client = supabaseService.getClient();
      const channel = client.channel(channelName);

      // Subscribe to each table with appropriate filters
      for (const table of tables) {
        const filter = this.getFilterForTable(table, projectId);

        channel.on(
          'postgres_changes' as const,
          {
            event: '*',
            schema: 'public',
            table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            this.handleChange(table, payload);
          }
        );
      }

      // Subscribe and handle status changes
      channel.subscribe((status, error) => {
        this.handleSubscriptionStatus(channelName, status, error ?? undefined);
      });

      // Store the channel
      this.channels.set(channelName, channel);

      console.log(`Subscribed to real-time changes for project ${projectId}`);
    } catch (error) {
      console.error(`Failed to subscribe to project ${projectId}:`, error);
      this.updateSubscriptionStatus(channelName, 'error', error as Error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a specific project's real-time changes
   *
   * @param projectId - The project ID to unsubscribe from
   */
  public async unsubscribeFromProject(projectId: string): Promise<void> {
    const channelName = this.getChannelName(projectId);
    await this.removeChannel(channelName);
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  public async unsubscribeAll(): Promise<void> {
    this.isCleaningUp = true;

    // Clear all reconnect timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();

    // Remove all channels
    const channelNames = Array.from(this.channels.keys());
    await Promise.all(channelNames.map((name) => this.removeChannel(name)));

    // Clear status map
    this.subscriptionStatuses.clear();

    this.isCleaningUp = false;
    console.log('Unsubscribed from all real-time channels');
  }

  /**
   * Get list of active subscription project IDs
   *
   * @returns Array of project IDs with active subscriptions
   */
  public getActiveSubscriptions(): string[] {
    const activeProjectIds: string[] = [];

    for (const [_channelName, status] of this.subscriptionStatuses) {
      if (status.status === 'subscribed') {
        activeProjectIds.push(status.projectId);
      }
    }

    return activeProjectIds;
  }

  /**
   * Get subscription status for a specific project
   *
   * @param projectId - The project ID to check
   * @returns The subscription status or undefined if not subscribed
   */
  public getSubscriptionStatus(projectId: string): SubscriptionStatus | undefined {
    const channelName = this.getChannelName(projectId);
    return this.subscriptionStatuses.get(channelName);
  }

  /**
   * Get all subscription statuses
   *
   * @returns Map of channel names to subscription statuses
   */
  public getAllSubscriptionStatuses(): Map<string, SubscriptionStatus> {
    return new Map(this.subscriptionStatuses);
  }

  // ============================================================================
  // Change Handling
  // ============================================================================

  /**
   * Handle incoming Postgres change from Supabase
   *
   * @param table - The table that changed
   * @param payload - The change payload from Supabase
   */
  private handleChange(
    table: SyncTableName,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): void {
    const eventType = payload.eventType as ChangeEventType;

    // Format the change payload for the renderer
    const change: RealtimeChangePayload = {
      eventType,
      table,
      old: payload.old ?? {},
      new: payload.new ?? {},
      commitTimestamp: payload.commit_timestamp ?? new Date().toISOString(),
      schema: payload.schema ?? 'public',
    };

    console.log(`Real-time ${eventType} on ${table}:`, {
      old: change.old,
      new: change.new,
    });

    // Send to renderer via IPC
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:incoming-change', change);
    }

    // Emit a table-specific event as well for granular handling
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`sync:${table}-change`, change);
    }
  }

  // ============================================================================
  // Subscription Status Handling
  // ============================================================================

  /**
   * Handle subscription status changes from Supabase
   *
   * @param channelName - The channel name
   * @param status - The subscription status from Supabase
   * @param error - Optional error if status is an error state
   */
  private handleSubscriptionStatus(
    channelName: string,
    status: `${REALTIME_SUBSCRIBE_STATES}`,
    error?: Error
  ): void {
    const subscriptionStatus = this.subscriptionStatuses.get(channelName);
    if (!subscriptionStatus) {
      return;
    }

    console.log(`Subscription status for ${channelName}: ${status}`, error?.message);

    switch (status) {
      case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
        // Successfully subscribed
        this.updateSubscriptionStatus(channelName, 'subscribed');
        subscriptionStatus.reconnectAttempts = 0;
        subscriptionStatus.lastConnectedAt = new Date();
        this.broadcastStatus('online');
        break;

      case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
      case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
        // Error or timeout - attempt reconnect
        this.updateSubscriptionStatus(channelName, 'error', error);
        this.broadcastStatus('offline');
        this.attemptReconnect(channelName);
        break;

      case REALTIME_SUBSCRIBE_STATES.CLOSED:
        // Channel closed - remove from tracking
        this.updateSubscriptionStatus(channelName, 'closed');
        this.channels.delete(channelName);
        // Only broadcast offline if no other channels are subscribed
        if (this.channels.size === 0) {
          this.broadcastStatus('offline');
        }
        break;

      default:
        // SUBSCRIBING state or unknown
        this.updateSubscriptionStatus(channelName, 'connecting');
        break;
    }
  }

  /**
   * Update the subscription status for a channel
   *
   * @param channelName - The channel name
   * @param status - The new status
   * @param error - Optional error
   */
  private updateSubscriptionStatus(
    channelName: string,
    status: SubscriptionStatus['status'],
    error?: Error
  ): void {
    const subscriptionStatus = this.subscriptionStatuses.get(channelName);
    if (subscriptionStatus) {
      subscriptionStatus.status = status;
      if (error?.message) {
        subscriptionStatus.error = error.message;
      }
    }
  }

  // ============================================================================
  // Reconnection Logic
  // ============================================================================

  /**
   * Attempt to reconnect to a channel with exponential backoff
   *
   * @param channelName - The channel name to reconnect
   */
  private async attemptReconnect(channelName: string): Promise<void> {
    // Don't reconnect during cleanup
    if (this.isCleaningUp) {
      return;
    }

    const subscriptionStatus = this.subscriptionStatuses.get(channelName);
    if (!subscriptionStatus) {
      return;
    }

    // Check max attempts
    if (subscriptionStatus.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${channelName}`
      );
      this.updateSubscriptionStatus(
        channelName,
        'error',
        new Error('Max reconnect attempts reached')
      );
      return;
    }

    // Increment attempt counter
    subscriptionStatus.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, subscriptionStatus.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    console.log(
      `Reconnecting ${channelName} in ${delay}ms (attempt ${subscriptionStatus.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    // Clear any existing timeout for this channel
    const existingTimeout = this.reconnectTimeouts.get(channelName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule reconnection
    const timeout = setTimeout(async () => {
      this.reconnectTimeouts.delete(channelName);

      // Remove the old channel first
      await this.removeChannel(channelName);

      // Re-subscribe
      try {
        await this.subscribeToProject(subscriptionStatus.projectId);
      } catch (error) {
        console.error(`Reconnection failed for ${channelName}:`, error);
        // The subscription status will be updated by subscribeToProject
      }
    }, delay);

    this.reconnectTimeouts.set(channelName, timeout);
  }

  // ============================================================================
  // Status Broadcasting
  // ============================================================================

  /**
   * Broadcast connection status change to renderer
   *
   * @param status - The new connection status
   */
  private broadcastStatus(status: ConnectionStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:status-change', status);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a unique channel name for a project
   *
   * @param projectId - The project ID
   * @returns The channel name
   */
  private getChannelName(projectId: string): string {
    return `project-sync:${projectId}`;
  }

  /**
   * Get the Postgres filter for a specific table
   *
   * @param table - The table name
   * @param projectId - The project ID
   * @returns The filter string for Postgres Changes
   */
  private getFilterForTable(table: SyncTableName, projectId: string): string {
    switch (table) {
      case 'projects':
        // Filter projects by id
        return `id=eq.${projectId}`;
      case 'tasks':
      case 'project_members':
        // Filter by project_id
        return `project_id=eq.${projectId}`;
      default:
        return '';
    }
  }

  /**
   * Remove a channel and clean up resources
   *
   * @param channelName - The channel name to remove
   */
  private async removeChannel(channelName: string): Promise<void> {
    // Clear any pending reconnect timeout
    const timeout = this.reconnectTimeouts.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(channelName);
    }

    // Get and remove the channel
    const channel = this.channels.get(channelName);
    if (channel) {
      try {
        const client = supabaseService.getClient();
        await client.removeChannel(channel);
      } catch (error) {
        console.error(`Error removing channel ${channelName}:`, error);
      }
      this.channels.delete(channelName);
    }

    // Remove from status tracking
    this.subscriptionStatuses.delete(channelName);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up all resources on app quit
   */
  public async cleanup(): Promise<void> {
    await this.unsubscribeAll();
    this.mainWindow = null;
    console.log('RealtimeService cleaned up');
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const realtimeService = new RealtimeService();
