/**
 * IPC Error Handling Utilities
 *
 * Provides error serialization for safe transport across the IPC boundary.
 */

/**
 * Serialized error format for IPC transport
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

/**
 * Custom error class for IPC-related errors.
 * This error can be thrown in the main process and will be properly
 * serialized and reconstructed in the renderer process.
 */
export class IPCError extends Error {
  public readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'IPCError';
    this.code = code;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IPCError);
    }
  }

  /**
   * Serialize the error for IPC transport
   */
  serialize(): SerializedError {
    return serializeError(this);
  }
}

/**
 * Error codes for common IPC errors
 */
export const IPC_ERROR_CODES = {
  INVALID_CHANNEL: 'IPC_INVALID_CHANNEL',
  INVALID_ARGUMENTS: 'IPC_INVALID_ARGUMENTS',
  HANDLER_NOT_FOUND: 'IPC_HANDLER_NOT_FOUND',
  HANDLER_ERROR: 'IPC_HANDLER_ERROR',
  TIMEOUT: 'IPC_TIMEOUT',
  PERMISSION_DENIED: 'IPC_PERMISSION_DENIED',
  NOT_IMPLEMENTED: 'IPC_NOT_IMPLEMENTED',
} as const;

export type IpcErrorCode =
  (typeof IPC_ERROR_CODES)[keyof typeof IPC_ERROR_CODES];

/**
 * Serialize an error for safe IPC transport.
 *
 * @param error - The error to serialize
 * @returns Serialized error object
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
    };

    // Only add stack in development
    if (process.env['NODE_ENV'] === 'development') {
      const stackValue = error.stack;
      if (stackValue !== undefined) {
        serialized.stack = stackValue;
      }
    }

    // Include code if present (common in Node.js errors and our IPCError)
    if ('code' in error) {
      const codeValue = (error as { code?: unknown }).code;
      if (typeof codeValue === 'string') {
        serialized.code = codeValue;
      }
    }

    return serialized;
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      name: 'Error',
      message: JSON.stringify(error),
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
}

/**
 * Wrap an async IPC handler with error serialization.
 * This ensures all errors thrown by handlers are properly serialized.
 *
 * @param handler - The async handler function
 * @returns Wrapped handler that serializes errors
 *
 * @example
 * ```typescript
 * ipcMain.handle('tasks:create', wrapHandler(async (_, data) => {
 *   // If this throws, the error will be properly serialized
 *   const task = await createTask(data);
 *   return task;
 * }));
 * ```
 */
export function wrapHandler<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Re-throw as IPCError - Electron will handle the serialization
      // but we want to ensure it's in a consistent format
      const serialized = serializeError(error);
      throw new IPCError(serialized.message, serialized.code);
    }
  };
}

/**
 * Create a standardized IPC error for common scenarios
 */
export const IPCErrors = {
  invalidChannel: (channel: string): IPCError =>
    new IPCError(
      `Invalid IPC channel: ${channel}`,
      IPC_ERROR_CODES.INVALID_CHANNEL
    ),

  invalidArguments: (message: string): IPCError =>
    new IPCError(message, IPC_ERROR_CODES.INVALID_ARGUMENTS),

  handlerNotFound: (channel: string): IPCError =>
    new IPCError(
      `No handler found for channel: ${channel}`,
      IPC_ERROR_CODES.HANDLER_NOT_FOUND
    ),

  permissionDenied: (resource: string): IPCError =>
    new IPCError(
      `Permission denied: ${resource}`,
      IPC_ERROR_CODES.PERMISSION_DENIED
    ),

  notImplemented: (feature: string): IPCError =>
    new IPCError(
      `Not implemented: ${feature}`,
      IPC_ERROR_CODES.NOT_IMPLEMENTED
    ),
};
