/**
 * Type definitions for the Electron API exposed via preload script
 *
 * This file provides global type declarations for the window.electron object.
 * The actual implementation is in electron/preload.ts.
 *
 * For type-safe IPC invocations, use the invoke function from @/lib/ipc
 * or the useIPC hooks from @/hooks/useIPC.
 */

import type { IpcChannelName, IpcEventChannelName, AllEventChannels } from './ipc';

/**
 * Electron API exposed to renderer process via contextBridge
 */
export interface ElectronAPI {
  /**
   * Invoke an IPC handler in the main process and get a response.
   *
   * For type-safe invocations, use the invoke function from @/lib/ipc instead.
   */
  invoke: <T>(channel: IpcChannelName, ...args: unknown[]) => Promise<T>;

  /**
   * Listen for events sent from the main process.
   *
   * For type-safe event subscriptions, use onEvent from @/lib/ipc
   * or useIPCEvent from @/hooks/useIPC instead.
   *
   * Supports both static event channels and dynamic terminal channels
   * (e.g., terminal:output:{id}, terminal:exit:{id})
   */
  on: (
    channel: AllEventChannels,
    callback: (...args: unknown[]) => void
  ) => void;

  /**
   * Remove an event listener.
   *
   * Supports both static event channels and dynamic terminal channels
   * (e.g., terminal:output:{id}, terminal:exit:{id})
   */
  removeListener: (
    channel: AllEventChannels,
    callback: (...args: unknown[]) => void
  ) => void;

  /**
   * Platform identifier (darwin, win32, linux)
   */
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
