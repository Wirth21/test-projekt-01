-- ============================================================
-- PROJ-17: Projektmitgliedschaft & Selbstverwaltung
-- Extends RLS on projects so non-members can read base data
-- of non-archived projects (for "Inactive Projects" tab).
-- Adds self-join RLS policy on project_members.
-- Depends on: 010_multi_tenancy.sql
-- ============================================================

-- ============================================================
-- 1. New SELECT policy on projects: all tenant users can see
--    non-archived projects (base data) for the inactive tab.
--    The existing "Tenant members can view projects" policy
--    remains unchanged — it covers member/admin access.
--    This new policy adds visibility for non-members on
--    non-archived projects within their tenant.
-- ============================================================

CREATE POLICY "Tenant users can view non-archived projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_archived = false
  );

-- ============================================================
-- 2. Helper function to count project members (bypasses RLS).
--    Used by the /api/projects/inactive endpoint so non-members
--    can see how many people are in a project.
-- ============================================================

CREATE OR REPLACE FUNCTION public.project_member_count(p_project_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.project_members
  WHERE project_id = p_project_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. New INSERT policy on project_members: users can self-join
--    projects in their tenant (creates a "member" role entry).
--    Only for non-archived projects.
-- ============================================================

CREATE POLICY "Users can self-join tenant projects"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be adding themselves
    user_id = auth.uid()
    -- Must join as member (not owner)
    AND role = 'member'
    -- Project must be in user's tenant and not archived
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND p.is_archived = false
    )
  );
