# Phase 11.5: MCP Config File Generation

## Overview

This phase implements automatic generation and synchronization of Claude Desktop configuration files (`claude_desktop_config.json`) for MCP (Model Context Protocol) server integration.

## Implementation Status

**Status:** ✅ Complete
**Commit:** [TBD]

## Architecture

### Service Layer

#### `electron/services/mcp-config.ts`

The `McpConfigService` class handles all operations related to Claude Desktop configuration:

- **Platform-specific config paths:**
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
  - Linux: `~/.config/claude/claude_desktop_config.json`

- **Key methods:**
  - `generateConfig(projectId)` - Generate config from database MCP records
  - `readCurrentConfig()` - Read existing Claude Desktop config
  - `writeConfig(projectId)` - Write merged config to file system
  - `validateConfig(config)` - Validate config structure
  - `backupExistingConfig()` - Create timestamped backups

### IPC Handlers

#### New IPC Channels (`electron/ipc/mcp.ts`)

1. **`mcp:generateConfig`**
   - Parameters: `projectId: string`
   - Returns: `Promise<ClaudeDesktopConfig>`
   - Generates config object from enabled MCP servers in database

2. **`mcp:writeConfig`**
   - Parameters: `projectId: string`
   - Returns: `Promise<void>`
   - Writes config to Claude Desktop config file
   - Creates backup before overwriting
   - Preserves non-managed servers

3. **`mcp:readConfig`**
   - Parameters: None
   - Returns: `Promise<ClaudeDesktopConfig | null>`
   - Reads current Claude Desktop config file
   - Returns null if file doesn't exist

### Type Definitions

Added to `src/types/ipc.ts`:

```typescript
export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface ClaudeDesktopConfig {
  mcpServers: Record<string, McpServerConfig>;
}
```

## Features

### 1. Config Generation

Generates Claude Desktop config format from database records:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxx"
      }
    }
  }
}
```

### 2. Server Selection

Only includes enabled servers (`enabled = true` in database).

### 3. Environment Variables

Supports server-specific environment variables from the `config` JSON field in database.

### 4. Config Merging

Preserves existing MCP servers in Claude Desktop config that are not managed by this app:

- Reads existing config
- Removes only servers managed by this project
- Adds/updates managed servers
- Writes merged result

### 5. Automatic Backups

Creates timestamped backups before overwriting:
- Format: `claude_desktop_config.backup-2026-01-20T12-30-45-123Z.json`
- Stored in same directory as config file

### 6. Directory Creation

Automatically creates Claude Desktop config directory if it doesn't exist.

### 7. Validation

Validates config structure before writing:
- Checks for required `mcpServers` field
- Validates command, args, and env types
- Ensures JSON serialization compatibility

## Database Integration

### Query Pattern

```typescript
const mcpConfigs = await prisma.mcpConfig.findMany({
  where: {
    projectId,
    enabled: true,  // Only enabled servers
  },
  orderBy: {
    createdAt: 'asc',
  },
});
```

### Config Parsing

The `config` field in the database is stored as a JSON string:

```typescript
if (config.config) {
  const serverConfig = JSON.parse(config.config) as McpServerConfig;
  mcpServers[config.name] = serverConfig;
}
```

## Error Handling

All operations include comprehensive error handling:

1. **File System Errors:**
   - Missing directories (auto-created)
   - Permission issues
   - Invalid file content

2. **Database Errors:**
   - Invalid project ID
   - Database connection issues
   - Malformed config JSON

3. **Validation Errors:**
   - Invalid config structure
   - Missing required fields
   - Type mismatches

Errors are wrapped with user-friendly messages and logged to console.

## UI Integration

### Sync Button Flow

When user clicks "Sync to Claude Desktop":

1. UI calls `window.electron.invoke('mcp:writeConfig', projectId)`
2. Service reads enabled MCP configs from database
3. Service generates config object
4. Service reads existing Claude Desktop config
5. Service creates backup of existing config
6. Service merges configs (preserving non-managed servers)
7. Service writes merged config to file
8. UI shows success/error notification

### Preview Flow

To show users what will be synced:

1. UI calls `window.electron.invoke('mcp:generateConfig', projectId)`
2. Service generates config from database
3. UI displays preview in dialog/modal
4. User can review before clicking sync

### Current Config Display

To show users their current Claude Desktop config:

1. UI calls `window.electron.invoke('mcp:readConfig')`
2. Service reads file from disk
3. UI displays current servers and settings

## Example Usage

### From Renderer Process

```typescript
import { useIPC } from '../hooks/useIPC';

function McpSyncButton({ projectId }: { projectId: string }) {
  const { invoke } = useIPC();

  const handleSync = async () => {
    try {
      // Generate config (preview)
      const config = await invoke('mcp:generateConfig', projectId);
      console.log('Will sync:', config);

      // Write to Claude Desktop
      await invoke('mcp:writeConfig', projectId);

      toast.success('MCP config synced to Claude Desktop!');
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
    }
  };

  return (
    <button onClick={handleSync}>
      Sync to Claude Desktop
    </button>
  );
}
```

### Reading Current Config

```typescript
const handleViewCurrent = async () => {
  try {
    const config = await invoke('mcp:readConfig');

    if (!config) {
      toast.info('No Claude Desktop config found');
      return;
    }

    // Display config in dialog
    setCurrentConfig(config);
    setShowConfigDialog(true);
  } catch (error) {
    toast.error(`Failed to read config: ${error.message}`);
  }
};
```

## Security Considerations

1. **File System Access:**
   - Only writes to Claude Desktop config directory
   - Creates backups before modifications
   - Validates all paths

2. **Environment Variables:**
   - Stored in database config field
   - Not logged or exposed in UI by default
   - Should be marked as sensitive in UI

3. **Config Validation:**
   - All configs validated before writing
   - Invalid configs rejected with error
   - Prevents malformed JSON

## Testing Considerations

### Manual Testing

1. **Config Generation:**
   - Create project with enabled MCP servers
   - Generate config and verify structure
   - Check that disabled servers are excluded

2. **Config Writing:**
   - Write config to Claude Desktop
   - Verify file created at correct location
   - Check backup was created
   - Verify existing servers preserved

3. **Config Merging:**
   - Manually add server to Claude Desktop config
   - Sync from app
   - Verify manual server still exists

4. **Error Handling:**
   - Test with invalid project ID
   - Test with malformed config JSON
   - Test without write permissions

### Automated Testing (Future)

```typescript
describe('McpConfigService', () => {
  it('should generate config from enabled servers', async () => {
    const config = await mcpConfigService.generateConfig(projectId);
    expect(config.mcpServers).toHaveProperty('github');
  });

  it('should preserve non-managed servers', async () => {
    // Add manual server to config
    // Sync from app
    // Verify manual server still exists
  });
});
```

## File Structure

```
electron/
  services/
    mcp-config.ts          # New service
    database.ts            # Existing database service
  ipc/
    mcp.ts                 # Updated with new handlers
  utils/
    paths.ts               # Path utilities
src/
  types/
    ipc.ts                 # Updated with new types
docs/
  phase-11.5-mcp-config-generation.md  # This file
```

## Known Limitations

1. **Single Project Config:**
   - Only syncs one project's MCP servers at a time
   - Cannot merge multiple projects into one config
   - Consider adding project-scoped prefixes in future

2. **No Auto-Sync:**
   - Manual sync button click required
   - Could add auto-sync on toggle in future
   - Consider watching for config changes

3. **No Conflict Detection:**
   - Overwrites managed servers without warning
   - Could add diff view before sync
   - Consider showing what changed

## Future Enhancements

1. **Auto-Sync on Toggle:**
   ```typescript
   // After toggling server
   if (autoSyncEnabled) {
     await invoke('mcp:writeConfig', projectId);
   }
   ```

2. **Config Diff View:**
   - Show before/after comparison
   - Highlight added/removed/changed servers
   - Require confirmation before overwrite

3. **Multi-Project Support:**
   - Add project prefixes to server names
   - Allow multiple projects in one config
   - Show which project owns each server

4. **Validation UI:**
   - Test server configs before sync
   - Validate command paths exist
   - Check environment variables set

5. **Import from Claude Desktop:**
   - Read existing config
   - Import as new MCP configs in database
   - Preserve settings and environment

## References

- [MCP Documentation](https://modelcontextprotocol.io)
- [Claude Desktop Config Format](https://docs.anthropic.com/claude/docs/model-context-protocol)
- [PRD Phase 11: MCP Integration](../PRD.md#phase-11-mcp-integration)
