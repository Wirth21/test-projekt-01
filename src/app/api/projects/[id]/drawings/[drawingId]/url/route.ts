import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// GET /api/projects/[id]/drawings/[drawingId]/url — generate signed URL for latest active version
// Backwards-compatible endpoint: resolves latest version automatically
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Verify user is a project member
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: "Fehler bei der Berechtigungsprüfung" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt" }, { status: 403 });
  }

  // Verify drawing belongs to this project
  const { data: drawing, error: drawingError } = await supabase
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (drawingError || !drawing) {
    return NextResponse.json({ error: "Zeichnung nicht gefunden" }, { status: 404 });
  }

  // Get the latest non-archived version
  const { data: latestVersion, error: versionError } = await supabase
    .from("drawing_versions")
    .select("id, storage_path")
    .eq("drawing_id", drawingId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !latestVersion) {
    return NextResponse.json({ error: "Keine aktive Version gefunden" }, { status: 404 });
  }

  // Generate signed URL (1 hour = 3600 seconds)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from("drawings")
    .createSignedUrl(latestVersion.storage_path, 3600);

  if (urlError || !signedUrlData) {
    return NextResponse.json({ error: "URL konnte nicht generiert werden" }, { status: 500 });
  }

  return NextResponse.json({
    url: signedUrlData.signedUrl,
    version_id: latestVersion.id,
  });
}
