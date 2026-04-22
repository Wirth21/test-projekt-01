-- Server-side PDF thumbnails (028) are stored next to their source PDFs in
-- the drawings bucket. The bucket was previously locked down to PDFs only;
-- allow JPEG so upload.ts / the backfill script can write previews.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg']
WHERE id = 'drawings';
