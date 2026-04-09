-- SECURITY DEFINER functions for project counts (bypass RLS)
-- Used by dashboard to show correct counts for all tenant projects

CREATE OR REPLACE FUNCTION public.project_drawing_count(p_project_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.drawings
  WHERE project_id = p_project_id AND is_archived = false;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.project_marker_count(p_project_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.markers
  WHERE project_id = p_project_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
