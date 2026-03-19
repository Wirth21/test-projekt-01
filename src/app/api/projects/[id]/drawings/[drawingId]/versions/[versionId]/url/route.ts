import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

// GET /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/url — signed URL for a version's PDF
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;
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

  // Fetch the version with its drawing to verify project ownership
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select(`
      id,
      storage_path,
      drawing_id,
      drawings!inner ( project_id )
    `)
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const drawingData = version.drawings as unknown as { project_id: string };
  if (drawingData.project_id !== projectId) {
    return NextResponse.json({ error: "Version gehört nicht zu diesem Projekt" }, { status: 403 });
  }

  // Generate signed URL (1 hour = 3600 seconds)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from("drawings")
    .createSignedUrl(version.storage_path, 3600);

  if (urlError || !signedUrlData) {
    return NextResponse.json({ error: "URL konnte nicht generiert werden" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrlData.signedUrl });
}
