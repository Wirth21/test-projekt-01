import { NextResponse } from "next/server";
import { createGroupSchema } from "@/lib/validations/drawing-group";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/groups — list active groups for a project
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Fetch active groups ordered by creation time (oldest first)
  const { data: groups, error: fetchError } = await supabase
    .from("drawing_groups")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Gruppen konnten nicht geladen werden" }, { status: 500 });
  }

  return NextResponse.json({ groups });
}

// POST /api/projects/[id]/groups — create a new group
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

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

  const result = createGroupSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name } = result.data;

  // Check for duplicate active group name in project (case-insensitive)
  const { data: existing, error: dupError } = await supabase
    .from("drawing_groups")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .eq("name", name.trim())
    .maybeSingle();

  if (dupError) {
    return NextResponse.json({ error: "Fehler bei der Duplikat-Prüfung" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(
      { error: "Eine Gruppe mit diesem Namen existiert bereits" },
      { status: 409 }
    );
  }

  // Insert new group
  const { data: group, error: insertError } = await supabase
    .from("drawing_groups")
    .insert({
      project_id: projectId,
      name: name.trim(),
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    // Handle race condition: unique index violation
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Eine Gruppe mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gruppe konnte nicht erstellt werden" }, { status: 500 });
  }

  return NextResponse.json({ group }, { status: 201 });
}
