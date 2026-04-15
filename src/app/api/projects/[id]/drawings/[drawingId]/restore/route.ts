import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// POST /api/projects/[id]/drawings/[drawingId]/restore — restore an archived drawing
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

  const { data: drawing, error: restoreError } = await supabase
    .from("drawings")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .eq("is_archived", true)
    .select()
    .single();

  if (restoreError) {
    return NextResponse.json(
      { error: "Zeichnung konnte nicht wiederhergestellt werden" },
      { status: 500 }
    );
  }

  // Log activity: drawing restored
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "drawing.restored",
    targetType: "drawing",
    targetId: drawingId,
    metadata: { display_name: drawing.display_name },
  });

  return NextResponse.json({ drawing });
}
