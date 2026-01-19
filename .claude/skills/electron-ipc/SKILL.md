---
name: electron-ipc
description: Type-safe IPC communication patterns for Electron apps. Use when creating IPC handlers, preload scripts, or renderer-to-main communication. Covers contextBridge, ipcMain.handle, and type definitions.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Electron IPC Communication Patterns

## Overview

Electron apps use Inter-Process Communication (IPC) between the main process (Node.js) and renderer process (browser). This skill covers type-safe patterns for the Claude Tasks Desktop application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               IPC Handlers (ipcMain)                 │    │
│  │   tasks:list, tasks:create, terminal:spawn, etc.    │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC Channel
┌───────────────────────────┼─────────────────────────────────┐
│                     Preload Script                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           contextBridge.exposeInMainWorld            │    │
│  │              window.electron.invoke()                │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    Renderer Process                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   React App                          │    │
│  │           useIPC hook → window.electron              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Type Definitions

```typescript
// src/types/ipc.ts
export interface IpcChannels {
  // Auth
  'auth:login': (email: string, password: string) => Promise<{ user: User; token: string }>;
  'auth:logout': () => Promise<void>;
  'auth:getCurrentUser': () => Promise<User | null>;

  // Projects
  'projects:list': () => Promise<Project[]>;
  'projects:create': (data: CreateProjectInput) => Promise<Project>;
  'projects:get': (id: string) => Promise<Project | null>;
  'projects:update': (id: string, data: UpdateProjectInput) => Promise<Project>;
  'projects:delete': (id: string) => Promise<void>;

  // Tasks
  'tasks:list': (projectId: string) => Promise<Task[]>;
  'tasks:create': (data: CreateTaskInput) => Promise<Task>;
  'tasks:updateStatus': (id: string, status: TaskStatus) => Promise<Task>;

  // Terminals
  'terminal:create': (options: TerminalOptions) => Promise<{ id: string }>;
  'terminal:write': (options: { id: string; data: string }) => Promise<void>;
  'terminal:resize': (options: { id: string; cols: number; rows: number }) => Promise<void>;
  'terminal:close': (id: string) => Promise<void>;

  // File dialogs
  'dialog:openDirectory': () => Promise<string | null>;
}

// Extend window type
declare global {
  interface Window {
    electron: {
      invoke<T extends keyof IpcChannels>(
        channel: T,
        ...args: Parameters<IpcChannels[T]>
      ): ReturnType<IpcChannels[T]>;
      on(channel: string, callback: (...args: unknown[]) => void): void;
      removeListener(channel: string, callback: (...args: unknown[]) => void): void;
    };
  }
}
```

## Preload Script

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
```

## Main Process Handlers

```typescript
// electron/ipc/index.ts
import { ipcMain, dialog } from 'electron';
import { registerAuthHandlers } from './auth';
import { registerProjectHandlers } from './projects';
import { registerTaskHandlers } from './tasks';
import { registerTerminalHandlers } from './terminals';

export function registerAllHandlers(mainWindow: BrowserWindow) {
  registerAuthHandlers();
  registerProjectHandlers();
  registerTaskHandlers();
  registerTerminalHandlers(mainWindow);

  // File dialogs
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

// electron/ipc/tasks.ts
import { ipcMain } from 'electron';
import { prisma } from '../services/database';
import type { TaskStatus, CreateTaskInput } from '../../src/types';

export function registerTaskHandlers() {
  ipcMain.handle('tasks:list', async (_, projectId: string) => {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: { assignee: true, phases: true },
      orderBy: { createdAt: 'desc' },
    });

    // Transform for serialization
    return tasks.map(task => ({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
    }));
  });

  ipcMain.handle('tasks:create', async (_, data: CreateTaskInput) => {
    const task = await prisma.task.create({
      data: {
        ...data,
        tags: JSON.stringify(data.tags || []),
      },
    });
    return { ...task, tags: data.tags || [] };
  });

  ipcMain.handle('tasks:updateStatus', async (_, id: string, status: TaskStatus) => {
    return prisma.task.update({
      where: { id },
      data: { status },
    });
  });
}
```

## Renderer Hook

```typescript
// src/hooks/useIPC.ts
import type { IpcChannels } from '../types/ipc';

export function useIPC() {
  const invoke = async <T extends keyof IpcChannels>(
    channel: T,
    ...args: Parameters<IpcChannels[T]>
  ): Promise<Awaited<ReturnType<IpcChannels[T]>>> => {
    return window.electron.invoke(channel, ...args);
  };

  return { invoke };
}

// Usage in components
function TaskList({ projectId }: { projectId: string }) {
  const { invoke } = useIPC();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    invoke('tasks:list', projectId).then(setTasks);
  }, [projectId]);
}
```

## Push Events (Terminal Output)

```typescript
// Main process - sending data to renderer
mainWindow.webContents.send(`terminal:output:${terminalId}`, data);

// Renderer - receiving data
useEffect(() => {
  const handleOutput = (data: string) => {
    terminal.write(data);
  };

  window.electron.on(`terminal:output:${terminalId}`, handleOutput);

  return () => {
    window.electron.removeListener(`terminal:output:${terminalId}`, handleOutput);
  };
}, [terminalId]);
```

## Error Handling

```typescript
// Main process
ipcMain.handle('tasks:create', async (_, data) => {
  try {
    return await prisma.task.create({ data });
  } catch (error) {
    // Serialize error for IPC
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
});

// Renderer
try {
  await invoke('tasks:create', taskData);
} catch (error) {
  toast.error(error.message);
}
```
