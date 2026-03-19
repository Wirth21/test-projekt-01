-- ============================================================
-- PROJ-3: drawings table, RLS, indexes, storage bucket
-- Depends on: 001_profiles.sql, 002_projects.sql
-- ============================================================

-- 1. Create drawings table
CREATE TABLE public.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 200),
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  page_count INTEGER,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Enable Row Level Security
-- ============================================================
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies
-- ============================================================

-- SELECT: user is a member of the drawing's project
CREATE POLICY "Project members can view drawings"
  ON public.drawings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawings.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- INSERT: user is a member of the project AND uploaded_by = auth.uid()
CREATE POLICY "Project members can insert drawings"
  ON public.drawings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawings.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- UPDATE: user is a member of the project (for rename + archive)
CREATE POLICY "Project members can update drawings"
  ON public.drawings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawings.project_id
        AND project_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawings.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- DELETE: no policy — archive-only, never delete
-- RLS denies DELETE by default when no policy exists

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX idx_drawings_project_id ON public.drawings(project_id);
CREATE INDEX idx_drawings_is_archived ON public.drawings(is_archived);
CREATE INDEX idx_drawings_uploaded_by ON public.drawings(uploaded_by);
CREATE INDEX idx_drawings_created_at ON public.drawings(created_at DESC);

-- ============================================================
-- 5. Updated_at trigger (reuses handle_updated_at from 001)
-- ============================================================
CREATE TRIGGER on_drawings_updated
  BEFORE UPDATE ON public.drawings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. Storage bucket for PDF drawings
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('drawings', 'drawings', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Storage RLS policies
-- ============================================================

-- Allow project members to upload PDFs
CREATE POLICY "Project members can upload drawings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'drawings'
  AND EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
  )
);

-- Allow project members to read PDFs
CREATE POLICY "Project members can read drawings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'drawings'
  AND EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
  )
);
