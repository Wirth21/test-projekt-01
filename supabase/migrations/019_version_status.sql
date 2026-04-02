-- ============================================================
-- Move status_id from drawings to drawing_versions
-- Each version gets its own independent status.
-- ============================================================

-- 1. Add status_id column to drawing_versions
ALTER TABLE public.drawing_versions
  ADD COLUMN status_id UUID REFERENCES public.drawing_statuses(id) ON DELETE SET NULL;

-- 2. Migrate existing statuses: copy drawing's status_id to all its versions
UPDATE public.drawing_versions dv
SET status_id = d.status_id
FROM public.drawings d
WHERE dv.drawing_id = d.id
  AND d.status_id IS NOT NULL;

-- 3. Remove status_id from drawings
ALTER TABLE public.drawings DROP COLUMN status_id;

-- 4. Index for version status lookups
CREATE INDEX idx_drawing_versions_status_id ON public.drawing_versions(status_id);

-- 5. Drop old index on drawings.status_id (created in 018)
DROP INDEX IF EXISTS idx_drawings_status_id;
