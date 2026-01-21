/**
 * MCP Configuration Service
 *
 * Manages Claude Desktop configuration file generation and synchronization.
 * Generates claude_desktop_config.json files for MCP server integration.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { databaseService } from './database.js';
import { ensureDirectory } from '../utils/paths.js';

/**
 * MCP server configuration structure for Claude Desktop
 */
export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Claude Desktop config file structure
 */
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Service for managing MCP configuration file generation
 */
class McpConfigService {
  private configPath: string;
  private configDir: string;

  constructor() {
    // Set platform-specific Claude Desktop config location
    const homeDir = app.getPath('home');

    if (process.platform === 'darwin') {
      // macOS: ~/Library/Application Support/Claude/
      this.configDir = path.join(homeDir, 'Library', 'Application Support', 'Claude');
    } else if (process.platform === 'win32') {
      // Windows: %APPDATA%/Claude/
      this.configDir = path.join(app.getPath('appData'), 'Claude');
    } else {
      // Linux: ~/.config/claude/
      this.configDir = path.join(homeDir, '.config', 'claude');
    }

    this.configPath = path.join(this.configDir, 'claude_desktop_config.json');
  }

  /**
   * Get the Claude Desktop config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get the Claude Desktop config directory
   */
  getConfigDirectory(): string {
    return this.configDir;
  }

  /**
   * Read the current Claude Desktop config file
   */
  readCurrentConfig(): ClaudeDesktopConfig | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as ClaudeDesktopConfig;

      // Validate structure
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        console.warn('[MCP Config] Invalid config structure, returning null');
        return null;
      }

      return config;
    } catch (error) {
      console.error('[MCP Config] Failed to read current config:', error);
      throw new Error(
        `Failed to read Claude Desktop config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate MCP config for a project
   * Includes only enabled MCP servers from the database
   */
  async generateConfig(projectId: string): Promise<ClaudeDesktopConfig> {
    try {
      const prisma = databaseService.getClient();

      // Fetch all enabled MCP configs for the project
      const mcpConfigs = await prisma.mcpConfig.findMany({
        where: {
          projectId,
          enabled: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Build mcpServers object
      const mcpServers: Record<string, McpServerConfig> = {};

      for (const config of mcpConfigs) {
        // Parse the config JSON field
        let serverConfig: McpServerConfig = {};

        if (config.config) {
          try {
            serverConfig = JSON.parse(config.config) as McpServerConfig;
          } catch (parseError) {
            console.warn(
              `[MCP Config] Failed to parse config for ${config.name}:`,
              parseError
            );
            // Skip this server if config is invalid
            continue;
          }
        }

        // Validate that the config has required fields (command or at minimum is an object)
        if (typeof serverConfig !== 'object' || serverConfig === null) {
          console.warn(
            `[MCP Config] Invalid config structure for ${config.name}, skipping`
          );
          continue;
        }

        // Use the server name as the key
        mcpServers[config.name] = serverConfig;
      }

      return {
        mcpServers,
      };
    } catch (error) {
      console.error('[MCP Config] Failed to generate config:', error);
      throw new Error(
        `Failed to generate MCP config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a backup of the existing config file
   */
  private backupExistingConfig(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(
        this.configDir,
        `claude_desktop_config.backup-${timestamp}.json`
      );

      fs.copyFileSync(this.configPath, backupPath);
      console.log('[MCP Config] Created backup:', backupPath);

      return backupPath;
    } catch (error) {
      console.error('[MCP Config] Failed to create backup:', error);
      throw new Error(
        `Failed to backup config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Merge new config with existing config, preserving servers not managed by this app
   * This allows other MCP servers configured manually to coexist with our managed ones
   */
  private mergeConfigs(
    existingConfig: ClaudeDesktopConfig | null,
    newConfig: ClaudeDesktopConfig,
    managedServerNames: string[]
  ): ClaudeDesktopConfig {
    if (!existingConfig) {
      return newConfig;
    }

    // Start with existing servers
    const mergedServers = { ...existingConfig.mcpServers };

    // Remove servers that are managed by this app
    for (const serverName of managedServerNames) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete mergedServers[serverName];
    }

    // Add new managed servers
    for (const [serverName, serverConfig] of Object.entries(newConfig.mcpServers)) {
      mergedServers[serverName] = serverConfig;
    }

    return {
      mcpServers: mergedServers,
    };
  }

  /**
   * Write MCP config to the Claude Desktop config file
   * Preserves existing servers not managed by this app
   */
  async writeConfig(projectId: string): Promise<void> {
    try {
      // Ensure config directory exists
      ensureDirectory(this.configDir);

      // Read existing config
      const existingConfig = this.readCurrentConfig();

      // Generate new config from database
      const newConfig = await generateConfig(projectId);

      // Get list of managed server names from database
      const prisma = databaseService.getClient();
      const managedConfigs = await prisma.mcpConfig.findMany({
        where: { projectId },
        select: { name: true },
      });
      const managedServerNames = managedConfigs.map((c) => c.name);

      // Create backup of existing config
      if (existingConfig) {
        this.backupExistingConfig();
      }

      // Merge configs to preserve non-managed servers
      const finalConfig = this.mergeConfigs(
        existingConfig,
        newConfig,
        managedServerNames
      );

      // Write the merged config
      const configContent = JSON.stringify(finalConfig, null, 2);
      fs.writeFileSync(this.configPath, configContent, 'utf-8');

      console.log('[MCP Config] Successfully wrote config to:', this.configPath);
    } catch (error) {
      console.error('[MCP Config] Failed to write config:', error);
      throw new Error(
        `Failed to write Claude Desktop config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that a config file is valid JSON and has correct structure
   */
  validateConfig(config: unknown): config is ClaudeDesktopConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const cfg = config as ClaudeDesktopConfig;

    if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') {
      return false;
    }

    // Validate each server config
    for (const [serverName, serverConfig] of Object.entries(cfg.mcpServers)) {
      if (typeof serverName !== 'string') {
        return false;
      }

      if (!serverConfig || typeof serverConfig !== 'object') {
        return false;
      }

      // If command exists, it must be a string
      if (serverConfig.command !== undefined && typeof serverConfig.command !== 'string') {
        return false;
      }

      // If args exists, it must be an array
      if (serverConfig.args !== undefined && !Array.isArray(serverConfig.args)) {
        return false;
      }

      // If env exists, it must be an object
      if (
        serverConfig.env !== undefined &&
        (typeof serverConfig.env !== 'object' || serverConfig.env === null)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if Claude Desktop config directory exists
   */
  configDirectoryExists(): boolean {
    return fs.existsSync(this.configDir);
  }

  /**
   * Check if Claude Desktop config file exists
   */
  configFileExists(): boolean {
    return fs.existsSync(this.configPath);
  }
}

// Export singleton instance
export const mcpConfigService = new McpConfigService();

// Export the generate function for standalone use
export async function generateConfig(projectId: string): Promise<ClaudeDesktopConfig> {
  return mcpConfigService.generateConfig(projectId);
}
