-- Performance: batched variant of project_stats().
-- The dashboard hook previously called project_stats() once PER project
-- (N+1: Promise.all over every project id). On accounts with many projects
-- this fans out into dozens of RPC round-trips on every dashboard load and
-- every ['projects'] invalidation — heavy on the Supabase Free disk-IO budget
-- (the original 504 timeouts that 025 already tried to mitigate).
--
-- This function returns all three counts for a whole set of project ids in a
-- single round-trip. Same SECURITY DEFINER semantics as project_stats() — no
-- new exposure: project_stats(UUID) already lets any authenticated user fetch
-- counts for any project id; this is the set-based equivalent.

CREATE OR REPLACE FUNCTION public.project_stats_batch(p_project_ids uuid[])
RETURNS TABLE (
  project_id    uuid,
  drawing_count integer,
  marker_count  integer,
  member_count  integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    p.id AS project_id,
    COALESCE(d.cnt, 0)::integer  AS drawing_count,
    COALESCE(m.cnt, 0)::integer  AS marker_count,
    COALESCE(pm.cnt, 0)::integer AS member_count
  FROM unnest(p_project_ids) AS p(id)
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.drawings
    WHERE is_archived = false AND project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) d ON d.project_id = p.id
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.markers
    WHERE project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) m ON m.project_id = p.id
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.project_members
    WHERE project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) pm ON pm.project_id = p.id;
$$;

GRANT EXECUTE ON FUNCTION public.project_stats_batch(uuid[]) TO authenticated;
