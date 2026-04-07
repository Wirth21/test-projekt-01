-- Users and Viewers see all tenant projects.
-- Guests see only assigned projects.
DROP POLICY IF EXISTS "Members or viewers can view projects" ON public.projects;

CREATE POLICY "Tenant users can view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    -- Guest: only assigned projects
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.tenant_role = 'guest'
          AND profiles.tenant_id = projects.tenant_id
      )
      AND user_is_project_member(id)
    )
    OR
    -- User/Viewer/Admin: all tenant projects
    (
      tenant_id = current_tenant_id()
      AND NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.tenant_role = 'guest'
      )
    )
  );
