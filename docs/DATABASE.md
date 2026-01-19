# Database Setup & Usage Guide

Claude Tasks Desktop uses **SQLite** with **Prisma ORM** for local data storage.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

This installs:
- `prisma@6.1.0` - Database ORM
- `@prisma/client` - Prisma runtime
- `better-sqlite3` - SQLite driver

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Create/Update Database
```bash
# Development: create new migrations
npx prisma migrate dev --name <description>

# Production: apply pending migrations
npx prisma migrate deploy
```

## Database Schema

The database includes the following models:

### User
- `id` (CUID) - Primary key
- `name` - Optional user name
- `email` - Unique email address
- `passwordHash` - Bcrypt hashed password
- `avatar` - Optional avatar URL
- `createdAt`, `updatedAt` - Timestamps

### Project
- `id` (CUID) - Primary key
- `name` - Project name
- `description` - Optional description
- `targetPath` - Optional file system path
- `githubRepo` - Optional GitHub repository URL
- `createdAt`, `updatedAt` - Timestamps

### ProjectMember
- `id` (CUID) - Primary key
- `role` - Member role (OWNER, ADMIN, MEMBER, VIEWER)
- `userId` - Foreign key to User
- `projectId` - Foreign key to Project
- `createdAt` - Creation timestamp
- Unique constraint: one membership per user+project

### Session
- `id` (CUID) - Primary key
- `token` - Unique session token
- `userId` - Foreign key to User
- `expiresAt` - Session expiration time
- `createdAt` - Creation timestamp

## Database Location

The SQLite database is stored in the user's data directory:

- **macOS**: `~/Library/Application Support/claude-task-manager-desktop/claude-tasks.db`
- **Windows**: `%APPDATA%\claude-task-manager-desktop\claude-tasks.db`
- **Linux**: `~/.config/claude-task-manager-desktop/claude-tasks.db`

For development, a `dev.db` file is created at the project root.

## Using Prisma in Code

### Get the Prisma Client
```typescript
import { getPrismaClient } from '@/electron/services/database';

const prisma = getPrismaClient();
```

### Create Records
```typescript
// Create a user
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    passwordHash: 'bcrypt_hash_here',
  },
});

// Create a project
const project = await prisma.project.create({
  data: {
    name: 'My Project',
  },
});

// Add user to project
const membership = await prisma.projectMember.create({
  data: {
    userId: user.id,
    projectId: project.id,
    role: 'OWNER',
  },
});
```

### Read Records
```typescript
// Find a user by email
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
});

// Get all projects
const projects = await prisma.project.findMany();

// Get projects with members
const projects = await prisma.project.findMany({
  include: {
    members: {
      include: {
        user: true,
      },
    },
  },
});
```

### Update Records
```typescript
const user = await prisma.user.update({
  where: { id: userId },
  data: {
    name: 'New Name',
  },
});
```

### Delete Records
```typescript
// Delete a user (cascades to ProjectMember and Session)
await prisma.user.delete({
  where: { id: userId },
});
```

## Transactions

For multi-step operations that must all succeed or fail together:

```typescript
const [user, project] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.project.create({ data: projectData }),
]);
```

## JSON Fields

SQLite doesn't have native JSON support, so JSON arrays are stored as strings:

```typescript
// Create with JSON array
const task = await prisma.task.create({
  data: {
    title: 'My Task',
    tags: JSON.stringify(['backend', 'bug']),
  },
});

// Read and parse JSON
const task = await prisma.task.findUnique({ where: { id } });
const tags = JSON.parse(task.tags || '[]');
```

## Migrations

Migrations track schema changes and are essential for:
- Applying changes to production databases
- Sharing schema changes with team members
- Rolling back changes if needed

### Create a Migration
```bash
npx prisma migrate dev --name add_tasks_table
```

This will:
1. Create a migration in `prisma/migrations/`
2. Apply the migration to the dev database
3. Generate updated Prisma client types

### What Gets Migrated
- New models
- New fields
- Field type changes
- Index changes
- Relation changes

### Reset Database (Development Only)
```bash
npx prisma migrate reset
```

⚠️ **Warning**: This deletes all data and re-applies all migrations!

## Database Browser

Open an interactive database browser:
```bash
npx prisma studio
```

This opens a web UI at `http://localhost:5555` where you can:
- View all records
- Create, edit, delete records
- Explore relationships
- Query data with filters

## Best Practices

1. **Always use migrations** - Never modify the schema without creating a migration
2. **Use relations properly** - Define both sides of relationships
3. **Add indexes** - Index frequently queried fields for performance
4. **Validate inputs** - Validate data before sending to database
5. **Handle errors** - Catch and log database errors appropriately
6. **Use transactions** - Group related operations in transactions
7. **Close connections** - Call `disconnect()` when app closes

## TypeScript Support

Prisma generates full TypeScript types. Import them like:

```typescript
import type { User, Project, ProjectMember, Session } from '@prisma/client';
```

Use these types for:
- Function parameters
- Return types
- Variable declarations
- IPC message types

## Performance Tips

1. **Use select for large datasets**
   ```typescript
   const users = await prisma.user.findMany({
     select: { id: true, email: true },
   });
   ```

2. **Use include wisely** - Only include related data you need
   ```typescript
   const user = await prisma.user.findUnique({
     where: { id },
     include: { sessions: true }, // Only if needed
   });
   ```

3. **Use pagination** for large result sets
   ```typescript
   const users = await prisma.user.findMany({
     skip: 0,
     take: 50,
   });
   ```

4. **Create indexes** on frequently searched fields
   ```prisma
   model Project {
     id        String @id @default(cuid())
     name      String
     createdAt DateTime @default(now())

     @@index([createdAt])
   }
   ```

## Troubleshooting

### Database file not found
- Check that the user data directory exists
- Verify permissions on the directory
- Check `.env` file for correct `DATABASE_URL`

### "Cannot find PrismaClient"
- Run `npx prisma generate`
- Check that `@prisma/client` is installed

### Migration conflicts
- In development, use `npx prisma migrate resolve --rolled-back <migration>`
- Never commit conflicted migration files

### Connection errors
- Ensure the database file path is correct
- Check that another app isn't locking the database
- Try deleting `dev.db` and re-running migrations

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Prisma SQLite Guide](https://www.prisma.io/docs/orm/overview/databases/sqlite)
