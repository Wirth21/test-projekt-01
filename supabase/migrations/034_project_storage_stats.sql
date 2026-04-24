-- ============================================================
-- PROJ-25: project_storage_stats helper (BUG-8 fix)
--
-- Replaces a client-side `.limit(100_000)` aggregation in the
-- delete API with a server-side SUM over drawing_versions. That
-- way the audit metadata is accurate even for projects with more
-- than 100k versions (unlikely in practice, but the old code
-- silently truncated).
--
-- Returns a single row: (drawings, versions, members, groups, storage_bytes).
-- Scoped to a single project_id; service-role only.
--
-- Depends on: 002_projects.sql, 003_drawings.sql, 004_drawing_versions.sql,
--             017_project_members.sql, 019_drawing_groups.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.project_storage_stats(
  p_project_id UUID
)
RETURNS TABLE (
  drawings_count  INTEGER,
  versions_count  INTEGER,
  members_count   INTEGER,
  groups_count    INTEGER,
  storage_bytes   BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.drawings WHERE project_id = p_project_id) AS drawings_count,
    (SELECT COUNT(*)::int FROM public.drawing_versions dv
        JOIN public.drawings d ON d.id = dv.drawing_id
        WHERE d.project_id = p_project_id) AS versions_count,
    (SELECT COUNT(*)::int FROM public.project_members WHERE project_id = p_project_id) AS members_count,
    (SELECT COUNT(*)::int FROM public.drawing_groups WHERE project_id = p_project_id) AS groups_count,
    (SELECT COALESCE(SUM(dv.file_size), 0)::bigint FROM public.drawing_versions dv
        JOIN public.drawings d ON d.id = dv.drawing_id
        WHERE d.project_id = p_project_id) AS storage_bytes;
$$;

REVOKE ALL ON FUNCTION public.project_storage_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_storage_stats(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.project_storage_stats(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.project_storage_stats(UUID) TO service_role;
