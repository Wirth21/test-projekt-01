-- Phase 2: Add sort_order to drawing_versions for user-controlled reordering.
-- version_number stays stable (serial, immutable); sort_order is editable and
-- controls the display order in the Version panel. Default = version_number
-- so existing rows behave the same as before.

ALTER TABLE public.drawing_versions
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE public.drawing_versions
SET sort_order = version_number
WHERE sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_drawing_versions_drawing_sort
  ON public.drawing_versions (drawing_id, sort_order DESC);
