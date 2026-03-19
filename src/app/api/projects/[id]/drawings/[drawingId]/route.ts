import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { updateDrawingSchema } from "@/lib/validations/drawing";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// PATCH /api/projects/[id]/drawings/[drawingId] — update drawing (rename or assign group)
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const result = updateDrawingSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { display_name, group_id } = result.data;

  // Build the update payload — only include fields that were provided
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (display_name !== undefined) {
    updatePayload.display_name = display_name;
  }

  if (group_id !== undefined) {
    // If assigning to a group, verify the group exists, belongs to this project, and is active
    if (group_id !== null) {
      const { data: group, error: groupError } = await supabase
        .from("drawing_groups")
        .select("id, is_archived")
        .eq("id", group_id)
        .eq("project_id", projectId)
        .maybeSingle();

      if (groupError) {
        return NextResponse.json({ error: "Fehler beim Prüfen der Gruppe" }, { status: 500 });
      }

      if (!group) {
        return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
      }

      if (group.is_archived) {
        return NextResponse.json({ error: "Zeichnungen können keiner archivierten Gruppe zugewiesen werden" }, { status: 400 });
      }
    }

    updatePayload.group_id = group_id;
  }

  // Update drawing
  const { data: drawing, error: updateError } = await supabase
    .from("drawings")
    .update(updatePayload)
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Zeichnung konnte nicht aktualisiert werden" }, { status: 500 });
  }

  return NextResponse.json({ drawing });
}
