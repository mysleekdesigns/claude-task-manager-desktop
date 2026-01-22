# Electron Performance Optimization

## Overview

Performance optimization patterns for Electron applications, covering memory management, profiling, bundle analysis, and common anti-patterns specific to the Claude Tasks Desktop application.

## Memory Profiling Patterns

### Heap Snapshot Comparison

Take heap snapshots before and after suspected leaking operations to identify retained objects.

```typescript
// Debug utility for main process
// electron/utils/memoryDebug.ts
export function logMemoryUsage(label: string) {
  const usage = process.memoryUsage();
  console.log(`[Memory: ${label}]`, {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}

// Usage in handlers
ipcMain.handle('tasks:list', async (_, projectId) => {
  logMemoryUsage('before tasks:list');
  const result = await prisma.task.findMany({ where: { projectId } });
  logMemoryUsage('after tasks:list');
  return result;
});
```

### IPC Listener Tracking

Track IPC listener registration and removal to detect leaks.

```typescript
// electron/preload.ts - Debug version
import { contextBridge, ipcRenderer } from 'electron';

const listeners = new Map<string, Set<Function>>();

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(callback);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[IPC] Listener added: ${channel} (count: ${listeners.get(channel)!.size})`);
    }

    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    // Return disposer for cleanup
    return () => {
      listeners.get(channel)?.delete(callback);
      ipcRenderer.removeListener(channel, subscription);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[IPC] Listener removed: ${channel} (count: ${listeners.get(channel)?.size})`);
      }
    };
  },

  // Debug: get current listener counts
  getListenerCounts: () => {
    const counts: Record<string, number> = {};
    listeners.forEach((set, channel) => {
      counts[channel] = set.size;
    });
    return counts;
  },
});
```

### React Component Memory Tracking

```typescript
// src/hooks/useMemoryDebug.ts
import { useEffect, useRef } from 'react';

export function useMemoryDebug(componentName: string) {
  const mountCount = useRef(0);
  const unmountCount = useRef(0);

  useEffect(() => {
    mountCount.current++;
    console.log(`[Mount] ${componentName} (total mounts: ${mountCount.current})`);

    return () => {
      unmountCount.current++;
      console.log(`[Unmount] ${componentName} (total unmounts: ${unmountCount.current})`);

      // Check for mismatched mount/unmount
      if (mountCount.current !== unmountCount.current) {
        console.warn(`[Memory Warning] ${componentName}: mount/unmount mismatch`);
      }
    };
  }, [componentName]);
}

// Usage
function TaskCard({ task }: Props) {
  useMemoryDebug('TaskCard');
  // ...
}
```

## Performance Measurement Code Snippets

### Startup Time Tracking

```typescript
// electron/main.ts
const STARTUP_MARKS = {
  processStart: performance.now(),
  appReady: 0,
  windowCreated: 0,
  windowLoaded: 0,
  firstPaint: 0,
};

app.whenReady().then(() => {
  STARTUP_MARKS.appReady = performance.now();
  console.log(`[Startup] App ready: ${STARTUP_MARKS.appReady - STARTUP_MARKS.processStart}ms`);

  mainWindow = createWindow();
  STARTUP_MARKS.windowCreated = performance.now();
  console.log(`[Startup] Window created: ${STARTUP_MARKS.windowCreated - STARTUP_MARKS.processStart}ms`);

  mainWindow.webContents.on('did-finish-load', () => {
    STARTUP_MARKS.windowLoaded = performance.now();
    console.log(`[Startup] Window loaded: ${STARTUP_MARKS.windowLoaded - STARTUP_MARKS.processStart}ms`);
  });

  mainWindow.webContents.on('did-first-visually-non-empty-paint', () => {
    STARTUP_MARKS.firstPaint = performance.now();
    console.log(`[Startup] First paint: ${STARTUP_MARKS.firstPaint - STARTUP_MARKS.processStart}ms`);
  });
});
```

### IPC Performance Wrapper

```typescript
// src/hooks/useIPC.ts
export function useIPC() {
  const invoke = async <T extends keyof IpcChannels>(
    channel: T,
    ...args: Parameters<IpcChannels[T]>
  ): Promise<Awaited<ReturnType<IpcChannels[T]>>> => {
    const start = performance.now();

    try {
      const result = await window.electron.invoke(channel, ...args);

      if (process.env.NODE_ENV === 'development') {
        const duration = performance.now() - start;
        if (duration > 100) {
          console.warn(`[IPC Slow] ${channel}: ${duration.toFixed(2)}ms`);
        } else {
          console.debug(`[IPC] ${channel}: ${duration.toFixed(2)}ms`);
        }
      }

      return result;
    } catch (error) {
      console.error(`[IPC Error] ${channel}:`, error);
      throw error;
    }
  };

  return { invoke };
}
```

### React Render Performance

```typescript
// src/components/PerformanceMonitor.tsx
import { Profiler, ProfilerOnRenderCallback } from 'react';

const onRenderCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (actualDuration > 16) { // Longer than one frame at 60fps
    console.warn(`[Render Slow] ${id} (${phase}): ${actualDuration.toFixed(2)}ms`);
  }
};

export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  id: string
) {
  return function ProfiledComponent(props: P) {
    return (
      <Profiler id={id} onRender={onRenderCallback}>
        <Component {...props} />
      </Profiler>
    );
  };
}

// Usage
export const ProfiledTaskList = withProfiler(TaskList, 'TaskList');
```

### Terminal Resource Monitoring

```typescript
// electron/services/terminal.ts
export class TerminalManager {
  private terminals = new Map<string, { process: pty.IPty; createdAt: number }>();

  spawn(id: string, cwd: string, onData: (data: string) => void) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], { cwd, cols: 80, rows: 24 });

    this.terminals.set(id, {
      process: ptyProcess,
      createdAt: Date.now(),
    });

    console.log(`[Terminal] Spawned ${id} (total: ${this.terminals.size})`);

    ptyProcess.onData(onData);
    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[Terminal] Exited ${id} with code ${exitCode}`);
      this.terminals.delete(id);
    });

    return ptyProcess;
  }

  getStats() {
    const stats = {
      count: this.terminals.size,
      terminals: Array.from(this.terminals.entries()).map(([id, data]) => ({
        id,
        uptime: Date.now() - data.createdAt,
      })),
    };
    return stats;
  }

  closeAll() {
    console.log(`[Terminal] Closing all (${this.terminals.size} active)`);
    for (const [id, { process }] of this.terminals) {
      process.kill();
      this.terminals.delete(id);
    }
  }
}
```

## Common Performance Anti-Patterns

### Anti-Pattern 1: Missing IPC Listener Cleanup

```typescript
// BAD - Memory leak: listener never removed
function TerminalOutput({ terminalId }: Props) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    window.electron.on(`terminal:output:${terminalId}`, (data: string) => {
      setOutput(prev => prev + data);
    });
    // Missing cleanup!
  }, [terminalId]);

  return <pre>{output}</pre>;
}

// GOOD - Proper cleanup with disposer pattern
function TerminalOutput({ terminalId }: Props) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    const handleOutput = (data: string) => {
      setOutput(prev => prev + data);
    };

    window.electron.on(`terminal:output:${terminalId}`, handleOutput);

    return () => {
      window.electron.removeListener(`terminal:output:${terminalId}`, handleOutput);
    };
  }, [terminalId]);

  return <pre>{output}</pre>;
}
```

### Anti-Pattern 2: Unbatched IPC Calls

```typescript
// BAD - Multiple sequential IPC calls
async function loadDashboard() {
  const projects = await invoke('projects:list');
  const tasks = await invoke('tasks:list', currentProject);
  const user = await invoke('auth:getCurrentUser');
  const settings = await invoke('settings:get');
}

// GOOD - Batch independent calls
async function loadDashboard() {
  const [projects, tasks, user, settings] = await Promise.all([
    invoke('projects:list'),
    invoke('tasks:list', currentProject),
    invoke('auth:getCurrentUser'),
    invoke('settings:get'),
  ]);
}
```

### Anti-Pattern 3: Missing React.memo for List Items

```typescript
// BAD - Re-renders all cards on any change
function TaskList({ tasks }: Props) {
  return (
    <div>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

// GOOD - Memoized card component
const TaskCard = React.memo(function TaskCard({ task }: Props) {
  return <div>{task.title}</div>;
}, (prev, next) => prev.task.id === next.task.id && prev.task.updatedAt === next.task.updatedAt);
```

### Anti-Pattern 4: Inline Object Props

```typescript
// BAD - Creates new object on every render
function ParentComponent() {
  return <ChildComponent style={{ color: 'red' }} options={{ debounce: 100 }} />;
}

// GOOD - Stable references
const STYLES = { color: 'red' };
const OPTIONS = { debounce: 100 };

function ParentComponent() {
  return <ChildComponent style={STYLES} options={OPTIONS} />;
}

// Or with useMemo for dynamic values
function ParentComponent({ color }: Props) {
  const style = useMemo(() => ({ color }), [color]);
  return <ChildComponent style={style} />;
}
```

### Anti-Pattern 5: Blocking Main Process

```typescript
// BAD - Synchronous file operations block UI
ipcMain.handle('projects:export', (_, projectId) => {
  const data = fs.readFileSync(path); // Blocks!
  return JSON.parse(data.toString());
});

// GOOD - Async operations
ipcMain.handle('projects:export', async (_, projectId) => {
  const data = await fs.promises.readFile(path);
  return JSON.parse(data.toString());
});
```

### Anti-Pattern 6: Large IPC Payloads

```typescript
// BAD - Transferring entire database
ipcMain.handle('tasks:search', async () => {
  return prisma.task.findMany({
    include: { project: true, assignee: true, phases: true, subtasks: true }
  });
});

// GOOD - Paginated with minimal data
ipcMain.handle('tasks:search', async (_, { query, page, limit = 50 }) => {
  return prisma.task.findMany({
    where: { title: { contains: query } },
    select: { id: true, title: true, status: true },
    skip: page * limit,
    take: limit,
  });
});
```

## Optimization Techniques

### Code Splitting for Routes

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/*" element={<Projects />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### Virtual List for Large Data Sets

```typescript
// Using @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTaskList({ tasks }: { tasks: Task[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TaskCard task={tasks[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Debounced Search

```typescript
// src/hooks/useDebouncedSearch.ts
import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash-es';

export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  delay = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q.trim()) {
          setResults(null);
          return;
        }
        setIsLoading(true);
        try {
          const data = await searchFn(q);
          setResults(data);
        } finally {
          setIsLoading(false);
        }
      }, delay),
    [searchFn, delay]
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query, debouncedSearch]);

  return { query, setQuery, results, isLoading };
}
```

### Preload Critical Data

```typescript
// electron/main.ts
mainWindow.webContents.on('did-finish-load', async () => {
  // Preload data the user will need immediately
  const [user, projects] = await Promise.all([
    prisma.user.findFirst({ where: { /* current session */ } }),
    prisma.project.findMany({ take: 10, orderBy: { updatedAt: 'desc' } }),
  ]);

  mainWindow.webContents.send('preload:data', { user, projects });
});
```

### Optimize Prisma Queries

```typescript
// Use select to limit fields
const tasks = await prisma.task.findMany({
  where: { projectId },
  select: {
    id: true,
    title: true,
    status: true,
    priority: true,
    // Omit large fields like description unless needed
  },
});

// Use cursor-based pagination for large datasets
const tasks = await prisma.task.findMany({
  take: 20,
  skip: 1, // Skip the cursor
  cursor: { id: lastTaskId },
  where: { projectId },
  orderBy: { createdAt: 'desc' },
});
```

## Bundle Analysis Configuration

### Vite Visualizer Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/bundle-stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // or 'sunburst', 'network'
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
          ],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
    // Report chunk sizes
    chunkSizeWarningLimit: 500, // KB
  },
});
```

### Dependency Analysis Commands

```bash
# Analyze npm package sizes
npx cost-of-modules --no-install

# Find duplicate packages
npm ls --all 2>/dev/null | grep -E "^\w" | sort | uniq -c | sort -rn | head -20

# Check for unused dependencies
npx depcheck

# Analyze bundle with source-map-explorer
npx source-map-explorer dist/assets/*.js
```
