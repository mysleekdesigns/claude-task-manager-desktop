/**
 * React Hook for MCP Configuration Management (Phase 11)
 *
 * Provides hooks for managing MCP server configurations with type-safe IPC calls.
 */

import { useCallback } from 'react';
import { useIPCQuery, useIPCMutation } from './useIPC';
import type {
  CreateMcpInput,
  UpdateMcpInput,
} from '@/types/ipc';

// ============================================================================
// MCP Hooks
// ============================================================================

/**
 * Hook for fetching MCP configurations for a project
 *
 * @param projectId - The project ID to fetch configurations for
 * @returns Query result with MCP configurations data
 */
export function useMcpConfigs(projectId: string) {
  return useIPCQuery('mcp:list', [projectId], {
    enabled: Boolean(projectId),
    refetchOnArgsChange: true,
  });
}

/**
 * Hook for fetching a single MCP configuration by ID
 *
 * @param configId - The configuration ID to fetch
 * @returns Query result with configuration data
 */
export function useMcpConfig(configId: string) {
  return useIPCQuery('mcp:get', [configId], {
    enabled: Boolean(configId),
  });
}

/**
 * Hook for fetching preset MCP servers
 *
 * @returns Query result with preset servers
 */
export function useMcpPresets() {
  return useIPCQuery('mcp:presets', []);
}

/**
 * Hook for creating a new MCP configuration
 *
 * @returns Mutation with mutate function for creating configurations
 */
export function useCreateMcp() {
  return useIPCMutation('mcp:create');
}

/**
 * Hook for updating an MCP configuration
 *
 * @returns Mutation with mutate function for updating configurations
 */
export function useUpdateMcp() {
  return useIPCMutation('mcp:update');
}

/**
 * Hook for toggling an MCP configuration's enabled state
 *
 * @returns Mutation with mutate function for toggling configurations
 */
export function useToggleMcp() {
  return useIPCMutation('mcp:toggle');
}

/**
 * Hook for deleting an MCP configuration
 *
 * @returns Mutation with mutate function for deleting configurations
 */
export function useDeleteMcp() {
  return useIPCMutation('mcp:delete');
}

// ============================================================================
// Composite Hook (all MCP operations)
// ============================================================================

/**
 * Composite hook that provides all MCP operations for a project
 *
 * @param projectId - The project ID
 * @returns Object with MCP configurations data and mutation functions
 */
export function useMcpManager(projectId: string) {
  const { data: configs, loading, error, refetch } = useMcpConfigs(projectId);
  const { data: presets } = useMcpPresets();
  const createMcp = useCreateMcp();
  const updateMcp = useUpdateMcp();
  const toggleMcp = useToggleMcp();
  const deleteMcp = useDeleteMcp();

  // Refetch configurations after mutations
  const handleCreate = useCallback(
    async (data: CreateMcpInput) => {
      await createMcp.mutate(data);
      await refetch();
    },
    [createMcp, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, data: UpdateMcpInput) => {
      await updateMcp.mutate(id, data);
      await refetch();
    },
    [updateMcp, refetch]
  );

  const handleToggle = useCallback(
    async (id: string) => {
      await toggleMcp.mutate(id);
      await refetch();
    },
    [toggleMcp, refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMcp.mutate(id);
      await refetch();
    },
    [deleteMcp, refetch]
  );

  return {
    configs,
    presets,
    loading,
    error,
    createMcp: {
      mutate: handleCreate,
      isPending: createMcp.loading,
    },
    updateMcp: {
      mutate: handleUpdate,
      isPending: updateMcp.loading,
    },
    toggleMcp: {
      mutate: handleToggle,
      isPending: toggleMcp.loading,
    },
    deleteMcp: {
      mutate: handleDelete,
      isPending: deleteMcp.loading,
    },
    refetch,
  };
}
