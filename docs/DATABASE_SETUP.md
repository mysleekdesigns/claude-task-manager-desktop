# Database Setup & Configuration

## Overview

This project uses **Prisma 6.x** with **SQLite** for the embedded database. The database is stored locally in the user's data directory during runtime, but migrations use a development database for schema management.

## File Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── prisma.config.ts       # Prisma configuration (auto-initializes DATABASE_URL)
│   ├── dev.db                 # Development database (migrations)
│   └── migrations/            # Migration files
├── electron/
│   └── services/
│       └── database.ts        # DatabaseService for runtime database access
├── .env                       # Environment variables (DATABASE_URL for CLI)
└── .prismarc.json            # Prisma runtime configuration
```

## Configuration

### Environment Variable: DATABASE_URL

The `DATABASE_URL` environment variable is critical for Prisma operations:

```env
DATABASE_URL="file:./prisma/dev.db"
```

**Purpose:**
- Used by all Prisma CLI commands (`migrate`, `generate`, `studio`)
- Loaded from `.env` file automatically
- Must use SQLite `file:` protocol

### Prisma Configuration Files

#### `.env` (Development)
```env
DATABASE_URL="file:./prisma/dev.db"
```

Automatically loaded by Prisma CLI. Used for:
- `npx prisma migrate dev`
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npx prisma studio`

#### `prisma/prisma.config.ts`
```typescript
/**
 * Auto-initializes DATABASE_URL if not already set.
 * Ensures migrations and generation work even without .env file.
 */
```

This file:
- Provides fallback DATABASE_URL configuration
- Can be loaded by build processes
- Ensures Prisma operations work consistently

#### `.prismarc.json`
```json
{
  "engine": {
    "binaryTargets": ["native", "darwin-arm64", "darwin-x64", "windows-x64", "linux-x64"]
  }
}
```

Specifies Prisma binary targets for:
- macOS (Intel & Apple Silicon)
- Windows
- Linux

## Runtime vs. Development Databases

### Development Database (`prisma/dev.db`)
- Used by Prisma CLI for migrations
- Located in project root
- Contains schema for development
- Used by `npx prisma studio`

### Runtime Database
- Located in user's app data directory
- Path: `app.getPath('userData')/claude-tasks.db`
- Used by the actual Electron application
- Created on first app launch
- Migrations applied on startup via `runMigrations()`

## Working with Migrations

### Creating a Migration

```bash
npx prisma migrate dev --name add_feature_name
```

This command:
1. Updates the schema in `prisma/dev.db`
2. Creates a new migration file in `prisma/migrations/`
3. Prompts to reset database if needed (in development)

### Applying Migrations

**Development:**
```bash
npx prisma migrate dev --name feature
```

**Production/Runtime:**
Migrations are automatically applied when the app starts via `databaseService.runMigrations()`.

### Viewing Migration Status

```bash
npx prisma migrate status
```

Shows pending migrations and their status.

### Resetting Database (Development Only)

```bash
npx prisma migrate reset
```

**WARNING:** This deletes all data and re-runs all migrations. Development only!

### Opening Database Browser

```bash
npx prisma studio
```

Opens a web UI to browse and edit database records.

## Database Service

The `DatabaseService` class (`electron/services/database.ts`) handles:

### Initialization
```typescript
const prisma = await databaseService.initialize();
```

- Ensures user data directory exists
- Creates/connects to runtime database
- Loads Prisma client with adapter pattern (Prisma 7+) or fallback (Prisma 6)

### Running Migrations
```typescript
await databaseService.runMigrations();
```

Called on app startup to apply pending migrations to runtime database.

### Getting Prisma Client
```typescript
const prisma = databaseService.getClient();
// Use prisma for queries
const user = await prisma.user.findUnique({ where: { id } });
```

### Backup & Restore
```typescript
// Create backup
const backupPath = await databaseService.backup();

// Restore from backup
await databaseService.restore(backupPath);
```

## Prisma Version Migration Strategy

### Current: Prisma 6.x

- Uses `url = env("DATABASE_URL")` in schema
- DATABASE_URL required in all Prisma operations
- Adapter pattern supported but not required

### Future: Prisma 7+

When upgrading to Prisma 7+, the following changes are required:

1. Remove `url` from datasource in `schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  // url removed - handled by adapter
}
```

2. Use adapter pattern in PrismaClient:
```typescript
import { PrismaSqlite } from '@prisma/adapter-sqlite';
import Database from 'better-sqlite3';

const sqliteClient = new Database(dbPath);
const adapter = new PrismaSqlite(sqliteClient);

const prisma = new PrismaClient({ adapter });
```

3. Create `prisma.config.ts` for migrations:
```typescript
// prisma.config.ts provides DATABASE_URL for CLI commands
export const databaseUrl = `file:${getDatabasePath()}`;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}
```

The existing implementation in `database.ts` (lines 72-84) already supports this pattern with fallback.

## SQLite-Specific Patterns

### JSON Arrays as Strings

SQLite doesn't have native JSON array support. Store as strings:

```prisma
model Task {
  tags String @default("[]") // JSON array as string
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
```

### Cascade Deletes

Always specify delete behavior:

```prisma
model Task {
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### DateTime Handling

Prisma handles SQLite DateTime conversion:

```prisma
model Task {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Schema Location & Validation

### Schema File: `prisma/schema.prisma`

- Single source of truth for database schema
- Loaded by all Prisma CLI commands
- Auto-discovered in standard location

### Validation

Errors in schema are caught when running:
```bash
npx prisma validate
npx prisma generate
npx prisma migrate dev
```

## Common Commands Reference

```bash
# Code generation
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_users_table

# Apply pending migrations
npx prisma migrate deploy

# View migration status
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset

# Open database browser
npx prisma studio

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

## Troubleshooting

### "DATABASE_URL" not found error
- Ensure `.env` file exists with `DATABASE_URL="file:./prisma/dev.db"`
- Or set it in your shell: `export DATABASE_URL="file:./prisma/dev.db"`

### "Database does not exist" error
- Run migrations first: `npx prisma migrate deploy`
- Or reset: `npx prisma migrate reset`

### Prisma client not generated
- Run: `npx prisma generate`
- Check that `schema.prisma` exists and is valid

### Migration conflicts
- In development: `npx prisma migrate reset`
- In production: Review and resolve conflicts manually

### Binary target mismatch
- Ensure `.prismarc.json` includes your platform
- Native binaries are auto-detected; specify if cross-compiling
