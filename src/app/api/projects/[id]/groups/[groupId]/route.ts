import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { renameGroupSchema } from "@/lib/validations/drawing-group";

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>;
}

// PATCH /api/projects/[id]/groups/[groupId] — rename a group
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId, groupId } = await params;
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

  const result = renameGroupSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name } = result.data;

  // Verify the group exists, belongs to this project, and is not archived
  const { data: existingGroup, error: groupError } = await supabase
    .from("drawing_groups")
    .select("id, is_archived")
    .eq("id", groupId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ error: "Fehler beim Laden der Gruppe" }, { status: 500 });
  }

  if (!existingGroup) {
    return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  }

  if (existingGroup.is_archived) {
    return NextResponse.json({ error: "Archivierte Gruppen können nicht umbenannt werden" }, { status: 400 });
  }

  // Check for duplicate active group name (excluding this group, case-insensitive)
  const { data: duplicate, error: dupError } = await supabase
    .from("drawing_groups")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .eq("name", name.trim())
    .neq("id", groupId)
    .maybeSingle();

  if (dupError) {
    return NextResponse.json({ error: "Fehler bei der Duplikat-Prüfung" }, { status: 500 });
  }

  if (duplicate) {
    return NextResponse.json(
      { error: "Eine Gruppe mit diesem Namen existiert bereits" },
      { status: 409 }
    );
  }

  // Update group name
  const { data: group, error: updateError } = await supabase
    .from("drawing_groups")
    .update({ name: name.trim() })
    .eq("id", groupId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "Eine Gruppe mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gruppe konnte nicht umbenannt werden" }, { status: 500 });
  }

  return NextResponse.json({ group });
}
