# Phase 2: Database & ORM - Complete

## Overview
Phase 2 sets up SQLite with Prisma ORM for the Claude Tasks Desktop application. The database is configured to run locally in the user's data directory without requiring a server.

## Completed Tasks

### 2.1 SQLite Setup ✅
- **Database Location**: User data directory (`~/Library/Application Support/claude-task-manager-desktop/claude-tasks.db` on macOS)
- **File**: `prisma/schema.prisma`
- **Environment**: `.env` configured with `DATABASE_URL=file:./dev.db`
- **Database Tools**: `better-sqlite3` installed for Node.js runtime access

### 2.2 Prisma Configuration ✅
- **Version**: Prisma 6.1.0 (stable, well-tested)
- **Provider**: SQLite
- **Client**: Generated at `/node_modules/.prisma/client/`
- **Setup**:
  - `npm install prisma @prisma/client --save-dev`
  - `npm install @prisma/client better-sqlite3`

### 2.3 User Model ✅
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  passwordHash  String
  avatar        String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  projectMembers ProjectMember[]
  sessions       Session[]
}
```

### 2.4 Project & ProjectMember Models ✅
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  targetPath  String?
  githubRepo  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members ProjectMember[]
  @@index([createdAt])
}

model ProjectMember {
  id        String   @id @default(cuid())
  role      String   @default("MEMBER") // OWNER, ADMIN, MEMBER, VIEWER
  userId    String
  projectId String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@index([projectId])
  @@index([userId])
}
```

**Note**: SQLite doesn't support native enums, so `ProjectRole` is stored as a String field. A TypeScript enum is provided in `electron/types/database.ts` for type safety.

### 2.5 Session Model ✅
```prisma
model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

## Files Created/Modified

### New Files
- `/prisma/schema.prisma` - Complete Prisma schema
- `/prisma/migrations/20260119172311_init/migration.sql` - Initial database migration
- `/electron/types/database.ts` - TypeScript enums and type guards for database types
- `/.env` - Environment configuration for local development
- `/.env.local` - Additional local overrides

### Modified Files
- `/.gitignore` - Added `*.db`, `*.db-journal`, `dev.db` to ignore database files

### Existing Files Verified
- `/electron/services/database.ts` - DatabaseService class for connection management
- `/electron/utils/paths.ts` - Path utilities for user data directory

## Key Features

### Database Service (`electron/services/database.ts`)
Provides a centralized DatabaseService class with:
- **Initialization**: Connects to SQLite with proper path resolution
- **Migration Support**: Runs pending migrations on app startup
- **Backup & Restore**: Creates timestamped backups and supports restore operations
- **Statistics**: Reports database size and status
- **Connection Management**: Safe connect/disconnect handling

### Type Safety
- Full TypeScript support with generated Prisma types
- `ProjectRole` enum in `electron/types/database.ts` for type guards
- Type-safe database operations through the service

### SQLite Compatibility
- Uses CUID (collision-resistant unique IDs) for better sorting
- JSON arrays stored as strings (following SQLite best practices)
- Proper cascade deletes configured for referential integrity
- Indexes on frequently queried fields for performance

## Database Location

The database is automatically stored in the user's data directory:
- **macOS**: `~/Library/Application Support/claude-task-manager-desktop/claude-tasks.db`
- **Windows**: `%APPDATA%\claude-task-manager-desktop\claude-tasks.db`
- **Linux**: `~/.config/claude-task-manager-desktop/claude-tasks.db`

Backups are stored in: `{userData}/backups/`

## Next Steps for Phase 3 (Authentication)

Phase 3 will implement:
1. Password hashing (bcrypt) for User.passwordHash
2. Session management and token validation
3. Protected routes and authentication middleware
4. IPC handlers for login/logout/signup
5. JWT or secure session token implementation

## Development Commands

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name descriptive_name

# Reset database (development only - clears all data)
npx prisma migrate reset

# Open database browser
npx prisma studio

# Generate Prisma client
npx prisma generate

# Apply migrations in production
npx prisma migrate deploy
```

## Verification

The migration has been successfully created and applied:
- ✅ SQLite database configured
- ✅ All models created with proper relations
- ✅ Indexes added for performance
- ✅ Cascade deletes configured
- ✅ Prisma client generated
- ✅ Migration SQL file created: `prisma/migrations/20260119172311_init/migration.sql`

## Notes

1. **Environment Variables**: The `.env` file contains `DATABASE_URL` - do not commit sensitive values here in production
2. **Migrations**: Always create new migrations for schema changes, never edit existing ones
3. **Database File**: The `.db` file is created on first connection and should not be committed to git
4. **Type Guards**: Use `isProjectRole()` from `electron/types/database.ts` to validate role strings at runtime
