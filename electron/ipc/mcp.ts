/**
 * MCP IPC Handlers
 *
 * Handlers for MCP (Model Context Protocol) configuration management (Phase 11: MCP Integration).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { mcpConfigService, type ClaudeDesktopConfig } from '../services/mcp-config.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { McpConfig } from '@prisma/client';

/**
 * MCP config data types for IPC
 */
export interface CreateMcpConfigInput {
  name: string;
  type: string;
  config?: string;
  projectId: string;
}

export interface UpdateMcpConfigInput {
  name?: string;
  type?: string;
  config?: string;
  enabled?: boolean;
}

// ============================================================================
// MCP Handlers
// ============================================================================

/**
 * List all MCP configs for a project
 */
async function handleListMcpConfigs(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<McpConfig[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const configs = await prisma.mcpConfig.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return configs;
}

/**
 * Create a new MCP config
 */
async function handleCreateMcpConfig(
  _event: IpcMainInvokeEvent,
  data: CreateMcpConfigInput
): Promise<McpConfig> {
  if (!data.name || !data.type || !data.projectId) {
    throw IPCErrors.invalidArguments(
      'Name, type, and project ID are required'
    );
  }

  const prisma = databaseService.getClient();

  const config = await prisma.mcpConfig.create({
    data: {
      name: data.name,
      type: data.type,
      config: data.config || null,
      projectId: data.projectId,
    },
  });

  return config;
}

/**
 * Update an existing MCP config
 */
async function handleUpdateMcpConfig(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateMcpConfigInput
): Promise<McpConfig> {
  if (!id) {
    throw IPCErrors.invalidArguments('MCP config ID is required');
  }

  if (!data || Object.keys(data).length === 0) {
    throw IPCErrors.invalidArguments('At least one field must be provided for update');
  }

  const prisma = databaseService.getClient();

  try {
    const config = await prisma.mcpConfig.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    return config;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('MCP config not found');
    }
    throw error;
  }
}

/**
 * Delete an MCP config by ID
 */
async function handleDeleteMcpConfig(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('MCP config ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.mcpConfig.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('MCP config not found');
    }
    throw error;
  }
}

/**
 * Get a single MCP config by ID
 */
async function handleGetMcpConfig(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<McpConfig | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('MCP config ID is required');
  }

  const prisma = databaseService.getClient();

  const config = await prisma.mcpConfig.findUnique({
    where: { id },
  });

  return config;
}

/**
 * Toggle the enabled state of an MCP config
 */
async function handleToggleMcpConfig(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<McpConfig> {
  if (!id) {
    throw IPCErrors.invalidArguments('MCP config ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    // First get the current state
    const currentConfig = await prisma.mcpConfig.findUnique({
      where: { id },
    });

    if (!currentConfig) {
      throw new Error('MCP config not found');
    }

    // Toggle the enabled state
    const config = await prisma.mcpConfig.update({
      where: { id },
      data: {
        enabled: !currentConfig.enabled,
      },
    });

    return config;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('MCP config not found');
    }
    throw error;
  }
}

/**
 * Preset MCP server definition
 */
export interface PresetMcpServer {
  name: string;
  type: string;
  description: string;
  category: 'documentation' | 'knowledge' | 'integration' | 'browser' | 'builtin';
  defaultConfig?: Record<string, unknown>;
}

/**
 * Get list of preset MCP servers
 */
async function handleGetPresetServers(
  _event: IpcMainInvokeEvent
): Promise<PresetMcpServer[]> {
  const PRESET_SERVERS: PresetMcpServer[] = [
    // Documentation
    {
      name: 'Context7',
      type: 'documentation',
      description: 'Up-to-date documentation for libraries and frameworks',
      category: 'documentation',
      defaultConfig: {},
    },

    // Knowledge Graphs
    {
      name: 'ContextForge',
      type: 'knowledge',
      description: 'Build and query knowledge graphs from your codebase',
      category: 'knowledge',
      defaultConfig: {},
    },

    // Integrations
    {
      name: 'GitHub',
      type: 'integration',
      description: 'GitHub repository integration for PRs, issues, and code search',
      category: 'integration',
      defaultConfig: {},
    },
    {
      name: 'Slack',
      type: 'integration',
      description: 'Slack workspace integration for team communication',
      category: 'integration',
      defaultConfig: {},
    },
    {
      name: 'Linear',
      type: 'integration',
      description: 'Linear issue tracker integration',
      category: 'integration',
      defaultConfig: {},
    },

    // Browser Automation
    {
      name: 'Playwright',
      type: 'browser',
      description: 'Browser automation and testing capabilities',
      category: 'browser',
      defaultConfig: {},
    },
    {
      name: 'Puppeteer',
      type: 'browser',
      description: 'Chrome DevTools Protocol automation',
      category: 'browser',
      defaultConfig: {},
    },

    // Built-in
    {
      name: 'Filesystem',
      type: 'builtin',
      description: 'Local filesystem access and file operations',
      category: 'builtin',
      defaultConfig: {},
    },
    {
      name: 'Fetch',
      type: 'builtin',
      description: 'HTTP request capabilities for API interactions',
      category: 'builtin',
      defaultConfig: {},
    },
  ];

  return PRESET_SERVERS;
}

// ============================================================================
// MCP Config File Generation Handlers (Phase 11.5)
// ============================================================================

/**
 * Generate Claude Desktop config from project's MCP configs
 */
async function handleGenerateConfig(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<ClaudeDesktopConfig> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  try {
    const config = await mcpConfigService.generateConfig(projectId);
    return config;
  } catch (error) {
    throw new Error(
      `Failed to generate MCP config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Write MCP config to Claude Desktop config file
 */
async function handleWriteConfig(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<void> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  try {
    await mcpConfigService.writeConfig(projectId);
  } catch (error) {
    throw new Error(
      `Failed to write MCP config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Read the current Claude Desktop config file
 */
async function handleReadConfig(
  _event: IpcMainInvokeEvent
): Promise<ClaudeDesktopConfig | null> {
  try {
    const config = mcpConfigService.readCurrentConfig();
    return config;
  } catch (error) {
    throw new Error(
      `Failed to read MCP config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all MCP-related IPC handlers
 */
export function registerMcpHandlers(): void {
  // mcp:list - Get all MCP configs for a project
  ipcMain.handle(
    'mcp:list',
    wrapWithLogging('mcp:list', wrapHandler(handleListMcpConfigs))
  );

  // mcp:create - Create a new MCP config
  ipcMain.handle(
    'mcp:create',
    wrapWithLogging('mcp:create', wrapHandler(handleCreateMcpConfig))
  );

  // mcp:get - Get a single MCP config by ID
  ipcMain.handle(
    'mcp:get',
    wrapWithLogging('mcp:get', wrapHandler(handleGetMcpConfig))
  );

  // mcp:update - Update an existing MCP config
  ipcMain.handle(
    'mcp:update',
    wrapWithLogging('mcp:update', wrapHandler(handleUpdateMcpConfig))
  );

  // mcp:delete - Delete an MCP config
  ipcMain.handle(
    'mcp:delete',
    wrapWithLogging('mcp:delete', wrapHandler(handleDeleteMcpConfig))
  );

  // mcp:toggle - Toggle enabled state
  ipcMain.handle(
    'mcp:toggle',
    wrapWithLogging('mcp:toggle', wrapHandler(handleToggleMcpConfig))
  );

  // mcp:presets - Get list of preset MCP servers
  ipcMain.handle(
    'mcp:presets',
    wrapWithLogging('mcp:presets', wrapHandler(handleGetPresetServers))
  );

  // mcp:generateConfig - Generate Claude Desktop config (Phase 11.5)
  ipcMain.handle(
    'mcp:generateConfig',
    wrapWithLogging('mcp:generateConfig', wrapHandler(handleGenerateConfig))
  );

  // mcp:writeConfig - Write config to Claude Desktop (Phase 11.5)
  ipcMain.handle(
    'mcp:writeConfig',
    wrapWithLogging('mcp:writeConfig', wrapHandler(handleWriteConfig))
  );

  // mcp:readConfig - Read current Claude Desktop config (Phase 11.5)
  ipcMain.handle(
    'mcp:readConfig',
    wrapWithLogging('mcp:readConfig', wrapHandler(handleReadConfig))
  );
}

/**
 * Unregister all MCP-related IPC handlers
 */
export function unregisterMcpHandlers(): void {
  ipcMain.removeHandler('mcp:list');
  ipcMain.removeHandler('mcp:create');
  ipcMain.removeHandler('mcp:get');
  ipcMain.removeHandler('mcp:update');
  ipcMain.removeHandler('mcp:delete');
  ipcMain.removeHandler('mcp:toggle');
  ipcMain.removeHandler('mcp:presets');
  ipcMain.removeHandler('mcp:generateConfig');
  ipcMain.removeHandler('mcp:writeConfig');
  ipcMain.removeHandler('mcp:readConfig');
}

/**
 * Wrap a handler with logging
 */
function wrapWithLogging<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn> {
  return async (
    event: IpcMainInvokeEvent,
    ...args: TArgs
  ): Promise<TReturn> => {
    const startTime = performance.now();
    logIPCRequest(channel, args);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;
      logIPCResponse(channel, result, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logIPCError(channel, error, duration);
      throw error;
    }
  };
}
