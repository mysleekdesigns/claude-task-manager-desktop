/**
 * Type declarations for the Electron preload API exposed to renderer
 */

export {};

declare global {
  interface Window {
    /**
     * Electron IPC bridge exposed via contextBridge in preload script
     */
    electron: {
      /**
       * Invoke an IPC handler in the main process
       * @param channel - The IPC channel name
       * @param args - Arguments to pass to the handler
       * @returns Promise resolving to the handler's return value
       */
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;

      /**
       * Listen for events from the main process
       * @param channel - The IPC channel name
       * @param callback - Function to call when event is received
       * @returns Cleanup function to remove the listener
       */
      on(channel: string, callback: (...args: unknown[]) => void): () => void;

      /**
       * Remove all listeners for a channel
       * @param channel - The IPC channel name
       */
      removeAllListeners(channel: string): void;
    };
  }
}
