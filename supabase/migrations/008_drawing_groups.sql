-- ============================================================
-- PROJ-8: drawing_groups table + group_id on drawings
-- Depends on: 003_drawings.sql (drawings table)
-- ============================================================

-- 1. Create drawing_groups table
CREATE TABLE public.drawing_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: no duplicate active group names per project
CREATE UNIQUE INDEX idx_drawing_groups_unique_name
  ON public.drawing_groups (project_id, lower(trim(name)))
  WHERE is_archived = false;

-- ============================================================
-- 2. Enable Row Level Security
-- ============================================================
ALTER TABLE public.drawing_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies — all project members (owner + member)
-- ============================================================

-- SELECT: project members can view groups
CREATE POLICY "Project members can view drawing groups"
  ON public.drawing_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawing_groups.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- INSERT: project members can create groups (created_by must be own user)
CREATE POLICY "Project members can create drawing groups"
  ON public.drawing_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawing_groups.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- UPDATE: project members can update groups (rename, archive)
CREATE POLICY "Project members can update drawing groups"
  ON public.drawing_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawing_groups.project_id
        AND project_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = drawing_groups.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- DELETE: no policy — archive-only, never delete (consistent with PROJ-6)

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX idx_drawing_groups_project_id ON public.drawing_groups(project_id);
CREATE INDEX idx_drawing_groups_is_archived ON public.drawing_groups(is_archived);
CREATE INDEX idx_drawing_groups_created_at ON public.drawing_groups(created_at);

-- ============================================================
-- 5. Updated_at trigger (reuses handle_updated_at from 001)
-- ============================================================
CREATE TRIGGER on_drawing_groups_updated
  BEFORE UPDATE ON public.drawing_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. Add group_id column to drawings table
-- ============================================================
ALTER TABLE public.drawings
  ADD COLUMN group_id UUID REFERENCES public.drawing_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_drawings_group_id ON public.drawings(group_id);
