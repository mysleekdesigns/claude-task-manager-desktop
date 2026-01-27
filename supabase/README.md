# Supabase Setup Guide

This guide covers setting up Supabase for real-time collaboration features in Claude Tasks Desktop.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Applying Migrations](#applying-migrations)
- [Connection Pooling](#connection-pooling)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project" and fill in:
   - **Name:** claude-tasks-desktop (or your preferred name)
   - **Database Password:** Generate a strong password and save it securely
   - **Region:** Choose the closest to your users
3. Wait for your project to be provisioned (usually 1-2 minutes)

### 2. Install Supabase CLI

```bash
# Using npm (recommended)
npm install -g supabase

# Using Homebrew (macOS)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Verify installation:

```bash
supabase --version
```

## Quick Start

### 1. Login to Supabase

```bash
supabase login
```

This opens a browser window for authentication. After logging in, return to your terminal.

### 2. Link to Your Project

```bash
# Navigate to the project root
cd /path/to/claude-task-manager-desktop

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

**Finding your Project Reference:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Project Settings** > **General**
4. Copy the "Reference ID" (e.g., `abcdefghijklmnop`)

### 3. Apply Migrations

```bash
supabase db push
```

This applies all migrations in `supabase/migrations/` to your remote database.

## Applying Migrations

### Method 1: Supabase CLI (Recommended)

The CLI automatically applies migrations in order:

```bash
# Apply all pending migrations to remote database
supabase db push

# View migration status
supabase migration list
```

### Method 2: SQL Editor (Manual)

If you prefer or need to apply migrations manually:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click "New Query"
4. Copy and paste the contents of each migration file in order:
   - First: `supabase/migrations/001_initial_schema.sql`
   - Then: `supabase/migrations/002_row_level_security.sql`
5. Click "Run" for each migration

**Important:** Apply migrations in numerical order to avoid dependency errors.

### Verifying Migrations

After applying migrations, verify the setup:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

## Connection Pooling

Connection pooling is essential for production workloads and serverless environments.

### Configure in Supabase Dashboard

1. Go to **Project Settings** > **Database**
2. Scroll to **Connection Pooling** section
3. Ensure pooling is **enabled**
4. Select **Transaction mode** (recommended for serverless)
5. Note the **Pooled connection string** for your application

### Pool Modes

| Mode | Best For | Description |
|------|----------|-------------|
| **Transaction** | Serverless, high concurrency | Connection returned after each transaction |
| **Session** | Long-running connections | Connection held for entire session |

### Connection Strings

**Direct connection (for migrations):**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**Pooled connection (for application):**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Note the different ports: `5432` (direct) vs `6543` (pooled).

## Local Development

### Start Local Supabase

```bash
# Start all Supabase services locally
supabase start

# This spins up:
# - PostgreSQL database (port 54322)
# - Supabase Studio (port 54323)
# - Auth server (port 54321)
# - And more...
```

### Access Local Services

After starting, you'll see output like:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
```

### Stop Local Services

```bash
supabase stop

# Stop and reset database
supabase stop --no-backup
```

### Reset Local Database

```bash
# Reset to fresh state with migrations applied
supabase db reset
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:

```env
# Your Supabase project URL
SUPABASE_URL=https://your-project-ref.supabase.co

# Your Supabase anonymous (public) key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Finding these values:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Project Settings** > **API**
4. Copy:
   - **Project URL** -> `SUPABASE_URL`
   - **anon public** key -> `SUPABASE_ANON_KEY`

## Troubleshooting

### Migration Fails with "relation already exists"

The migration has already been partially applied. Options:

1. **Safe approach:** Check which objects exist and skip them
2. **Reset approach:** Drop all tables and re-run migrations (data loss!)

```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

### "permission denied" Errors

RLS (Row Level Security) is blocking access. Ensure:

1. User is authenticated
2. User has appropriate project membership
3. Policies are applied correctly

Debug with:

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Temporarily disable RLS for debugging (never in production!)
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

### Connection Timeout

1. Check your network/firewall settings
2. Verify the project is active (not paused)
3. Try the pooled connection instead of direct

### "FATAL: password authentication failed"

1. Verify your database password in Project Settings
2. Regenerate the password if needed
3. Update your connection string

### Local Supabase Won't Start

```bash
# Check Docker is running
docker info

# Clean up and restart
supabase stop --no-backup
docker system prune -f
supabase start
```

### Generate TypeScript Types (Optional)

Generate types from your database schema for better type safety:

```bash
# Generate types from remote database
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/supabase.ts

# Generate types from local database
supabase gen types typescript --local > src/types/supabase.ts
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)
