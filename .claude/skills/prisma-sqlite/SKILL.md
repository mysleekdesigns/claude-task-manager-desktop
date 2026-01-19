---
name: prisma-sqlite
description: Prisma ORM patterns for SQLite embedded databases in Electron apps. Use when designing schemas, writing queries, handling migrations, or dealing with SQLite-specific constraints like JSON storage.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Prisma with SQLite for Electron

## Overview

Prisma is configured with SQLite for embedded database storage in the Claude Tasks Desktop application. SQLite runs entirely locally without a server.

## Database Location

```typescript
// electron/services/database.ts
import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'claude-tasks.db');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

// Initialize database on app start
export async function initializeDatabase() {
  // Run migrations programmatically
  const { execSync } = require('child_process');
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
    },
  });
}
```

## SQLite-Specific Constraints

### 1. JSON Arrays as Strings

SQLite doesn't have native JSON array support in all configurations. Store arrays as JSON strings:

```prisma
model Task {
  id    String @id @default(cuid())
  tags  String @default("[]") // JSON array as string
}
```

```typescript
// Creating
await prisma.task.create({
  data: {
    title: 'My Task',
    tags: JSON.stringify(['bug', 'frontend']),
  },
});

// Reading
const task = await prisma.task.findUnique({ where: { id } });
const tags: string[] = JSON.parse(task.tags || '[]');

// Querying (limited - no native JSON operators)
// Use raw SQL for JSON queries if needed
const tasks = await prisma.$queryRaw`
  SELECT * FROM Task WHERE tags LIKE '%"bug"%'
`;
```

### 2. Enums Work Directly

Unlike PostgreSQL, SQLite enums are stored as strings:

```prisma
enum TaskStatus {
  PENDING
  PLANNING
  IN_PROGRESS
  AI_REVIEW
  HUMAN_REVIEW
  COMPLETED
  CANCELLED
}

model Task {
  status TaskStatus @default(PENDING)
}
```

### 3. DateTime Handling

SQLite stores dates as text. Prisma handles conversion:

```prisma
model Task {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 4. Cascade Deletes

Always specify cascade behavior for relations:

```prisma
model Project {
  id    String @id @default(cuid())
  tasks Task[]
}

model Task {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

## Common Query Patterns

### List with Relations
```typescript
const tasks = await prisma.task.findMany({
  where: { projectId },
  include: {
    assignee: true,
    phases: true,
    subtasks: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

### Upsert
```typescript
const settings = await prisma.userSettings.upsert({
  where: { userId },
  update: { theme: 'dark' },
  create: { userId, theme: 'dark' },
});
```

### Transactions
```typescript
const [task, terminal] = await prisma.$transaction([
  prisma.task.create({ data: taskData }),
  prisma.terminal.create({ data: terminalData }),
]);
```

### Count and Stats
```typescript
const stats = await prisma.task.groupBy({
  by: ['status'],
  where: { projectId },
  _count: true,
});
```

## Migration Strategy

### Development
```bash
# Create migration
npx prisma migrate dev --name add_feature

# Reset database (clears data!)
npx prisma migrate reset
```

### Production (App Updates)
```typescript
// electron/main.ts
import { execSync } from 'child_process';

app.whenReady().then(async () => {
  // Run pending migrations
  try {
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
      },
    });
  } catch (error) {
    console.error('Migration failed:', error);
  }
});
```

## Schema Design Tips

1. **Use `cuid()` for IDs** - Better than UUIDs for sorting
2. **Add indexes** for frequently queried fields
3. **Use `@@unique` constraints** for natural keys
4. **Set `onDelete` behavior** explicitly

```prisma
model ProjectMember {
  id        String      @id @default(cuid())
  role      ProjectRole @default(MEMBER)
  userId    String
  projectId String

  user      User    @relation(fields: [userId], references: [id])
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@index([projectId])
}
```
