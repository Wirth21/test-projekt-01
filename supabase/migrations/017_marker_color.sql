-- ============================================================
-- Add color column to markers table
-- ============================================================

ALTER TABLE public.markers
  ADD COLUMN color TEXT NOT NULL DEFAULT 'blue'
  CHECK (color IN ('blue', 'red', 'green', 'orange', 'purple'));
