/**
 * React Hooks for IPC Communication
 *
 * Provides React-friendly hooks for invoking IPC handlers and subscribing to events.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, onEvent, IPCError } from '@/lib/ipc';
import type {
  IpcChannelName,
  IpcChannelParams,
  IpcChannelReturn,
  IpcEventChannelName,
  IpcEventParams,
} from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

/**
 * State for async IPC operations
 */
export interface UseIPCState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Return type for useIPCQuery hook
 */
export interface UseIPCQueryResult<T> extends UseIPCState<T> {
  refetch: () => Promise<void>;
}

/**
 * Return type for useIPCMutation hook
 */
export interface UseIPCMutationResult<TChannel extends IpcChannelName> {
  mutate: (
    ...args: IpcChannelParams<TChannel>
  ) => Promise<IpcChannelReturn<TChannel>>;
  data: IpcChannelReturn<TChannel> | null;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Options for useIPCQuery hook
 */
export interface UseIPCQueryOptions {
  /** Whether to fetch immediately on mount (default: true) */
  enabled?: boolean;
  /** Whether to refetch when args change (default: true) */
  refetchOnArgsChange?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for invoking an IPC handler as a query (auto-fetches on mount).
 *
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the handler
 * @param options - Query options
 * @returns Query result with data, loading, error, and refetch function
 *
 * @example
 * ```typescript
 * function AppVersion() {
 *   const { data, loading, error, refetch } = useIPCQuery('app:getVersion');
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data) return null;
 *
 *   return <div>Version: {data.version}</div>;
 * }
 * ```
 */
export function useIPCQuery<TChannel extends IpcChannelName>(
  channel: TChannel,
  args?: IpcChannelParams<TChannel>,
  options: UseIPCQueryOptions = {}
): UseIPCQueryResult<IpcChannelReturn<TChannel>> {
  const { enabled = true, refetchOnArgsChange = true } = options;

  const [state, setState] = useState<UseIPCState<IpcChannelReturn<TChannel>>>({
    data: null,
    loading: enabled,
    error: null,
  });

  // Use ref to track mounted state and previous values
  const isMountedRef = useRef(true);
  const isInitialMountRef = useRef(true);
  const prevEnabledRef = useRef(enabled);
  const prevArgsRef = useRef(args);

  const fetchData = useCallback(
    async (currentArgs: IpcChannelParams<TChannel> | undefined) => {
      if (!isMountedRef.current) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await invoke(
          channel,
          ...(currentArgs ?? ([] as unknown as IpcChannelParams<TChannel>))
        );

        if (isMountedRef.current) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (err) {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error:
              err instanceof Error
                ? err
                : new IPCError({ name: 'Error', message: String(err) }),
          }));
        }
      }
    },
    [channel]
  );

  // Single effect to handle both initial fetch and refetch on args/enabled change
  useEffect(() => {
    isMountedRef.current = true;

    const isInitialMount = isInitialMountRef.current;
    const wasEnabled = prevEnabledRef.current;
    const prevArgs = prevArgsRef.current;

    // Update refs to current values
    isInitialMountRef.current = false;
    prevEnabledRef.current = enabled;
    prevArgsRef.current = args;

    if (!enabled) {
      return () => {
        isMountedRef.current = false;
      };
    }

    // Determine if we should fetch:
    // 1. Initial mount with enabled=true
    // 2. If enabled just became true (changed from false to true)
    // 3. If args changed and refetchOnArgsChange is true
    const shouldFetchOnMount = isInitialMount && enabled;
    const enabledJustBecameTrue = !isInitialMount && enabled && !wasEnabled;
    const argsChanged =
      !isInitialMount &&
      refetchOnArgsChange &&
      JSON.stringify(args) !== JSON.stringify(prevArgs);

    if (shouldFetchOnMount || enabledJustBecameTrue || argsChanged) {
      // Always use current args (passed directly) to avoid stale ref issues
      void fetchData(args);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, args, refetchOnArgsChange, fetchData]);

  // Create a stable refetch function that uses current args from ref
  const refetch = useCallback(async () => {
    await fetchData(prevArgsRef.current);
  }, [fetchData]);

  return {
    ...state,
    refetch,
  };
}

/**
 * Hook for invoking an IPC handler as a mutation (manual trigger).
 *
 * @param channel - The IPC channel to invoke
 * @returns Mutation result with mutate function, data, loading, error, and reset
 *
 * @example
 * ```typescript
 * function DirectoryPicker() {
 *   const { mutate, data, loading, error } = useIPCMutation('dialog:openDirectory');
 *
 *   const handleClick = async () => {
 *     const result = await mutate({ title: 'Select a folder' });
 *     if (!result.canceled) {
 *       console.log('Selected:', result.filePaths[0]);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={loading}>
 *       {loading ? 'Opening...' : 'Select Directory'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useIPCMutation<TChannel extends IpcChannelName>(
  channel: TChannel
): UseIPCMutationResult<TChannel> {
  const [state, setState] = useState<UseIPCState<IpcChannelReturn<TChannel>>>({
    data: null,
    loading: false,
    error: null,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (
      ...args: IpcChannelParams<TChannel>
    ): Promise<IpcChannelReturn<TChannel>> => {
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      console.log('[useIPCMutation] Calling channel:', channel, 'with args:', args);

      try {
        const result = await invoke(channel, ...args);

        console.log('[useIPCMutation] Result from', channel, ':', result);

        if (isMountedRef.current) {
          setState({ data: result, loading: false, error: null });
        }

        return result;
      } catch (err) {
        console.error('[useIPCMutation] Error from', channel, ':', err);

        const error =
          err instanceof Error
            ? err
            : new IPCError({ name: 'Error', message: String(err) });

        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, loading: false, error }));
        }

        throw error;
      }
    },
    [channel]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

/**
 * Hook for subscribing to IPC events from the main process.
 *
 * @param channel - The event channel to subscribe to
 * @param callback - Callback function to handle the event
 *
 * @example
 * ```typescript
 * function UpdateNotifier() {
 *   const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
 *
 *   useIPCEvent('app:update-available', (info) => {
 *     setUpdateInfo(info);
 *   });
 *
 *   if (!updateInfo) return null;
 *   return <div>Update available: {updateInfo.version}</div>;
 * }
 * ```
 */
export function useIPCEvent<TChannel extends IpcEventChannelName>(
  channel: TChannel,
  callback: (...args: IpcEventParams<TChannel>) => void
): void {
  // Use ref to avoid re-subscribing on callback changes
  const callbackRef = useRef(callback);

  // Update ref in useEffect to avoid accessing refs during render
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (...args: IpcEventParams<TChannel>): void => {
      callbackRef.current(...args);
    };

    const unsubscribe = onEvent(channel, handler);

    return () => {
      unsubscribe();
    };
  }, [channel]);
}

/**
 * Simple hook that returns the invoke function directly.
 * Use this when you need more control or want to invoke multiple channels.
 *
 * @returns The type-safe invoke function
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const ipcInvoke = useIPC();
 *
 *   const handleAction = async () => {
 *     const version = await ipcInvoke('app:getVersion');
 *     const platform = await ipcInvoke('app:getPlatform');
 *     console.log(version, platform);
 *   };
 *
 *   return <button onClick={handleAction}>Get Info</button>;
 * }
 * ```
 */
export function useIPC(): typeof invoke {
  return invoke;
}

export default useIPC;
