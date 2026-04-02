-- ============================================================
-- Add tenant_role to profiles: 'user' | 'viewer' | 'guest'
-- user   = full access (default, existing behavior)
-- viewer = read-only access to ALL projects in tenant
-- guest  = read-only access to ASSIGNED projects only
-- ============================================================

-- 1. Add tenant_role column
ALTER TABLE public.profiles
  ADD COLUMN tenant_role TEXT NOT NULL DEFAULT 'user'
  CHECK (tenant_role IN ('user', 'viewer', 'guest'));

-- 2. Update projects SELECT policy: viewers can see all tenant projects
-- Uses user_is_project_member() (SECURITY DEFINER) to avoid infinite recursion
DROP POLICY IF EXISTS "Members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Tenant members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Tenant users can view non-archived projects" ON public.projects;

CREATE POLICY "Members or viewers can view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    user_is_project_member(id)
    OR is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.tenant_role = 'viewer'
          AND profiles.tenant_id = projects.tenant_id
      )
    )
  );

-- 3. Update project_members SELECT policy: viewers can see members of all tenant projects
-- Uses user_is_project_member() (SECURITY DEFINER) to avoid infinite recursion
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Tenant members can view project members" ON public.project_members;

CREATE POLICY "Tenant members or viewers can view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    user_is_project_member(project_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.tenant_role = 'viewer'
          AND profiles.tenant_id = (
            SELECT p.tenant_id FROM public.projects p
            WHERE p.id = project_members.project_id
          )
      )
    )
  );

-- 4. Prevent viewers/guests from creating projects
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Tenant users can create projects" ON public.projects;

CREATE POLICY "Users can create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tenant_role = 'user'
    )
  );

-- 5. Index
CREATE INDEX idx_profiles_tenant_role ON public.profiles(tenant_role);
