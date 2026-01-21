/**
 * MCP Configuration Page (Phase 11)
 *
 * Model Context Protocol server configuration and management.
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMcpManager } from '@/hooks/useMcp';
import { McpServerList } from '@/components/mcp/McpServerList';
import { AddCustomServerModal } from '@/components/mcp/AddCustomServerModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, AlertCircle, Server, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateMcpInput } from '@/types/ipc';

// ============================================================================
// Component
// ============================================================================

export function McpPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Local state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch MCP configurations
  const {
    configs,
    presets,
    loading,
    error,
    createMcp,
    toggleMcp,
    deleteMcp,
  } = useMcpManager(currentProject?.id || '');

  // Handle create MCP server
  const handleCreateMcp = useCallback(
    async (data: Omit<CreateMcpInput, 'projectId'>) => {
      if (!currentProject) return;

      await createMcp.mutate({
        ...data,
        projectId: currentProject.id,
      });
    },
    [currentProject, createMcp]
  );

  // Handle toggle MCP server
  const handleToggleMcp = useCallback(
    async (id: string) => {
      await toggleMcp.mutate(id);
    },
    [toggleMcp]
  );

  // Handle delete MCP server
  const handleDeleteMcp = useCallback(
    async (id: string) => {
      await deleteMcp.mutate(id);
    },
    [deleteMcp]
  );

  // Handle sync to Claude Desktop
  const handleSyncToClaudeDesktop = useCallback(async () => {
    if (!currentProject) return;

    setIsSyncing(true);
    try {
      await window.electron.invoke('mcp:writeConfig', currentProject.id);
      toast.success('Configuration synced', {
        description: 'MCP servers have been synced to Claude Desktop successfully.',
      });
    } catch (error) {
      console.error('Failed to sync MCP configuration:', error);
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Failed to sync MCP configuration to Claude Desktop.',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [currentProject]);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">MCP Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure Model Context Protocol servers for AI-powered capabilities
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to configure MCP servers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Count enabled servers
  const configsArray = configs ?? [];
  const presetsArray = presets ?? [];
  const enabledCount = configsArray.filter((config) => config.enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">MCP Configuration</h1>
            <p className="text-muted-foreground mt-2">
              Configure Model Context Protocol servers for {currentProject.name}
            </p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => { void handleSyncToClaudeDesktop(); }}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync to Claude Desktop'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Write the current MCP configuration to Claude Desktop's config file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button onClick={() => { setIsAddModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {configsArray.length} server{configsArray.length !== 1 ? 's' : ''} configured
            </span>
          </div>
          {enabledCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                {enabledCount} enabled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-8 pt-6 pb-8 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Loading MCP servers...</div>
          </div>
        ) : (
          <McpServerList
            configs={configsArray}
            presets={presetsArray}
            onToggle={(id: string) => { void handleToggleMcp(id); }}
            onDelete={(id: string) => { void handleDeleteMcp(id); }}
            isToggling={toggleMcp.isPending}
          />
        )}
      </div>

      {/* Add Custom Server Modal */}
      <AddCustomServerModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); }}
        onSubmit={(data: Omit<CreateMcpInput, 'projectId'>) => { void handleCreateMcp(data); }}
      />
    </div>
  );
}
