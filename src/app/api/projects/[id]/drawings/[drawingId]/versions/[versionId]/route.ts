import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { renameVersionSchema } from "@/lib/validations/version";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

// PATCH /api/projects/[id]/drawings/[drawingId]/versions/[versionId] — rename version label
export async function PATCH(request: Request, { params }: RouteParams) {
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

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = renameVersionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { label } = result.data;

  // Verify version belongs to this drawing and drawing belongs to this project
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select(`
      id,
      drawing_id,
      drawings!inner ( project_id )
    `)
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  // Type assertion for the joined data
  const drawingData = version.drawings as unknown as { project_id: string };
  if (drawingData.project_id !== projectId) {
    return NextResponse.json({ error: "Version gehört nicht zu diesem Projekt" }, { status: 403 });
  }

  // Update label
  const { data: updatedVersion, error: updateError } = await supabase
    .from("drawing_versions")
    .update({ label })
    .eq("id", versionId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Label konnte nicht aktualisiert werden" }, { status: 500 });
  }

  return NextResponse.json({ version: updatedVersion });
}
