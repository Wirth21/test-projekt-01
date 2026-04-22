-- Performance: add composite index for active-drawings count,
-- and consolidate three per-project count RPCs into a single round-trip.
-- Motivation: dashboard load timed out (504) after heavy uploads because
-- the hook made 3 RPC calls per project.

-- 1. Composite index for project_drawing_count() predicate
CREATE INDEX IF NOT EXISTS idx_drawings_project_archived
  ON public.drawings (project_id, is_archived);

-- 2. Combined stats function: one RPC returns all three counts as JSON
CREATE OR REPLACE FUNCTION public.project_stats(p_project_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'drawing_count', (
      SELECT COUNT(*)::INTEGER FROM public.drawings
      WHERE project_id = p_project_id AND is_archived = false
    ),
    'marker_count', (
      SELECT COUNT(*)::INTEGER FROM public.markers
      WHERE project_id = p_project_id
    ),
    'member_count', (
      SELECT COUNT(*)::INTEGER FROM public.project_members
      WHERE project_id = p_project_id
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.project_stats(UUID) TO authenticated;
