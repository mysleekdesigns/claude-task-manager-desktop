-- ============================================================================
-- Supabase Row Level Security (RLS) Policies
-- Phase 16.5: Security Policies for Multi-tenant Access Control
-- ============================================================================
-- This migration enables RLS on all tables and creates policies to ensure
-- users can only access data they are authorized to see.
--
-- Role Hierarchy: OWNER > ADMIN > MEMBER > VIEWER
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Project Membership Check Function
-- ----------------------------------------------------------------------------
-- Checks if the current authenticated user is a member of a project with
-- at least the specified role level.
--
-- Usage: is_project_member(project_id, 'MEMBER')
-- Returns: TRUE if user has the required role or higher
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, required_role project_role DEFAULT 'VIEWER')
RETURNS BOOLEAN AS $$
DECLARE
  user_role project_role;
BEGIN
  -- Get the user's role in the specified project
  SELECT role INTO user_role
  FROM project_members
  WHERE project_members.project_id = p_project_id
    AND project_members.user_id = auth.uid()
    AND project_members.deleted_at IS NULL;

  -- No membership found
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
  RETURN CASE required_role
    WHEN 'VIEWER' THEN TRUE
    WHEN 'MEMBER' THEN user_role IN ('OWNER', 'ADMIN', 'MEMBER')
    WHEN 'ADMIN' THEN user_role IN ('OWNER', 'ADMIN')
    WHEN 'OWNER' THEN user_role = 'OWNER'
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_project_member(UUID, project_role) IS
  'Checks if authenticated user is a project member with required role or higher';

-- ----------------------------------------------------------------------------
-- 1.2 Get User's Projects Function
-- ----------------------------------------------------------------------------
-- Returns all project IDs where the current user is a member.
-- Useful for efficient IN queries in policies.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_project_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT project_id
  FROM project_members
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_project_ids() IS
  'Returns all project IDs where the authenticated user is a member';

-- ----------------------------------------------------------------------------
-- 1.3 Check Task Assignment Function
-- ----------------------------------------------------------------------------
-- Checks if the current user is assigned to a specific task.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tasks
    WHERE id = p_task_id
      AND assignee_id = auth.uid()
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_task_assignee(UUID) IS
  'Checks if authenticated user is assigned to the specified task';

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. USERS TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 SELECT: Users can view their own profile
-- ----------------------------------------------------------------------------
CREATE POLICY users_select_own
  ON users
  FOR SELECT
  USING (id = auth.uid() AND deleted_at IS NULL);

-- ----------------------------------------------------------------------------
-- 3.2 SELECT: Users can view other members of their projects
-- ----------------------------------------------------------------------------
CREATE POLICY users_select_project_members
  ON users
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND id IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id IN (SELECT get_user_project_ids())
        AND pm.deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- 3.3 INSERT: Users can only be created through auth system
-- ----------------------------------------------------------------------------
-- Note: User creation is handled by Supabase Auth hooks, not direct inserts.
-- This policy allows the auth system to create user records.
CREATE POLICY users_insert_auth
  ON users
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3.4 UPDATE: Users can only update their own profile
-- ----------------------------------------------------------------------------
CREATE POLICY users_update_own
  ON users
  FOR UPDATE
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3.5 DELETE: Users cannot hard delete (use soft delete)
-- ----------------------------------------------------------------------------
-- No DELETE policy - users should be soft deleted via UPDATE

-- ============================================================================
-- 4. PROJECTS TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 SELECT: Users can view projects they are members of
-- ----------------------------------------------------------------------------
CREATE POLICY projects_select_member
  ON projects
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND id IN (SELECT get_user_project_ids())
  );

-- ----------------------------------------------------------------------------
-- 4.2 INSERT: Any authenticated user can create a project
-- ----------------------------------------------------------------------------
-- Note: The creator should be added as OWNER in project_members via trigger
CREATE POLICY projects_insert_authenticated
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 4.3 UPDATE: Only project owners can update project details
-- ----------------------------------------------------------------------------
CREATE POLICY projects_update_owner
  ON projects
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND is_project_member(id, 'OWNER')
  )
  WITH CHECK (is_project_member(id, 'OWNER'));

-- ----------------------------------------------------------------------------
-- 4.4 DELETE: Only owners can delete projects (soft delete recommended)
-- ----------------------------------------------------------------------------
CREATE POLICY projects_delete_owner
  ON projects
  FOR DELETE
  USING (is_project_member(id, 'OWNER'));

-- ============================================================================
-- 5. PROJECT MEMBERS TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 SELECT: Users can view members of projects they belong to
-- ----------------------------------------------------------------------------
CREATE POLICY project_members_select
  ON project_members
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (SELECT get_user_project_ids())
  );

-- ----------------------------------------------------------------------------
-- 5.2 INSERT: Admins and owners can add members
-- ----------------------------------------------------------------------------
CREATE POLICY project_members_insert_admin
  ON project_members
  FOR INSERT
  WITH CHECK (is_project_member(project_id, 'ADMIN'));

-- ----------------------------------------------------------------------------
-- 5.3 UPDATE: Admins can update member roles (except owner)
-- ----------------------------------------------------------------------------
-- Owners can change any role, Admins can change non-owner roles
CREATE POLICY project_members_update_admin
  ON project_members
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND is_project_member(project_id, 'ADMIN')
  )
  WITH CHECK (
    -- Owners can do anything
    is_project_member(project_id, 'OWNER')
    OR (
      -- Admins cannot change owner roles or promote to owner
      is_project_member(project_id, 'ADMIN')
      AND role != 'OWNER'
      AND (SELECT role FROM project_members WHERE id = project_members.id) != 'OWNER'
    )
  );

-- ----------------------------------------------------------------------------
-- 5.4 DELETE: Admins can remove members (not owners)
-- ----------------------------------------------------------------------------
CREATE POLICY project_members_delete_admin
  ON project_members
  FOR DELETE
  USING (
    is_project_member(project_id, 'ADMIN')
    AND (
      -- Owners can remove anyone
      is_project_member(project_id, 'OWNER')
      -- Admins cannot remove other admins or owners
      OR role NOT IN ('OWNER', 'ADMIN')
    )
  );

-- ----------------------------------------------------------------------------
-- 5.5 DELETE: Users can remove themselves from a project
-- ----------------------------------------------------------------------------
CREATE POLICY project_members_delete_self
  ON project_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND role != 'OWNER' -- Owners cannot leave, must transfer ownership first
  );

-- ============================================================================
-- 6. TASKS TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 SELECT: Users can view tasks in projects they are members of
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_select_project_member
  ON tasks
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_project_member(project_id, 'VIEWER')
  );

-- ----------------------------------------------------------------------------
-- 6.2 INSERT: Members can create tasks in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_insert_member
  ON tasks
  FOR INSERT
  WITH CHECK (is_project_member(project_id, 'MEMBER'));

-- ----------------------------------------------------------------------------
-- 6.3 UPDATE: Assignees can update tasks assigned to them
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_update_assignee
  ON tasks
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND assignee_id = auth.uid()
    AND is_project_member(project_id, 'VIEWER')
  )
  WITH CHECK (
    -- Assignee can update task details but cannot change project
    project_id = (SELECT project_id FROM tasks WHERE id = tasks.id)
  );

-- ----------------------------------------------------------------------------
-- 6.4 UPDATE: Admins and owners can update any task in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_update_admin
  ON tasks
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND is_project_member(project_id, 'ADMIN')
  )
  WITH CHECK (is_project_member(project_id, 'ADMIN'));

-- ----------------------------------------------------------------------------
-- 6.5 DELETE: Admins can delete tasks in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_delete_admin
  ON tasks
  FOR DELETE
  USING (is_project_member(project_id, 'ADMIN'));

-- ============================================================================
-- 7. TASK PHASES TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 SELECT: Users can view phases for tasks they can see
-- ----------------------------------------------------------------------------
CREATE POLICY task_phases_select
  ON task_phases
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND task_id IN (
      SELECT id FROM tasks
      WHERE deleted_at IS NULL
        AND is_project_member(project_id, 'VIEWER')
    )
  );

-- ----------------------------------------------------------------------------
-- 7.2 INSERT: Members can create phases for tasks in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY task_phases_insert_member
  ON task_phases
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE deleted_at IS NULL
        AND is_project_member(project_id, 'MEMBER')
    )
  );

-- ----------------------------------------------------------------------------
-- 7.3 UPDATE: Assignees can update phases of their tasks
-- ----------------------------------------------------------------------------
CREATE POLICY task_phases_update_assignee
  ON task_phases
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND task_id IN (
      SELECT id FROM tasks
      WHERE deleted_at IS NULL
        AND assignee_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7.4 UPDATE: Admins can update any phase in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY task_phases_update_admin
  ON task_phases
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND task_id IN (
      SELECT id FROM tasks
      WHERE deleted_at IS NULL
        AND is_project_member(project_id, 'ADMIN')
    )
  );

-- ----------------------------------------------------------------------------
-- 7.5 DELETE: Admins can delete phases in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY task_phases_delete_admin
  ON task_phases
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE is_project_member(project_id, 'ADMIN')
    )
  );

-- ============================================================================
-- 8. MEMORIES TABLE POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8.1 SELECT: Users can view memories in projects they are members of
-- ----------------------------------------------------------------------------
CREATE POLICY memories_select_member
  ON memories
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_project_member(project_id, 'VIEWER')
  );

-- ----------------------------------------------------------------------------
-- 8.2 INSERT: Members can create memories in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY memories_insert_member
  ON memories
  FOR INSERT
  WITH CHECK (is_project_member(project_id, 'MEMBER'));

-- ----------------------------------------------------------------------------
-- 8.3 UPDATE: Members can update memories in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY memories_update_member
  ON memories
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND is_project_member(project_id, 'MEMBER')
  )
  WITH CHECK (is_project_member(project_id, 'MEMBER'));

-- ----------------------------------------------------------------------------
-- 8.4 DELETE: Members can delete memories in their projects
-- ----------------------------------------------------------------------------
CREATE POLICY memories_delete_member
  ON memories
  FOR DELETE
  USING (is_project_member(project_id, 'MEMBER'));

-- ============================================================================
-- 9. PERFORMANCE INDEXES FOR RLS
-- ============================================================================
-- Additional indexes to optimize RLS policy query performance

-- Composite index for project membership lookups (most common RLS check)
CREATE INDEX IF NOT EXISTS idx_project_members_user_project_role
  ON project_members(user_id, project_id, role)
  WHERE deleted_at IS NULL;

-- Index on tasks assignee for assignee-based policies
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_project
  ON tasks(assignee_id, project_id)
  WHERE deleted_at IS NULL;

-- Index on task_phases task_id for cascade lookups
CREATE INDEX IF NOT EXISTS idx_task_phases_task_deleted
  ON task_phases(task_id)
  WHERE deleted_at IS NULL;

-- Index on memories project_id for project-scoped queries
CREATE INDEX IF NOT EXISTS idx_memories_project_deleted
  ON memories(project_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 10. PROJECT CREATION TRIGGER
-- ============================================================================
-- Automatically adds the creator as project OWNER when a project is created

CREATE OR REPLACE FUNCTION add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (user_id, project_id, role)
  VALUES (auth.uid(), NEW.id, 'OWNER');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_project_owner() IS
  'Automatically adds the authenticated user as project owner on project creation';

CREATE TRIGGER trigger_add_project_owner
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_project_owner();

-- ============================================================================
-- RLS POLICIES COMPLETE
-- ============================================================================
-- Summary of access control:
--
-- USERS:
--   - SELECT: Own profile + project collaborators
--   - UPDATE: Own profile only
--   - DELETE: Not allowed (soft delete via UPDATE)
--
-- PROJECTS:
--   - SELECT: Members only (any role)
--   - INSERT: Any authenticated user
--   - UPDATE: Owners only
--   - DELETE: Owners only
--
-- PROJECT_MEMBERS:
--   - SELECT: Project members can see all members
--   - INSERT: Admins+ can add members
--   - UPDATE: Admins+ can change roles (with restrictions)
--   - DELETE: Admins+ can remove members, users can remove selves
--
-- TASKS:
--   - SELECT: Project members (any role)
--   - INSERT: Members+ can create
--   - UPDATE: Assignee OR Admins+
--   - DELETE: Admins+ only
--
-- TASK_PHASES:
--   - SELECT: If can see parent task
--   - INSERT: Members+ in project
--   - UPDATE: Task assignee OR Admins+
--   - DELETE: Admins+ only
--
-- MEMORIES:
--   - SELECT: Project members (any role)
--   - INSERT/UPDATE/DELETE: Members+ in project
-- ============================================================================
