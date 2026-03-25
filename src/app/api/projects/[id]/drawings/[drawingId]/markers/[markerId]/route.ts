import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { updateMarkerSchema } from "@/lib/validations/marker";
import { logActivity } from "@/lib/activity-log";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; markerId: string }>;
}

// PATCH /api/projects/[id]/drawings/[drawingId]/markers/[markerId] — update marker
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, markerId } = await params;
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

  const result = updateMarkerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const updates = result.data;

  // If target_drawing_id is being changed, validate it
  if (updates.target_drawing_id) {
    // Prevent self-reference
    if (updates.target_drawing_id === drawingId) {
      return NextResponse.json(
        { error: "Ein Marker kann nicht auf die eigene Zeichnung verweisen" },
        { status: 400 }
      );
    }

    // Verify target drawing belongs to the same project and is not archived
    const { data: targetDrawing, error: targetError } = await supabase
      .from("drawings")
      .select("id, project_id, is_archived")
      .eq("id", updates.target_drawing_id)
      .eq("project_id", projectId)
      .maybeSingle();

    if (targetError || !targetDrawing) {
      return NextResponse.json({ error: "Ziel-Zeichnung nicht gefunden in diesem Projekt" }, { status: 404 });
    }

    if (targetDrawing.is_archived) {
      return NextResponse.json({ error: "Ziel-Zeichnung ist archiviert" }, { status: 400 });
    }
  }

  // Build update payload (only include provided fields)
  const updatePayload: Record<string, unknown> = {};
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.target_drawing_id !== undefined) updatePayload.target_drawing_id = updates.target_drawing_id;
  if (updates.page_number !== undefined) updatePayload.page_number = updates.page_number;
  if (updates.x_percent !== undefined) updatePayload.x_percent = updates.x_percent;
  if (updates.y_percent !== undefined) updatePayload.y_percent = updates.y_percent;

  // Update marker
  const { data: marker, error: updateError } = await supabase
    .from("markers")
    .update(updatePayload)
    .eq("id", markerId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId)
    .select(`
      *,
      target_drawing:drawings!markers_target_drawing_id_fkey (
        id,
        display_name,
        is_archived
      )
    `)
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Marker konnte nicht aktualisiert werden" }, { status: 500 });
  }

  return NextResponse.json({ marker });
}

// DELETE /api/projects/[id]/drawings/[drawingId]/markers/[markerId] — delete marker
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, markerId } = await params;
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

  // Fetch marker info for activity log before deleting
  const { data: markerToDelete } = await supabase
    .from("markers")
    .select("name")
    .eq("id", markerId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId)
    .single();

  // Fetch drawing name for activity log
  const { data: drawingInfo } = await supabase
    .from("drawings")
    .select("display_name")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .single();

  // Delete marker
  const { error: deleteError } = await supabase
    .from("markers")
    .delete()
    .eq("id", markerId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId);

  if (deleteError) {
    return NextResponse.json({ error: "Marker konnte nicht gelöscht werden" }, { status: 500 });
  }

  // Log activity: marker deleted
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "marker.deleted",
    targetType: "marker",
    targetId: markerId,
    metadata: {
      marker_name: markerToDelete?.name || "Unbekannt",
      drawing_name: drawingInfo?.display_name || "Unbekannt",
    },
  });

  return NextResponse.json({ success: true });
}
