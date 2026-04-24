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

  const { error } = await supabase.storage
    .from("drawings")
    .upload(path, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.warn("[uploadThumbnail] failed", {
      path,
      blobType: jpeg.type,
      blobSize: jpeg.size,
      message: error.message,
      name: error.name,
    });
    return null;
  }
  return path;
}
