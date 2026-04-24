"use client";

import { createClient } from "@/lib/supabase";

/**
 * Derive the canonical thumbnail storage path from a PDF storage path.
 * e.g. "proj/drawing/1.pdf" -> "proj/drawing/1.thumb.jpg"
 */
export function thumbnailPathFor(pdfStoragePath: string): string {
  return pdfStoragePath.replace(/\.pdf$/i, ".thumb.jpg");
}

/**
 * Upload a JPEG blob to the drawings bucket. Returns the storage path on
 * success, or null if upload failed (caller treats that as a soft failure —
 * viewers will fall back to client-side PDF rendering).
 */
export async function uploadThumbnail(
  pdfStoragePath: string,
  jpeg: Blob
): Promise<string | null> {
  const path = thumbnailPathFor(pdfStoragePath);
  const supabase = createClient();

  // Try create (POST + x-upsert). Supabase JS SDK versions occasionally
  // surface 400 on upsert even when Storage did write the object. If the
  // first call returns an error, fall back to .update() which is a PUT and
  // always overwrites — between the two we cover "file does not exist" and
  // "file already exists" without giving up on the repair.
  const { error: uploadErr } = await supabase.storage
    .from("drawings")
    .upload(path, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (!uploadErr) return path;

  console.warn("[uploadThumbnail] upload error, falling back to update()", {
    path,
    blobType: jpeg.type,
    blobSize: jpeg.size,
    message: uploadErr.message,
    name: uploadErr.name,
  });

  const { error: updateErr } = await supabase.storage
    .from("drawings")
    .update(path, jpeg, { contentType: "image/jpeg" });

  if (updateErr) {
    console.warn("[uploadThumbnail] update also failed", {
      path,
      message: updateErr.message,
      name: updateErr.name,
    });
    return null;
  }
  return path;
}
