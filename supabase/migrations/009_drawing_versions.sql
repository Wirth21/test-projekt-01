-- ============================================================
-- PROJ-7: drawing_versions table, migrate data from drawings,
--         update markers to reference versions, RLS, indexes
-- Depends on: 003_drawings.sql, 006_markers.sql
-- ============================================================

-- ============================================================
-- 1. Create drawing_versions table
-- ============================================================
CREATE TABLE public.drawing_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  label TEXT NOT NULL CHECK (char_length(trim(label)) >= 1 AND char_length(label) <= 100),
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  page_count INTEGER,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one version_number per drawing
CREATE UNIQUE INDEX idx_drawing_versions_unique_number
  ON public.drawing_versions (drawing_id, version_number);

-- ============================================================
-- 2. Enable Row Level Security
-- ============================================================
ALTER TABLE public.drawing_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies — all project members (via drawings -> projects)
-- ============================================================

-- SELECT: user is a member of the drawing's project
CREATE POLICY "Project members can view drawing versions"
  ON public.drawing_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_versions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

-- INSERT: user is a member of the drawing's project AND created_by = auth.uid()
CREATE POLICY "Project members can insert drawing versions"
  ON public.drawing_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_versions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

-- UPDATE: user is a member of the drawing's project (for rename + archive)
CREATE POLICY "Project members can update drawing versions"
  ON public.drawing_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_versions.drawing_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_versions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

-- DELETE: no policy — archive-only, never delete (consistent with PROJ-6)

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX idx_drawing_versions_drawing_id ON public.drawing_versions(drawing_id);
CREATE INDEX idx_drawing_versions_is_archived ON public.drawing_versions(is_archived);
CREATE INDEX idx_drawing_versions_created_at ON public.drawing_versions(created_at DESC);
CREATE INDEX idx_drawing_versions_created_by ON public.drawing_versions(created_by);

-- Composite: fetch latest active version per drawing (common query)
CREATE INDEX idx_drawing_versions_drawing_active
  ON public.drawing_versions(drawing_id, is_archived, version_number DESC);

-- ============================================================
-- 5. Updated_at trigger (reuses handle_updated_at from 001)
-- ============================================================
CREATE TRIGGER on_drawing_versions_updated
  BEFORE UPDATE ON public.drawing_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. Migrate existing data: each drawing becomes v1
-- ============================================================
INSERT INTO public.drawing_versions (
  drawing_id,
  version_number,
  label,
  storage_path,
  file_size,
  page_count,
  is_archived,
  created_by,
  created_at,
  updated_at
)
SELECT
  d.id,
  1,
  to_char(d.created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
  d.storage_path,
  d.file_size,
  d.page_count,
  false,
  d.uploaded_by,
  d.created_at,
  d.updated_at
FROM public.drawings d
WHERE d.storage_path IS NOT NULL;

-- ============================================================
-- 7. Add drawing_version_id to markers table
-- ============================================================

-- Add nullable column first
ALTER TABLE public.markers
  ADD COLUMN drawing_version_id UUID REFERENCES public.drawing_versions(id) ON DELETE CASCADE;

-- Populate: each marker's drawing_id -> find v1 version
UPDATE public.markers m
SET drawing_version_id = dv.id
FROM public.drawing_versions dv
WHERE dv.drawing_id = m.drawing_id
  AND dv.version_number = 1;

-- Make it NOT NULL after population
ALTER TABLE public.markers
  ALTER COLUMN drawing_version_id SET NOT NULL;

-- Add index for version-based marker queries
CREATE INDEX idx_markers_drawing_version_id ON public.markers(drawing_version_id);

-- Composite index: markers per version per page
CREATE INDEX idx_markers_version_page ON public.markers(drawing_version_id, page_number);

-- ============================================================
-- 8. Update check_markers_same_project to validate version
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_markers_same_project()
RETURNS TRIGGER AS $$
DECLARE
  v_drawing_id UUID;
  v_project_id_source UUID;
  v_project_id_target UUID;
BEGIN
  -- Get the drawing_id from the version
  SELECT dv.drawing_id INTO v_drawing_id
  FROM public.drawing_versions dv
  WHERE dv.id = NEW.drawing_version_id;

  IF v_drawing_id IS NULL THEN
    RAISE EXCEPTION 'Drawing version does not exist';
  END IF;

  -- Ensure drawing_id matches (backwards compatibility)
  IF NEW.drawing_id != v_drawing_id THEN
    RAISE EXCEPTION 'drawing_id does not match drawing_version_id';
  END IF;

  -- Verify source drawing belongs to the marker's project
  SELECT d.project_id INTO v_project_id_source
  FROM public.drawings d
  WHERE d.id = NEW.drawing_id;

  IF v_project_id_source IS NULL OR v_project_id_source != NEW.project_id THEN
    RAISE EXCEPTION 'Source drawing does not belong to the specified project';
  END IF;

  -- Verify target drawing belongs to the marker's project
  SELECT d.project_id INTO v_project_id_target
  FROM public.drawings d
  WHERE d.id = NEW.target_drawing_id;

  IF v_project_id_target IS NULL OR v_project_id_target != NEW.project_id THEN
    RAISE EXCEPTION 'Target drawing does not belong to the specified project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 9. Remove migrated columns from drawings
--    (storage_path, file_size, page_count now live in drawing_versions)
-- ============================================================
ALTER TABLE public.drawings DROP COLUMN IF EXISTS storage_path;
ALTER TABLE public.drawings DROP COLUMN IF EXISTS file_size;
ALTER TABLE public.drawings DROP COLUMN IF EXISTS page_count;
