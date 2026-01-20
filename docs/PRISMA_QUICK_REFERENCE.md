# Prisma Quick Reference

## Essential Commands

### Development

```bash
# Create and apply a new migration
npm run migrate:dev

# Or manually:
npx prisma migrate dev --name add_feature_name

# Open database browser
npx prisma studio

# Reset database (development only - DELETES ALL DATA)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

### Production

```bash
# Apply pending migrations (called automatically on app startup)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Validate schema syntax
npx prisma validate
```

### Schema Management

```bash
# Format schema file
npx prisma format

# View schema
cat prisma/schema.prisma
```

## Configuration

### Where DATABASE_URL is Set

1. **`.env` file** (primary)
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```

2. **`prisma/prisma.config.ts`** (fallback)
   - Auto-initializes if .env not loaded
   - Used by build processes

### Binary Targets

Configure in `.prismarc.json`:
```json
{
  "engine": {
    "binaryTargets": ["native", "darwin-arm64", "darwin-x64", "windows-x64", "linux-x64"]
  }
}
```

## Common Tasks

### Creating a Migration

**Scenario:** Adding a new model or field

```bash
# 1. Update prisma/schema.prisma with your changes
# 2. Run:
npx prisma migrate dev --name describe_what_changed

# 3. Verify the migration file in prisma/migrations/
# 4. The database is automatically updated
```

### Reviewing Migration Status

```bash
npx prisma migrate status
```

Output shows:
- Total migrations found
- Pending migrations
- Applied migrations
- Current schema status

### Exploring Database

```bash
# Open web browser UI
npx prisma studio

# Then:
# - View all tables and records
# - Filter and search data
# - Edit/create records directly
# - Export data
```

### Fixing Migration Conflicts (Development)

```bash
# If migrations get out of sync:
npx prisma migrate reset

# This:
# 1. Drops all data
# 2. Re-runs all migrations from scratch
# 3. Seeds database if seed.ts exists

# WARNING: Only for development!
```

## SQLite Patterns

### Storing JSON Arrays

```typescript
// Define in schema.prisma
model Task {
  tags String @default("[]")
}

// Create with JSON stringified data
await prisma.task.create({
  data: {
    tags: JSON.stringify(['bug', 'frontend']),
  },
});

// Read and parse
const task = await prisma.task.findUnique({ where: { id } });
const tags = JSON.parse(task.tags || '[]') as string[];
```

### Querying JSON Arrays

```typescript
// SQLite doesn't have native JSON operators
// Use raw SQL for complex queries:

const tasksWithBugTag = await prisma.$queryRaw`
  SELECT * FROM Task WHERE tags LIKE '%"bug"%'
`;
```

### Cascade Deletes

Always specify delete behavior:

```prisma
model Task {
  projectId String
  project   Project @relation(
    fields: [projectId],
    references: [id],
    onDelete: Cascade
  )
}
```

## Database Locations

### Development/Migrations
```
prisma/dev.db
```
- Used by Prisma CLI
- Safe to delete and regenerate
- Tracked in migrations/

### Runtime (Application Data)
```
~/Library/Application Support/claude-tasks-desktop/claude-tasks.db  (macOS)
%APPDATA%\claude-tasks-desktop\claude-tasks.db                      (Windows)
~/.config/claude-tasks-desktop/claude-tasks.db                      (Linux)
```
- Created on first app launch
- User's actual data
- Never delete!

## Schema Best Practices

### Model Template

```prisma
model ModelName {
  // IDs
  id      String  @id @default(cuid())

  // Data fields
  title   String
  content String?
  active  Boolean @default(true)

  // Foreign keys
  userId  String
  parentId String?

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent  ModelName? @relation("hierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children ModelName[] @relation("hierarchy")

  // Indexes
  @@index([userId])
  @@index([parentId])
  @@index([createdAt])
}
```

### Guidelines

- Use `cuid()` for IDs (better sorting than UUID)
- Always include `createdAt` and `updatedAt`
- Define `onDelete: Cascade` explicitly
- Add indexes for frequently queried fields
- Mark optional fields with `?`
- Use meaningful relation names

## Environment & Files

### Key Files
```
prisma/schema.prisma           # Schema definition
prisma/prisma.config.ts        # Configuration (auto-loads DATABASE_URL)
prisma/migrations/             # Migration history
.env                          # Environment variables
.prismarc.json                # Binary target configuration
electron/services/database.ts  # Runtime database service
docs/DATABASE_SETUP.md        # Full documentation
```

### Environment Variables

**Required:**
```env
DATABASE_URL="file:./prisma/dev.db"
```

**Optional:**
```env
NODE_ENV=development      # Enables verbose logging
```

## Troubleshooting

### "DATABASE_URL" is not set
```bash
# Check .env exists:
cat .env | grep DATABASE_URL

# Or set it manually:
export DATABASE_URL="file:./prisma/dev.db"

# Then run Prisma command
npx prisma migrate dev
```

### "Database does not exist"
```bash
# Create and apply migrations:
npx prisma migrate deploy

# Or reset (development only):
npx prisma migrate reset
```

### Prisma Client not generated
```bash
# Regenerate:
npx prisma generate

# Check schema.prisma is valid:
npx prisma validate
```

### Can't find binary for platform
```bash
# Add to .prismarc.json:
{
  "engine": {
    "binaryTargets": ["native", "your-platform-here"]
  }
}

# Then rebuild:
npm install
```

## Useful Documentation

- **Full Setup Guide**: `docs/DATABASE_SETUP.md`
- **Prisma Docs**: https://www.prisma.io/docs
- **SQLite Docs**: https://www.sqlite.org/docs.html
- **Schema Reference**: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference

## Next Steps

1. Read `docs/DATABASE_SETUP.md` for detailed information
2. Use `npx prisma studio` to explore the database
3. Follow schema best practices when adding models
4. Use migrations for all schema changes
5. Test migrations locally before production
