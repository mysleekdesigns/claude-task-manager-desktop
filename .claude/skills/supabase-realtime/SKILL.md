---
name: supabase-realtime
description: Supabase real-time collaboration patterns for Electron desktop apps. Use when implementing cloud sync, real-time subscriptions, Row Level Security, authentication, or offline-first architecture with Supabase.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
---

# Supabase Real-Time for Electron Desktop Apps

## Overview

Supabase provides a PostgreSQL database with real-time subscriptions, authentication, and Row Level Security - ideal for adding collaboration features to the Claude Tasks Desktop application.

## Installation

```bash
npm install @supabase/supabase-js
```

## Client Setup for Electron

### Main Process Client
```typescript
// electron/services/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Store from 'electron-store';

const store = new Store({ name: 'supabase-auth' });

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storage: {
            getItem: (key) => store.get(key) as string | null,
            setItem: (key, value) => store.set(key, value),
            removeItem: (key) => store.delete(key),
          },
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  }
  return supabaseClient;
}
```

### TypeScript Types from Schema
```bash
# Generate types from your Supabase schema
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

```typescript
// src/types/supabase.ts (generated)
export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          status: string;
          project_id: string;
          assignee_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Row, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Insert>;
      };
      // ... other tables
    };
  };
};
```

## Real-Time Subscriptions

### Subscribe to Table Changes
```typescript
// electron/services/realtime.ts
import { getSupabase } from './supabase';
import { BrowserWindow } from 'electron';

export function subscribeToProjectTasks(
  projectId: string,
  mainWindow: BrowserWindow
) {
  const supabase = getSupabase();

  const channel = supabase
    .channel(`project-${projectId}-tasks`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE, or *
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        // Forward to renderer process
        mainWindow.webContents.send('realtime:task-change', {
          eventType: payload.eventType,
          old: payload.old,
          new: payload.new,
        });
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
```

### Handle in Renderer
```typescript
// src/hooks/useRealtimeSync.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSync(projectId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = window.electron.on('realtime:task-change', (payload) => {
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });

      // Or optimistically update cache
      if (payload.eventType === 'INSERT') {
        queryClient.setQueryData(['tasks', projectId], (old: Task[]) =>
          [...old, payload.new]
        );
      }
    });

    return unsubscribe;
  }, [projectId, queryClient]);
}
```

## Row Level Security (RLS)

### Enable RLS
```sql
-- Always enable RLS on tables with user data
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
```

### Common RLS Policies

#### Users see only their projects
```sql
CREATE POLICY "Users can view their projects"
ON projects FOR SELECT
USING (
  id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
);
```

#### Project members can view tasks
```sql
CREATE POLICY "Project members can view tasks"
ON tasks FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
);
```

#### Only assignees or admins can update tasks
```sql
CREATE POLICY "Assignees and admins can update tasks"
ON tasks FOR UPDATE
USING (
  assignee_id = auth.uid()
  OR project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN')
  )
)
WITH CHECK (
  -- Same condition for the new row
  assignee_id = auth.uid()
  OR project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN')
  )
);
```

#### Insert policy for new tasks
```sql
CREATE POLICY "Project members can create tasks"
ON tasks FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);
```

### Performance Tips for RLS
```sql
-- Add indexes for columns used in RLS policies
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
```

## Authentication in Electron

### OAuth Flow for Desktop Apps
```typescript
// electron/services/auth.ts
import { getSupabase } from './supabase';
import { shell, BrowserWindow } from 'electron';

export async function signInWithOAuth(provider: 'github' | 'google') {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: 'claude-tasks://auth/callback',
    },
  });

  if (data?.url) {
    // Open in system browser
    shell.openExternal(data.url);
  }

  return { data, error };
}

// Handle deep link callback
export function handleAuthCallback(url: string) {
  const supabase = getSupabase();
  const params = new URL(url).searchParams;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
}
```

### Email/Password Auth
```typescript
export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabase();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabase();
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  const supabase = getSupabase();
  return supabase.auth.signOut();
}
```

## Offline-First Sync Pattern

### Sync Queue Service
```typescript
// electron/services/sync-queue.ts
import Store from 'electron-store';
import { getSupabase } from './supabase';

interface QueueItem {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

const store = new Store({ name: 'sync-queue' });

export class SyncQueue {
  private isOnline = true;

  constructor() {
    // Monitor network status
    this.isOnline = navigator.onLine;
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async enqueue(item: Omit<QueueItem, 'id' | 'timestamp' | 'retries'>) {
    const queue = this.getQueue();
    queue.push({
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    });
    store.set('queue', queue);

    if (this.isOnline) {
      await this.processQueue();
    }
  }

  private getQueue(): QueueItem[] {
    return (store.get('queue') as QueueItem[]) || [];
  }

  async processQueue() {
    const supabase = getSupabase();
    const queue = this.getQueue();
    const processed: string[] = [];

    for (const item of queue.sort((a, b) => a.timestamp - b.timestamp)) {
      try {
        switch (item.operation) {
          case 'INSERT':
            await supabase.from(item.table).insert(item.data);
            break;
          case 'UPDATE':
            await supabase.from(item.table)
              .update(item.data)
              .eq('id', item.data.id);
            break;
          case 'DELETE':
            await supabase.from(item.table)
              .delete()
              .eq('id', item.data.id);
            break;
        }
        processed.push(item.id);
      } catch (error) {
        item.retries++;
        if (item.retries >= 3) {
          console.error('Max retries reached for sync item:', item);
          processed.push(item.id); // Remove failed item
        }
      }
    }

    // Remove processed items
    const remaining = queue.filter(item => !processed.includes(item.id));
    store.set('queue', remaining);
  }
}
```

### Conflict Resolution
```typescript
// Last-write-wins with server timestamp
async function syncWithConflictResolution(
  table: string,
  localData: Record<string, unknown>,
  localUpdatedAt: Date
) {
  const supabase = getSupabase();

  // Fetch server version
  const { data: serverData } = await supabase
    .from(table)
    .select('*')
    .eq('id', localData.id)
    .single();

  if (!serverData) {
    // Record doesn't exist on server, insert it
    return supabase.from(table).insert(localData);
  }

  const serverUpdatedAt = new Date(serverData.updated_at);

  if (localUpdatedAt > serverUpdatedAt) {
    // Local is newer, update server
    return supabase.from(table).update(localData).eq('id', localData.id);
  } else {
    // Server is newer, update local
    return { data: serverData, isServerNewer: true };
  }
}
```

## Database Schema for Sync

### Sync-Friendly Schema
```sql
-- All tables need these columns for sync
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'PENDING',
  priority TEXT DEFAULT 'MEDIUM',
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id),

  -- Sync metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ, -- Soft delete for sync
  sync_version INTEGER DEFAULT 1, -- Optimistic locking

  CONSTRAINT tasks_status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Auto-update updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Trigger for updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.sync_version = OLD.sync_version + 1;
  RETURN NEW;
END;
$$ language 'plpgsql';
```

## Environment Variables

```env
# .env (never commit!)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# Never expose service_role key to client!
```

## Key Resources
- [Supabase Docs - Real-time](https://supabase.com/docs/guides/realtime)
- [Supabase Docs - RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Docs - Auth](https://supabase.com/docs/guides/auth)
- [PowerSync for Offline-First](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)
