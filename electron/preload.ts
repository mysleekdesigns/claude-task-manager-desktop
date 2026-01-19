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
  // Users
  'users:create',
  'users:getById',
  'users:getByEmail',
  'users:update',
  'users:delete',
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
  channel: ValidEventChannel,
  callback: (...args: unknown[]) => void
) => void;

/**
 * Type-safe event remover function signature
 */
type RemoveListenerFunction = (
  channel: ValidEventChannel,
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
 */
function isValidEventChannel(channel: string): channel is ValidEventChannel {
  return (VALID_EVENT_CHANNELS as readonly string[]).includes(channel);
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
    channel: ValidEventChannel,
    callback: (...args: unknown[]) => void
  ): void => {
    if (!isValidEventChannel(channel)) {
      console.error(
        `IPC Security: Channel "${String(channel)}" is not allowed. ` +
          `Allowed channels: ${VALID_EVENT_CHANNELS.join(', ')}`
      );
      return;
    }

    // Wrap the callback to strip the event object
    const wrappedCallback = (
      _event: IpcRendererEvent,
      ...args: unknown[]
    ): void => {
      callback(...args);
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
    channel: ValidEventChannel,
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
