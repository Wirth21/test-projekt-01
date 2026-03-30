import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createMarkerSchema } from "@/lib/validations/marker";
import { logActivity } from "@/lib/activity-log";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

const MAX_MARKERS_PER_VERSION = 100;

// GET /api/projects/[id]/drawings/[drawingId]/markers — list markers for a drawing version
// Query param: ?versionId=<uuid> (optional — defaults to latest active version)
export async function GET(request: Request, { params }: RouteParams) {
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

  // Determine which version to query markers for
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");

  let targetVersionId: string;

  if (versionId) {
    // Verify the version belongs to this drawing
    const { data: version, error: versionError } = await supabase
      .from("drawing_versions")
      .select("id")
      .eq("id", versionId)
      .eq("drawing_id", drawingId)
      .maybeSingle();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
    }

    targetVersionId = version.id;
  } else {
    // Default to latest active version
    const { data: latestVersion, error: latestError } = await supabase
      .from("drawing_versions")
      .select("id")
      .eq("drawing_id", drawingId)
      .eq("is_archived", false)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError || !latestVersion) {
      return NextResponse.json({ error: "Keine aktive Version gefunden" }, { status: 404 });
    }

    targetVersionId = latestVersion.id;
  }

  // Fetch markers with joined target drawing info
  const { data: markers, error: fetchError } = await supabase
    .from("markers")
    .select(`
      *,
      target_drawing:drawings!markers_target_drawing_id_fkey (
        id,
        display_name,
        is_archived
      )
    `)
    .eq("drawing_version_id", targetVersionId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Marker konnten nicht geladen werden" }, { status: 500 });
  }

  return NextResponse.json({ markers, version_id: targetVersionId });
}

// POST /api/projects/[id]/drawings/[drawingId]/markers — create a new marker
// Query param: ?versionId=<uuid> (optional — defaults to latest active version)
export async function POST(request: Request, { params }: RouteParams) {
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

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = createMarkerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { target_drawing_id, name, color, page_number, x_percent, y_percent } = result.data;

  // Prevent self-reference
  if (target_drawing_id === drawingId) {
    return NextResponse.json(
      { error: "Ein Marker kann nicht auf die eigene Zeichnung verweisen" },
      { status: 400 }
    );
  }

  // Determine which version to attach the marker to
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");

  let targetVersionId: string;

  if (versionId) {
    const { data: version, error: versionError } = await supabase
      .from("drawing_versions")
      .select("id")
      .eq("id", versionId)
      .eq("drawing_id", drawingId)
      .maybeSingle();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
    }

    targetVersionId = version.id;
  } else {
    const { data: latestVersion, error: latestError } = await supabase
      .from("drawing_versions")
      .select("id")
      .eq("drawing_id", drawingId)
      .eq("is_archived", false)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError || !latestVersion) {
      return NextResponse.json({ error: "Keine aktive Version gefunden" }, { status: 404 });
    }

    targetVersionId = latestVersion.id;
  }

  // Verify source drawing belongs to this project
  const { data: sourceDrawing, error: sourceError } = await supabase
    .from("drawings")
    .select("id, project_id, display_name")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (sourceError || !sourceDrawing) {
    return NextResponse.json({ error: "Quell-Zeichnung nicht gefunden" }, { status: 404 });
  }

  // Verify target drawing belongs to the same project and is not archived
  const { data: targetDrawing, error: targetError } = await supabase
    .from("drawings")
    .select("id, project_id, is_archived")
    .eq("id", target_drawing_id)
    .eq("project_id", projectId)
    .maybeSingle();

  if (targetError || !targetDrawing) {
    return NextResponse.json({ error: "Ziel-Zeichnung nicht gefunden in diesem Projekt" }, { status: 404 });
  }

  if (targetDrawing.is_archived) {
    return NextResponse.json({ error: "Ziel-Zeichnung ist archiviert" }, { status: 400 });
  }

  // Enforce max markers per version limit
  const { count, error: countError } = await supabase
    .from("markers")
    .select("id", { count: "exact", head: true })
    .eq("drawing_version_id", targetVersionId);

  if (countError) {
    return NextResponse.json({ error: "Marker-Anzahl konnte nicht geprüft werden" }, { status: 500 });
  }

  if (count !== null && count >= MAX_MARKERS_PER_VERSION) {
    return NextResponse.json(
      { error: `Maximale Anzahl von ${MAX_MARKERS_PER_VERSION} Markern pro Version erreicht` },
      { status: 400 }
    );
  }

  // Insert marker
  const { data: marker, error: insertError } = await supabase
    .from("markers")
    .insert({
      drawing_id: drawingId,
      drawing_version_id: targetVersionId,
      target_drawing_id,
      project_id: projectId,
      name,
      color,
      page_number,
      x_percent,
      y_percent,
      created_by: user.id,
    })
    .select(`
      *,
      target_drawing:drawings!markers_target_drawing_id_fkey (
        id,
        display_name,
        is_archived
      )
    `)
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Marker konnte nicht erstellt werden" }, { status: 500 });
  }

  // Log activity: marker created
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "marker.created",
    targetType: "marker",
    targetId: marker.id,
    metadata: {
      marker_name: name,
      drawing_name: sourceDrawing.display_name,
    },
  });

  return NextResponse.json({ marker }, { status: 201 });
}
