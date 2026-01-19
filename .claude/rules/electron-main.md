---
paths:
  - "electron/**/*.ts"
---

# Electron Main Process Rules

## Security

- Never expose Node.js APIs directly to renderer
- Use contextBridge for all IPC communication
- Validate all IPC inputs from renderer
- Never store secrets in plain text (use electron-store with encryption)

## IPC Handlers

- Group handlers by domain in separate files
- Use consistent naming: `domain:action` (e.g., `tasks:list`)
- Return serializable data only (no Prisma model instances)
- Handle errors gracefully and return meaningful messages

```typescript
// Good
ipcMain.handle('tasks:list', async (_, projectId: string) => {
  if (!projectId) throw new Error('Project ID is required');

  const tasks = await prisma.task.findMany({
    where: { projectId },
  });

  return tasks.map(t => ({
    ...t,
    tags: JSON.parse(t.tags || '[]'),
  }));
});

// Bad - exposes Prisma instances
ipcMain.handle('tasks:list', async (_, projectId) => {
  return prisma.task.findMany({ where: { projectId } });
});
```

## Database Operations

- Always use Prisma through the centralized database service
- Handle JSON serialization for SQLite compatibility
- Use transactions for multi-step operations
- Implement proper cascade deletes

## Terminal Management

- Clean up processes on window close
- Handle process spawn errors
- Buffer output for performance
- Support cross-platform shells

## File Operations

- Use Electron's dialog APIs for file/directory selection
- Validate paths before operations
- Handle cross-platform path differences
- Use app.getPath() for user data locations
