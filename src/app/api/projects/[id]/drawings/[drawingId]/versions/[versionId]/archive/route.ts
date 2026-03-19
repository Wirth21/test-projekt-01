import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

// POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/archive — archive a version
export async function POST(_request: Request, { params }: RouteParams) {
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

  // Verify version belongs to this drawing and drawing belongs to this project
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select(`
      id,
      drawing_id,
      is_archived,
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

  if (version.is_archived) {
    return NextResponse.json({ error: "Version ist bereits archiviert" }, { status: 400 });
  }

  // Check: cannot archive the last remaining active version
  const { count, error: countError } = await supabase
    .from("drawing_versions")
    .select("id", { count: "exact", head: true })
    .eq("drawing_id", drawingId)
    .eq("is_archived", false);

  if (countError) {
    return NextResponse.json({ error: "Versionsanzahl konnte nicht geprüft werden" }, { status: 500 });
  }

  if (count !== null && count <= 1) {
    return NextResponse.json(
      { error: "Die einzige verbleibende aktive Version kann nicht archiviert werden." },
      { status: 400 }
    );
  }

  // Archive the version
  const { data: archivedVersion, error: updateError } = await supabase
    .from("drawing_versions")
    .update({ is_archived: true })
    .eq("id", versionId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Version konnte nicht archiviert werden" }, { status: 500 });
  }

  return NextResponse.json({ version: archivedVersion });
}
