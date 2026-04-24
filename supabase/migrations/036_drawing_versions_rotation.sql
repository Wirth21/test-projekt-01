-- Phase 3: Persistent 90-degree rotation per version.
-- The value is applied in the viewer for every render — so rotating a version
-- once sticks for all future viewers. 0, 90, 180, 270 only; other values are
-- rejected at the API layer. CHECK constraint guards against accidental bad
-- writes.

ALTER TABLE public.drawing_versions
  ADD COLUMN IF NOT EXISTS rotation INTEGER NOT NULL DEFAULT 0
  CONSTRAINT drawing_versions_rotation_valid CHECK (rotation IN (0, 90, 180, 270));
