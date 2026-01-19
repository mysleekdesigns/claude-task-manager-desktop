# Electron Main Process Services

This directory contains services that run in the Electron main process.

## Database Service

The `DatabaseService` class manages all database operations for the application.

### Initialization

Initialize the database when the Electron app starts:

```typescript
// electron/main.ts
import { app } from 'electron';
import { databaseService } from './services/database';

app.whenReady().then(async () => {
  try {
    // Initialize database
    await databaseService.initialize();

    // Run migrations (production only)
    if (process.env.NODE_ENV === 'production') {
      await databaseService.runMigrations();
    }

    // Create main window...
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', async () => {
  await databaseService.disconnect();
});
```

### Usage in IPC Handlers

```typescript
// electron/ipc/tasks.ts
import { ipcMain } from 'electron';
import { getPrismaClient } from '../services/database';

export function registerTaskHandlers() {
  ipcMain.handle('tasks:list', async (_, projectId: string) => {
    const prisma = getPrismaClient();

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: { assignee: true },
    });

    // Transform JSON strings to arrays
    return tasks.map(task => ({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
    }));
  });
}
```

### Backup and Restore

```typescript
// Create backup
const backupPath = await databaseService.backup();
console.log('Backup created:', backupPath);

// Restore from backup
await databaseService.restore('/path/to/backup.db');
```

### Database Statistics

```typescript
const stats = await databaseService.getStats();
console.log('Database info:', stats);
// {
//   path: '/Users/name/Library/Application Support/claude-task-manager-desktop/claude-tasks.db',
//   size: 1048576,
//   sizeFormatted: '1 MB',
//   exists: true
// }
```

## Path Utilities

Use the path utilities for consistent path handling across platforms:

```typescript
import {
  getUserDataPath,
  getDatabasePath,
  getBackupsPath,
  getLogsPath,
  normalizePath,
  pathExists,
  ensureDirectory,
} from '../utils/paths';

// Get platform-specific paths
const userDataDir = getUserDataPath();
const dbPath = getDatabasePath();

// Ensure a directory exists
ensureDirectory('/path/to/directory');

// Check if path exists
if (pathExists(filePath)) {
  // ...
}
```

## Important Notes

1. **Database Location**: The database file is stored in the user data directory, which varies by platform:
   - macOS: `~/Library/Application Support/claude-task-manager-desktop/claude-tasks.db`
   - Windows: `%APPDATA%/claude-task-manager-desktop/claude-tasks.db`
   - Linux: `~/.config/claude-task-manager-desktop/claude-tasks.db`

2. **SQLite Constraints**:
   - JSON arrays must be stored as strings (use `JSON.stringify()` and `JSON.parse()`)
   - Always specify `onDelete` behavior for relations
   - Use transactions for multi-step operations

3. **Migrations**:
   - Development: Use `npx prisma migrate dev --name <name>`
   - Production: Migrations run automatically via `databaseService.runMigrations()`

4. **Error Handling**: Always wrap database operations in try-catch blocks when using in IPC handlers.
