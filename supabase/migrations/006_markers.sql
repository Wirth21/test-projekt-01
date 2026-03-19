-- ============================================================
-- PROJ-4: markers table, RLS, indexes
-- Depends on: 002_projects.sql, 003_drawings.sql
-- ============================================================

-- 1. Create markers table
CREATE TABLE public.markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  target_drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  x_percent DOUBLE PRECISION NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent DOUBLE PRECISION NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Enable Row Level Security
-- ============================================================
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies — all project members can CRUD markers
-- ============================================================

-- SELECT: user is a member of the marker's project
CREATE POLICY "Project members can view markers"
  ON public.markers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = markers.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- INSERT: user is a member of the project AND created_by = auth.uid()
CREATE POLICY "Project members can create markers"
  ON public.markers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = markers.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- UPDATE: any project member can update any marker in their project
CREATE POLICY "Project members can update markers"
  ON public.markers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = markers.project_id
        AND project_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = markers.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- DELETE: any project member can delete any marker in their project
CREATE POLICY "Project members can delete markers"
  ON public.markers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = markers.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Primary query: fetch all markers for a drawing
CREATE INDEX idx_markers_drawing_id ON public.markers(drawing_id);

-- Lookup by target drawing (e.g. checking if a drawing is referenced)
CREATE INDEX idx_markers_target_drawing_id ON public.markers(target_drawing_id);

-- Project-level queries and RLS joins
CREATE INDEX idx_markers_project_id ON public.markers(project_id);

-- Composite index: markers per drawing per page (common query pattern)
CREATE INDEX idx_markers_drawing_page ON public.markers(drawing_id, page_number);

-- ============================================================
-- 5. Updated_at trigger (reuses handle_updated_at from 001)
-- ============================================================
CREATE TRIGGER on_markers_updated
  BEFORE UPDATE ON public.markers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. Constraint: prevent markers pointing to own drawing
-- ============================================================
ALTER TABLE public.markers
  ADD CONSTRAINT markers_no_self_reference
  CHECK (drawing_id != target_drawing_id);

-- ============================================================
-- 7. Constraint: both drawings must belong to the same project
--    (enforced at API level + DB function for safety)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_markers_same_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify both drawings belong to the marker's project
  IF NOT EXISTS (
    SELECT 1 FROM public.drawings
    WHERE id = NEW.drawing_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Source drawing does not belong to the specified project';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drawings
    WHERE id = NEW.target_drawing_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Target drawing does not belong to the specified project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_markers_same_project_trigger
  BEFORE INSERT OR UPDATE ON public.markers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_markers_same_project();
