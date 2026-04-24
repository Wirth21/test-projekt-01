-- ============================================================
-- PROJ-25: admin_hard_delete_project v2 (BUG-9 + BUG-7 fix)
--
-- v1 wrote the audit row from the API layer BEFORE calling the
-- RPC. That made the audit insert and the DB delete two separate
-- transactions: if the RPC failed after the audit commit, the
-- audit log was left saying "deleted" while the project still
-- existed (BUG-9). Re-tries also inserted duplicate audit rows
-- for the same target_id (BUG-7).
--
-- v2 moves the audit insert INSIDE the RPC, in the same
-- transaction as the DELETE. Audit is only inserted when the
-- DELETE actually removed a row (ROW_COUNT > 0). Retries on an
-- already-deleted project return 0 and do not duplicate.
--
-- Depends on: 002_projects.sql, 007_security_fixes.sql,
--             031_tenant_activity_log.sql
-- ============================================================

-- Drop the old 2-arg version so nothing can call it by accident.
DROP FUNCTION IF EXISTS public.admin_hard_delete_project(UUID);

CREATE OR REPLACE FUNCTION public.admin_hard_delete_project(
  p_project_id UUID,
  p_tenant_id  UUID,
  p_user_id    UUID,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Disable owner-protection triggers so CASCADE from projects
  -- through project_members does not raise.
  ALTER TABLE public.project_members DISABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE public.project_members DISABLE TRIGGER prevent_owner_leave_trigger;

  BEGIN
    -- Defence-in-depth: tenant filter in the DELETE itself.
    -- The API route already checks this, but a mismatched
    -- (project_id, tenant_id) pair must NEVER delete.
    DELETE FROM public.projects
    WHERE id = p_project_id
      AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    -- Re-enable protections before propagating the error.
    ALTER TABLE public.project_members ENABLE TRIGGER check_last_owner_before_delete;
    ALTER TABLE public.project_members ENABLE TRIGGER prevent_owner_leave_trigger;
    RAISE;
  END;

  -- Happy path: re-enable protections.
  ALTER TABLE public.project_members ENABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE public.project_members ENABLE TRIGGER prevent_owner_leave_trigger;

  -- Only record an audit row when a project was actually deleted.
  -- A retry on an already-deleted target deletes 0 rows and must
  -- not create a second audit entry.
  IF v_deleted_count > 0 THEN
    INSERT INTO public.tenant_activity_log (
      tenant_id,
      user_id,
      action_type,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      p_tenant_id,
      p_user_id,
      'project.deleted',
      'project',
      p_project_id,
      COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID, UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID, UUID, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.admin_hard_delete_project(UUID, UUID, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_project(UUID, UUID, UUID, JSONB) TO service_role;
