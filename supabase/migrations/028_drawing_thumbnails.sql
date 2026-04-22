-- Server-side PDF thumbnails: store a pointer to a JPEG preview per version.
-- Generated client-side at upload time, so first-time viewers don't have to
-- render the full PDF just to see a preview.

ALTER TABLE public.drawing_versions
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
