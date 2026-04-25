import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/require-project-access";
import { createServiceRoleClient } from "@/lib/superadmin";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

const bodySchema = z.object({
  thumbnail_path: z.string().min(1),
});

const MAX_THUMB_BYTES = 1_000_000; // 1 MB — a 800 px JPEG at q=0.8 stays well below this

/**
 * POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/thumbnail
 *
 * Two modes:
 *
 * 1. multipart/form-data with a `file` part — we upload the JPEG to Storage
 *    via the service-role client (no RLS gymnastics) and persist the
 *    canonical path. This is the lazy-repair path used by PdfThumbnail.
 *
 * 2. application/json with `{ thumbnail_path }` — back-compat path for older
 *    clients that already wrote the JPEG to Storage themselves and just need
 *    the DB column flipped.
 *
 * In both cases the version must belong to the authenticated user's project.
 * The accepted thumbnail path is always the canonical sibling of the
 * version's storage_path (`*.pdf` → `*.thumb.jpg`); we never trust a
 * client-supplied path verbatim.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Verify the version belongs to this drawing/project and snapshot its
  // storage_path before any writes.
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select("id, drawing_id, thumbnail_path, storage_path, drawings!inner(project_id)")
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const canonicalThumbPath = version.storage_path.replace(/\.pdf$/i, ".thumb.jpg");
  const contentType = request.headers.get("content-type") ?? "";
  const service = createServiceRoleClient();

  // Mode 1: multipart upload. The client sends the JPEG bytes; we write to
  // Storage with service-role privileges, bypassing the RLS WITH CHECK.
  if (contentType.includes("multipart/form-data")) {
    let file: File | null = null;
    try {
      const form = await request.formData();
      const part = form.get("file");
      if (part instanceof File) file = part;
    } catch {
      return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_THUMB_BYTES) {
      return NextResponse.json({ error: "Ungültige Dateigröße" }, { status: 400 });
    }
    if (!file.type.startsWith("image/jpeg")) {
      return NextResponse.json({ error: "Nur image/jpeg erlaubt" }, { status: 400 });
    }

    const { error: uploadErr } = await service.storage
      .from("drawings")
      .upload(canonicalThumbPath, file, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: "Storage-Upload fehlgeschlagen", detail: uploadErr.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await service
      .from("drawing_versions")
      .update({ thumbnail_path: canonicalThumbPath })
      .eq("id", versionId);
    if (updateError) {
      return NextResponse.json(
        { error: "Thumbnail-Pfad konnte nicht gespeichert werden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, thumbnail_path: canonicalThumbPath });
  }

  // Mode 2: JSON path-only (back-compat). The client already uploaded.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { thumbnail_path } = parsed.data;

  if (thumbnail_path !== canonicalThumbPath) {
    return NextResponse.json(
      { error: "Ungültiger Thumbnail-Pfad" },
      { status: 400 }
    );
  }

  // No-op if already set.
  if (version.thumbnail_path) {
    return NextResponse.json({ ok: true, already_set: true });
  }

  const { error: updateError } = await service
    .from("drawing_versions")
    .update({ thumbnail_path })
    .eq("id", versionId);
  if (updateError) {
    return NextResponse.json(
      { error: "Thumbnail-Pfad konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
