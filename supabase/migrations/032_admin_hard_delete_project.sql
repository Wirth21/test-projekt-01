-- ============================================================
-- PROJ-25: admin_hard_delete_project RPC
--
-- Deletes a project row and lets ON DELETE CASCADE clean up
-- drawings, drawing_versions, markers, drawing_groups,
-- project_members and activity_log rows in a single atomic
-- transaction.
--
-- Two trigger-based protections on `project_members` block
-- owner removal under normal operations (see migration 007):
--   - `check_last_owner_before_delete`  -> prevent_last_owner_removal()
--   - `prevent_owner_leave_trigger`     -> prevent_owner_leave()
--
-- Both must be disabled for the duration of the delete and
-- re-enabled afterwards — even when the DELETE fails — so
-- that a partial failure never leaves the triggers in a
-- disabled state.
--
-- Callable only with the service-role key (SECURITY DEFINER
-- runs as owner, but we revoke EXECUTE from anon/authenticated
-- so no client session can invoke it — all auth/tenant checks
-- live in the API route).
--
-- Depends on: 002_projects.sql, 007_security_fixes.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_hard_delete_project(
  p_project_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Disable owner-protection triggers so CASCADE from projects
  -- through project_members does not raise.
  ALTER TABLE public.project_members DISABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE public.project_members DISABLE TRIGGER prevent_owner_leave_trigger;

  BEGIN
    DELETE FROM public.projects WHERE id = p_project_id;
  EXCEPTION WHEN OTHERS THEN
    -- Re-enable protections before propagating the error.
    ALTER TABLE public.project_members ENABLE TRIGGER check_last_owner_before_delete;
    ALTER TABLE public.project_members ENABLE TRIGGER prevent_owner_leave_trigger;
    RAISE;
  END;

  -- Happy path: re-enable protections.
  ALTER TABLE public.project_members ENABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE public.project_members ENABLE TRIGGER prevent_owner_leave_trigger;
END;
$$;

-- Lock down EXECUTE: only service role (and the owner) may call this.
REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_project(UUID) TO service_role;
