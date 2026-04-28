import { NextResponse } from "next/server";
import { createMarkerSchema } from "@/lib/validations/marker";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

const MAX_MARKERS_PER_VERSION = 100;

// GET /api/projects/[id]/drawings/[drawingId]/markers — list markers for a drawing version
// Query param: ?versionId=<uuid> (optional — defaults to latest active version)
export async function GET(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

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

  // Attach target drawings' thumbnail URLs so the marker tooltip can show
  // a preview without re-downloading + re-rendering the full PDF on each
  // click. We pull the latest non-archived version per target drawing,
  // batch-sign the JPEGs, and return signed URLs alongside the existing
  // target_drawing metadata.
  type RawMarker = {
    target_drawing_id: string;
    target_drawing: {
      id: string;
      display_name: string;
      is_archived: boolean;
    } | null;
  };
  const targetIds = Array.from(
    new Set(
      ((markers as RawMarker[] | null) ?? [])
        .map((m) => m.target_drawing_id)
        .filter(Boolean)
    )
  );
  const thumbPathByDrawing = new Map<string, string>();
  if (targetIds.length > 0) {
    const { data: targetVersions } = await supabase
      .from("drawing_versions")
      .select("drawing_id, thumbnail_path, version_number")
      .in("drawing_id", targetIds)
      .eq("is_archived", false)
      .order("version_number", { ascending: false });
    for (const row of targetVersions ?? []) {
      const r = row as { drawing_id: string; thumbnail_path: string | null };
      if (!thumbPathByDrawing.has(r.drawing_id) && r.thumbnail_path) {
        thumbPathByDrawing.set(r.drawing_id, r.thumbnail_path);
      }
    }
  }

  const thumbUrlByPath = new Map<string, string>();
  if (thumbPathByDrawing.size > 0) {
    const paths = Array.from(thumbPathByDrawing.values());
    const { data: signed } = await supabase.storage
      .from("drawings")
      .createSignedUrls(paths, 3600);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) thumbUrlByPath.set(item.path, item.signedUrl);
    }
  }

  type Joined = RawMarker & {
    target_drawing: {
      id: string;
      display_name: string;
      is_archived: boolean;
      thumbnail_url?: string | null;
    } | null;
  };
  const enriched = ((markers as RawMarker[] | null) ?? []).map((m) => {
    if (!m.target_drawing) return m as Joined;
    const path = thumbPathByDrawing.get(m.target_drawing.id);
    const url = path ? thumbUrlByPath.get(path) ?? null : null;
    return {
      ...m,
      target_drawing: { ...m.target_drawing, thumbnail_url: url },
    } as Joined;
  });

  return NextResponse.json({ markers: enriched, version_id: targetVersionId });
}

// POST /api/projects/[id]/drawings/[drawingId]/markers — create a new marker
// Query param: ?versionId=<uuid> (optional — defaults to latest active version)
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

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
