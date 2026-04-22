-- Performance: add covering indexes for foreign keys flagged by the Supabase
-- advisor. Low-traffic paths, but cheap to fix.

CREATE INDEX IF NOT EXISTS idx_drawing_groups_created_by
  ON public.drawing_groups (created_by);

CREATE INDEX IF NOT EXISTS idx_markers_created_by
  ON public.markers (created_by);
