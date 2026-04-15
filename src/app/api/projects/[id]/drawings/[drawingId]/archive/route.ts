import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// POST /api/projects/[id]/drawings/[drawingId]/archive — archive a drawing
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

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
