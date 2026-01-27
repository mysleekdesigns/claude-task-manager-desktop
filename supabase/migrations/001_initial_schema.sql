-- ============================================================================
-- Supabase PostgreSQL Schema for Claude Tasks Desktop
-- Phase 16.4: Initial Schema Migration
-- ============================================================================
-- This schema mirrors the local SQLite Prisma schema for cloud synchronization.
-- Key differences from SQLite:
--   - UUID for IDs instead of cuid
--   - TIMESTAMPTZ for datetime fields
--   - JSONB for arrays and JSON fields
--   - PostgreSQL ENUM types for status fields
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

-- pgcrypto provides gen_random_uuid() for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

-- Project member roles
CREATE TYPE project_role AS ENUM (
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER'
);

-- Task workflow status
CREATE TYPE task_status AS ENUM (
  'PENDING',
  'PLANNING',
  'IN_PROGRESS',
  'AI_REVIEW',
  'HUMAN_REVIEW',
  'COMPLETED',
  'CANCELLED'
);

-- Task priority levels
CREATE TYPE priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- Claude Code session status
CREATE TYPE claude_task_status AS ENUM (
  'IDLE',
  'STARTING',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'AWAITING_INPUT'
);

-- Task phase status
CREATE TYPE phase_status AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED'
);

-- Memory types
CREATE TYPE memory_type AS ENUM (
  'session',
  'pr_review',
  'codebase',
  'pattern',
  'gotcha'
);

-- ============================================================================
-- 3. TABLES
-- ============================================================================
-- Tables are created in dependency order (referenced tables first)

-- ----------------------------------------------------------------------------
-- 3.1 Users Table
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'User accounts for the application';
COMMENT ON COLUMN users.sync_version IS 'Optimistic locking version for sync conflict resolution';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - NULL means active';

-- ----------------------------------------------------------------------------
-- 3.2 Projects Table
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_path TEXT,
  github_repo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE projects IS 'Development projects managed by the application';
COMMENT ON COLUMN projects.target_path IS 'Local filesystem path to the project directory';
COMMENT ON COLUMN projects.github_repo IS 'GitHub repository URL or owner/repo format';

-- ----------------------------------------------------------------------------
-- 3.3 Project Members Table
-- ----------------------------------------------------------------------------
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role project_role NOT NULL DEFAULT 'MEMBER',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,

  -- Unique constraint: one membership per user per project
  CONSTRAINT project_members_user_project_unique UNIQUE (user_id, project_id)
);

COMMENT ON TABLE project_members IS 'User membership and roles within projects';
COMMENT ON COLUMN project_members.role IS 'User role: OWNER, ADMIN, MEMBER, or VIEWER';

-- ----------------------------------------------------------------------------
-- 3.4 Tasks Table
-- ----------------------------------------------------------------------------
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  branch_name TEXT,
  status task_status NOT NULL DEFAULT 'PLANNING',
  priority priority NOT NULL DEFAULT 'MEDIUM',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

  -- Claude Code integration fields
  claude_session_id UUID,
  claude_session_name TEXT,
  claude_terminal_id TEXT,
  claude_started_at TIMESTAMPTZ,
  claude_completed_at TIMESTAMPTZ,
  claude_status claude_task_status NOT NULL DEFAULT 'IDLE',

  -- PRD phase scoping
  prd_phase_number INTEGER,
  prd_phase_name TEXT,
  scoped_prd_content TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE tasks IS 'Development tasks with Claude Code integration';
COMMENT ON COLUMN tasks.tags IS 'JSONB array of tag strings';
COMMENT ON COLUMN tasks.claude_session_id IS 'UUID for Claude Code terminal session';
COMMENT ON COLUMN tasks.claude_status IS 'Current Claude Code processing status';
COMMENT ON COLUMN tasks.prd_phase_number IS 'PRD phase number this task is scoped to';
COMMENT ON COLUMN tasks.scoped_prd_content IS 'Extracted PRD phase content sent to Claude';

-- ----------------------------------------------------------------------------
-- 3.5 Task Phases Table
-- ----------------------------------------------------------------------------
CREATE TABLE task_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status phase_status NOT NULL DEFAULT 'PENDING',
  model TEXT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE task_phases IS 'Execution phases within a task';
COMMENT ON COLUMN task_phases.model IS 'AI model used for this phase (e.g., claude-3-5-sonnet)';
COMMENT ON COLUMN task_phases.status IS 'Phase execution status';

-- ----------------------------------------------------------------------------
-- 3.6 Memories Table
-- ----------------------------------------------------------------------------
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type memory_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE memories IS 'Project knowledge and context memories';
COMMENT ON COLUMN memories.type IS 'Memory category: session, pr_review, codebase, pattern, gotcha';
COMMENT ON COLUMN memories.metadata IS 'Additional structured metadata as JSONB';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
-- Indexes match the Prisma @@index annotations for query optimization

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Projects indexes
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;

-- Project members indexes
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_deleted_at ON project_members(deleted_at) WHERE deleted_at IS NOT NULL;

-- Tasks indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_claude_status ON tasks(claude_status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- Task phases indexes
CREATE INDEX idx_task_phases_task_id ON task_phases(task_id);
CREATE INDEX idx_task_phases_status ON task_phases(status);
CREATE INDEX idx_task_phases_created_at ON task_phases(created_at);
CREATE INDEX idx_task_phases_deleted_at ON task_phases(deleted_at) WHERE deleted_at IS NOT NULL;

-- Memories indexes
CREATE INDEX idx_memories_project_id ON memories(project_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_created_at ON memories(created_at);
CREATE INDEX idx_memories_deleted_at ON memories(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Auto-update updated_at Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at column on row modification';

-- ----------------------------------------------------------------------------
-- 5.2 Apply Trigger to All Tables
-- ----------------------------------------------------------------------------

-- Users
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Projects
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Project Members
CREATE TRIGGER trigger_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tasks
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Task Phases
CREATE TRIGGER trigger_task_phases_updated_at
  BEFORE UPDATE ON task_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Memories
CREATE TRIGGER trigger_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ADDITIONAL HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Soft Delete Helper Function
-- ----------------------------------------------------------------------------
-- Use: SELECT soft_delete('tasks', 'uuid-here');
CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW(), sync_version = sync_version + 1 WHERE id = %L', table_name, record_id);
END;
$$ LANGUAGE 'plpgsql';

COMMENT ON FUNCTION soft_delete(TEXT, UUID) IS 'Soft deletes a record by setting deleted_at timestamp';

-- ----------------------------------------------------------------------------
-- 6.2 Increment Sync Version Helper
-- ----------------------------------------------------------------------------
-- Automatically increment sync_version on update
CREATE OR REPLACE FUNCTION increment_sync_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sync_version = OLD.sync_version + 1;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

COMMENT ON FUNCTION increment_sync_version() IS 'Increments sync_version for optimistic locking';

-- Apply sync version trigger to all tables
CREATE TRIGGER trigger_users_sync_version
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

CREATE TRIGGER trigger_projects_sync_version
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

CREATE TRIGGER trigger_project_members_sync_version
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

CREATE TRIGGER trigger_tasks_sync_version
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

CREATE TRIGGER trigger_task_phases_sync_version
  BEFORE UPDATE ON task_phases
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

CREATE TRIGGER trigger_memories_sync_version
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION increment_sync_version();

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- Next steps:
--   1. Apply Row Level Security (RLS) policies (see 002_row_level_security.sql)
--   2. Set up Supabase Realtime subscriptions
--   3. Configure sync service in the Electron app
-- ============================================================================
