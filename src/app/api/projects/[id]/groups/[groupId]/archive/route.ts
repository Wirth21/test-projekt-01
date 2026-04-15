import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>;
}

// POST /api/projects/[id]/groups/[groupId]/archive — archive a group
// Atomically: set group is_archived = true AND set all drawings in that group to group_id = NULL
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: projectId, groupId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Verify the group exists, belongs to this project, and is not already archived
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
    return NextResponse.json({ error: "Gruppe ist bereits archiviert" }, { status: 400 });
  }

  // Step 1: Unassign all drawings from this group (set group_id = NULL)
  const { error: unassignError } = await supabase
    .from("drawings")
    .update({ group_id: null })
    .eq("group_id", groupId)
    .eq("project_id", projectId);

  if (unassignError) {
    return NextResponse.json(
      { error: "Zeichnungen konnten nicht von der Gruppe gelöst werden" },
      { status: 500 }
    );
  }

  // Step 2: Archive the group
  const { data: group, error: archiveError } = await supabase
    .from("drawing_groups")
    .update({ is_archived: true })
    .eq("id", groupId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (archiveError) {
    return NextResponse.json({ error: "Gruppe konnte nicht archiviert werden" }, { status: 500 });
  }

  return NextResponse.json({ group });
}
