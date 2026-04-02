-- ============================================================
-- Add UPDATE policy on project_members for owner-initiated role changes
-- ============================================================

CREATE POLICY "Owner can update member roles"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
  );
