import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

const bodySchema = z.object({
  thumbnail_path: z.string().min(1),
});

// POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/thumbnail
//
// Lazy-repair endpoint: when a client renders a legacy drawing locally via
// PDF.js, it uploads the resulting JPEG to Storage and calls this route to
// persist the path — so the next viewer doesn't have to render the PDF.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

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

  // Verify the version belongs to this drawing/project before updating.
  // We need the version's storage_path to validate the thumbnail path is the
  // canonical sibling — drawings.id and the storage subfolder UUID don't
  // match, since storage paths use a client-generated random UUID.
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select("id, drawing_id, thumbnail_path, storage_path, drawings!inner(project_id)")
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  // IDOR guard: the only thumbnail path we accept is the canonical sibling
  // of the version's storage_path. Prevents a tenant from pointing the
  // thumbnail at someone else's storage object.
  const canonicalThumbPath = version.storage_path.replace(/\.pdf$/i, ".thumb.jpg");
  if (thumbnail_path !== canonicalThumbPath) {
    return NextResponse.json(
      { error: "Ungültiger Thumbnail-Pfad" },
      { status: 400 }
    );
  }

  // No-op if already set — avoids redundant writes and race-condition
  // overwrites when multiple clients repair at once.
  if (version.thumbnail_path) {
    return NextResponse.json({ ok: true, already_set: true });
  }

  const { error: updateError } = await supabase
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
