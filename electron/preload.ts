/**
 * Electron Preload Script
 *
 * This script runs in the renderer process before the web content loads.
 * It exposes a secure, type-safe IPC bridge to the renderer process.
 *
 * Security: Only whitelisted channels are allowed. All other channels are rejected.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// ============================================================================
// Channel Whitelists
// ============================================================================

/**
 * Whitelist of allowed invoke channels (renderer -> main)
 * These must match the channels defined in src/types/ipc.ts
 */
const VALID_INVOKE_CHANNELS = [
  // App info
  'app:getInfo',
  'app:getVersion',
  'app:getPlatform',
  'app:getPath',
  // Dialogs
  'dialog:openDirectory',
  // Window management
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:isMaximized',
  // Tray preferences
  'preferences:getMinimizeToTray',
  'preferences:setMinimizeToTray',
  'preferences:getCloseToTray',
  'preferences:setCloseToTray',
  // Authentication
  'auth:register',
  'auth:login',
  'auth:logout',
  'auth:getCurrentUser',
  'auth:updateProfile',
  // Projects
  'projects:list',
  'projects:create',
  'projects:get',
  'projects:update',
  'projects:delete',
  'projects:addMember',
  'projects:removeMember',
  'projects:updateMemberRole',
  // Tasks
  'tasks:list',
  'tasks:create',
  'tasks:get',
  'tasks:update',
  'tasks:delete',
  'tasks:updateStatus',
  'tasks:reorder',
  'tasks:addPhase',
  'tasks:addLog',
  'tasks:addFile',
  'tasks:getSubtasks',
  // Users
  'users:create',
  'users:getById',
  'users:getByEmail',
  'users:findByEmail',
  'users:update',
  'users:delete',
  // Roadmap (Phase 9)
  'phases:list',
  'phases:create',
  'phases:update',
  'phases:delete',
  'phases:reorder',
  'features:list',
  'features:create',
  'features:update',
  'features:delete',
  'features:createTask',
  'milestones:create',
  'milestones:toggle',
  'milestones:delete',
  // Ideas (Phase 13)
  'ideas:list',
  'ideas:get',
  'ideas:create',
  'ideas:update',
  'ideas:delete',
  'ideas:vote',
  'ideas:convertToFeature',
  // Changelog (Phase 13)
  'changelog:list',
  'changelog:create',
  'changelog:update',
  'changelog:delete',
  'changelog:export',
  // Notifications (Phase 13)
  'notifications:isSupported',
  'notifications:requestPermission',
  'notifications:show',
  'notifications:taskCompleted',
  'notifications:terminalError',
  'notifications:assignment',
  // Insights (Phase 13)
  'insights:getTaskMetrics',
  'insights:getTimeMetrics',
  'insights:getProductivityTrends',
  // Terminals
  'terminal:create',
  'terminal:write',
  'terminal:resize',
  'terminal:close',
  'terminal:list',
  'terminal:pause',
  'terminal:resume',
  'terminal:getBuffer',
  'terminal:clearOutputBuffer',
  // Worktrees
  'worktrees:list',
  'worktrees:create',
  'worktrees:get',
  'worktrees:update',
  'worktrees:delete',
  'worktrees:sync',
  // Git
  'branches:list',
  'git:status',
  // Memory (Phase 10)
  'memories:list',
  'memories:create',
  'memories:get',
  'memories:update',
  'memories:delete',
  'memories:search',
  // MCP (Phase 11)
  'mcp:list',
  'mcp:create',
  'mcp:get',
  'mcp:update',
  'mcp:delete',
  'mcp:toggle',
  'mcp:presets',
  'mcp:generateConfig',
  'mcp:writeConfig',
  'mcp:readConfig',
  // GitHub (Phase 12)
  'github:saveToken',
  'github:validateToken',
  'github:deleteToken',
  'github:getToken',
  'github:getIssues',
  'github:getIssue',
  'github:createIssue',
  'github:getPRs',
  'github:getPR',
  'github:createPR',
  // Settings (Phase 14)
  'settings:get',
  'settings:update',
  'settings:updateApiKey',
  'settings:updateProfile',
  // Claude Code (Phase 15)
  'claude:startTask',
  'claude:resumeTask',
  'claude:pauseTask',
  'claude:getTaskStatus',
] as const;

/**
 * Whitelist of allowed event channels (main -> renderer)
 * These must match the channels defined in src/types/ipc.ts
 */
const VALID_EVENT_CHANNELS = [
  'app:update-available',
  'app:update-downloaded',
  'app:update-progress',
] as const;

// ============================================================================
// Type Definitions
// ============================================================================

type ValidInvokeChannel = (typeof VALID_INVOKE_CHANNELS)[number];
type ValidEventChannel = (typeof VALID_EVENT_CHANNELS)[number];

/**
 * Dynamic event channels (supports template literals)
 */
type DynamicEventChannel =
  | `terminal:output:${string}`
  | `terminal:exit:${string}`
  | `terminal:status:${string}`;

/**
 * All valid event channels (static + dynamic)
 */
type AllValidEventChannels = ValidEventChannel | DynamicEventChannel;

/**
 * Type-safe invoke function signature
 */
type InvokeFunction = <T>(
  channel: ValidInvokeChannel,
  ...args: unknown[]
) => Promise<T>;

/**
 * Type-safe event listener function signature
 */
type OnFunction = (
  channel: AllValidEventChannels,
  callback: (...args: unknown[]) => void
) => void;

/**
 * Type-safe event remover function signature
 */
type RemoveListenerFunction = (
  channel: AllValidEventChannels,
  callback: (...args: unknown[]) => void
) => void;

/**
 * Electron API exposed to renderer process
 */
export interface ElectronAPI {
  /**
   * Invoke an IPC handler in the main process and get a response
   */
  invoke: InvokeFunction;

  /**
   * Listen for events sent from the main process
   */
  on: OnFunction;

  /**
   * Remove an event listener
   */
  removeListener: RemoveListenerFunction;

  /**
   * Platform identifier
   */
  platform: NodeJS.Platform;
}

// ============================================================================
// Channel Validation
// ============================================================================

/**
 * Check if a channel is in the invoke whitelist
 */
function isValidInvokeChannel(channel: string): channel is ValidInvokeChannel {
  return (VALID_INVOKE_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Check if a channel is in the event whitelist
 * Also supports dynamic channels like terminal:output:{id} and terminal:exit:{id}
 */
function isValidEventChannel(channel: string): channel is AllValidEventChannels {
  // Check static channels first
  if ((VALID_EVENT_CHANNELS as readonly string[]).includes(channel)) {
    return true;
  }

  // Check dynamic terminal channels
  if (
    channel.startsWith('terminal:output:') ||
    channel.startsWith('terminal:exit:') ||
    channel.startsWith('terminal:status:')
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// API Implementation
// ============================================================================

/**
 * Map to store original callbacks to their wrapped versions
 * This allows proper removal of event listeners
 */
const callbackMap = new WeakMap<
  (...args: unknown[]) => void,
  (_event: IpcRendererEvent, ...args: unknown[]) => void
>();

/**
 * The secure Electron API to expose to the renderer process
 */
const electronAPI: ElectronAPI = {
  /**
   * Invoke an IPC handler in the main process
   *
   * @param channel - The IPC channel to invoke (must be whitelisted)
   * @param args - Arguments to pass to the handler
   * @returns Promise resolving to the handler's return value
   * @throws Error if channel is not whitelisted
   */
  invoke: async <T>(
    channel: ValidInvokeChannel,
    ...args: unknown[]
  ): Promise<T> => {
    if (!isValidInvokeChannel(channel)) {
      throw new Error(
        `IPC Security: Channel "${String(channel)}" is not allowed. ` +
          `Allowed channels: ${VALID_INVOKE_CHANNELS.join(', ')}`
      );
    }

    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },

  /**
   * Listen for events from the main process
   *
   * @param channel - The event channel to listen to (must be whitelisted)
   * @param callback - Callback to handle the event
   */
  on: (
    channel: AllValidEventChannels,
    callback: (...args: unknown[]) => void
  ): void => {
    if (!isValidEventChannel(channel)) {
      console.error(
        `IPC Security: Channel "${String(channel)}" is not allowed. ` +
          `Allowed channels: ${VALID_EVENT_CHANNELS.join(', ')}`
      );
      return;
    }

    // CRITICAL: Remove existing listener for this callback first to prevent duplicates
    const existingWrapper = callbackMap.get(callback);
    if (existingWrapper) {
      ipcRenderer.removeListener(channel, existingWrapper);
      callbackMap.delete(callback);
    }

    // Wrap the callback to strip the event object and handle errors
    const wrappedCallback = (
      _event: IpcRendererEvent,
      ...args: unknown[]
    ): void => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[IPC] Error in ${channel} callback:`, error);
      }
    };

    // Store the wrapper so we can remove it later
    callbackMap.set(callback, wrappedCallback);
    ipcRenderer.on(channel, wrappedCallback);
  },

  /**
   * Remove an event listener
   *
   * @param channel - The event channel to stop listening to
   * @param callback - The callback to remove
   */
  removeListener: (
    channel: AllValidEventChannels,
    callback: (...args: unknown[]) => void
  ): void => {
    if (!isValidEventChannel(channel)) {
      console.error(
        `IPC Security: Channel "${String(channel)}" is not allowed. ` +
          `Allowed channels: ${VALID_EVENT_CHANNELS.join(', ')}`
      );
      return;
    }

    // Get the wrapped callback that was registered
    const wrappedCallback = callbackMap.get(callback);
    if (wrappedCallback) {
      ipcRenderer.removeListener(channel, wrappedCallback);
      callbackMap.delete(callback);
    }
  },

  /**
   * Current platform identifier
   */
  platform: process.platform,
};

// ============================================================================
// Expose API to Renderer
// ============================================================================

// Expose the secure API to the renderer process via window.electron
contextBridge.exposeInMainWorld('electron', electronAPI);

// ============================================================================
// Type Declarations
// ============================================================================

// Declare the global window interface extension
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
