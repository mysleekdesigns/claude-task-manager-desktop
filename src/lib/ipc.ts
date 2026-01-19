/**
 * Type-safe IPC Invoke Wrapper for Renderer Process
 *
 * Provides a type-safe interface for invoking IPC handlers in the main process.
 */

import type {
  IpcChannelName,
  IpcChannelParams,
  IpcChannelReturn,
  IpcEventChannelName,
  IpcEventParams,
  SerializedError,
} from '@/types/ipc';

// ============================================================================
// Custom Error Class for IPC Errors
// ============================================================================

/**
 * Error class for IPC-related errors that preserves error information
 * across the process boundary.
 */
export class IPCError extends Error {
  public readonly code: string | undefined;
  public readonly originalStack: string | undefined;

  constructor(serializedError: SerializedError) {
    super(serializedError.message);
    this.name = serializedError.name || 'IPCError';
    this.code = serializedError.code;
    this.originalStack = serializedError.stack;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IPCError);
    }
  }

  /**
   * Get the full error details for logging
   */
  toJSON(): SerializedError {
    const result: SerializedError = {
      name: this.name,
      message: this.message,
    };
    if (this.stack !== undefined) {
      result.stack = this.stack;
    }
    if (this.code !== undefined) {
      result.code = this.code;
    }
    return result;
  }
}

// ============================================================================
// Type-safe Invoke Function
// ============================================================================

/**
 * Type-safe invoke function that calls IPC handlers in the main process.
 *
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the handler
 * @returns Promise resolving to the handler's return value
 *
 * @example
 * ```typescript
 * // Type-safe invocation with proper inference
 * const version = await invoke('app:getVersion');
 * // version is typed as AppVersion
 *
 * const result = await invoke('dialog:openDirectory', { title: 'Select folder' });
 * // result is typed as OpenDirectoryResult
 * ```
 */
export async function invoke<T extends IpcChannelName>(
  channel: T,
  ...args: IpcChannelParams<T>
): Promise<IpcChannelReturn<T>> {
  if (typeof window === 'undefined' || !window.electron) {
    throw new IPCError({
      name: 'IPCError',
      message:
        'Electron IPC is not available. Make sure you are running in Electron.',
    });
  }

  try {
    const result = await window.electron.invoke<IpcChannelReturn<T>>(
      channel,
      ...args
    );
    return result;
  } catch (error) {
    // If we receive a serialized error from main process, reconstruct it
    if (isSerializedError(error)) {
      throw new IPCError(error);
    }

    // Re-throw other errors
    if (error instanceof Error) {
      throw error;
    }

    // Wrap unknown errors
    throw new IPCError({
      name: 'IPCError',
      message: String(error),
    });
  }
}

// ============================================================================
// Event Subscription Functions
// ============================================================================

/**
 * Subscribe to an IPC event from the main process.
 *
 * @param channel - The event channel to listen to
 * @param callback - Callback function to handle the event
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = onEvent('app:update-available', (info) => {
 *   console.log('Update available:', info.version);
 * });
 *
 * // Later, to unsubscribe:
 * unsubscribe();
 * ```
 */
export function onEvent<T extends IpcEventChannelName>(
  channel: T,
  callback: (...args: IpcEventParams<T>) => void
): () => void {
  if (typeof window === 'undefined' || !window.electron) {
    console.warn(
      'Electron IPC is not available. Event subscription will be ignored.'
    );
    // No-op unsubscribe when not running in Electron
    return () => { /* noop */ };
  }

  window.electron.on(channel, callback as (...args: unknown[]) => void);

  return () => {
    window.electron.removeListener(
      channel,
      callback as (...args: unknown[]) => void
    );
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if a value is a serialized error
 */
function isSerializedError(value: unknown): value is SerializedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as SerializedError).message === 'string'
  );
}

/**
 * Check if we are running in Electron environment
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electron !== undefined;
}

/**
 * Get the current platform (convenience wrapper)
 */
export function getPlatform(): NodeJS.Platform | undefined {
  return typeof window !== 'undefined' ? window.electron?.platform : undefined;
}
