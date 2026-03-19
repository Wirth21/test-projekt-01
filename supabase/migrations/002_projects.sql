-- ============================================================
-- PROJ-2: projects + project_members tables, RLS, indexes
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- Depends on: 001_profiles.sql
-- ============================================================

-- 1. Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create project_members join table
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- ============================================================
-- 3. Enable Row Level Security
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies for projects
-- ============================================================

-- SELECT: Users can only see projects they are a member of
CREATE POLICY "Members can view their projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create a project
CREATE POLICY "Authenticated users can create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: Only project owner can update project details
CREATE POLICY "Project owner can update project"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.role = 'owner'
    )
  );

-- DELETE: No delete policy — archiving only (PROJ-6)
-- RLS denies DELETE by default when no policy exists

-- ============================================================
-- 5. RLS Policies for project_members
-- ============================================================

-- SELECT: Members can see other members of their projects
CREATE POLICY "Members can view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- INSERT: Only project owner can add new members
-- Special case: the project creator inserts themselves as owner during project creation
CREATE POLICY "Owner can add members or creator can self-add"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Case 1: Creator adding themselves as owner on a project they created
    (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_members.project_id
          AND projects.created_by = auth.uid()
      )
    )
    OR
    -- Case 2: Existing owner inviting another user as member
    (
      role = 'member'
      AND EXISTS (
        SELECT 1 FROM public.project_members AS pm
        WHERE pm.project_id = project_members.project_id
          AND pm.user_id = auth.uid()
          AND pm.role = 'owner'
      )
    )
  );

-- UPDATE: No role changes via API for now
-- No UPDATE policy = denied by default

-- DELETE: Owner can remove members; members can remove themselves
CREATE POLICY "Owner can remove members or self-remove"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    -- Self-remove (leave project)
    user_id = auth.uid()
    OR
    -- Owner removes a member
    EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
  );

-- ============================================================
-- 6. Indexes
-- ============================================================

-- projects: filter by archive status, order by updated_at
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_is_archived ON public.projects(is_archived);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);

-- project_members: fast lookup by user and project
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_role ON public.project_members(role);

-- ============================================================
-- 7. Updated_at trigger (reuses handle_updated_at from 001)
-- ============================================================

CREATE TRIGGER on_projects_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
