import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// POST /api/projects/[id]/drawings/[drawingId]/archive — archive a drawing
export async function POST(_request: Request, { params }: RouteParams) {
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

  // Set is_archived = true
  const { data: drawing, error: updateError } = await supabase
    .from("drawings")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Zeichnung konnte nicht archiviert werden" }, { status: 500 });
  }

  // Log activity: drawing archived
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "drawing.archived",
    targetType: "drawing",
    targetId: drawingId,
    metadata: { display_name: drawing.display_name },
  });

  return NextResponse.json({ drawing });
}
