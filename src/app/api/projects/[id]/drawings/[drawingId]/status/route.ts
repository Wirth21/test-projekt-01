import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

const updateStatusSchema = z.object({
  status_id: z.string().uuid("Ungültige Status-ID").nullable(),
  version_id: z.string().uuid("Ungültige Versions-ID"),
});

// PATCH /api/projects/[id]/drawings/[drawingId]/status — change version status
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const result = updateStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { status_id, version_id } = result.data;

  // Verify version belongs to this drawing and project
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select("id, status_id, drawing:drawings!inner(id, project_id)")
    .eq("id", version_id)
    .eq("drawing_id", drawingId)
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const drawingData = version.drawing as unknown as { id: string; project_id: string };
  if (drawingData.project_id !== projectId) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Fetch old status name for activity log
  let oldStatusName: string | null = null;
  if (version.status_id) {
    const { data: oldStatus } = await supabase
      .from("drawing_statuses")
      .select("name")
      .eq("id", version.status_id)
      .single();
    oldStatusName = oldStatus?.name ?? null;
  }

  // Fetch new status name for activity log
  let newStatusName: string | null = null;
  if (status_id) {
    const { data: newStatus } = await supabase
      .from("drawing_statuses")
      .select("name")
      .eq("id", status_id)
      .single();

    if (!newStatus) {
      return NextResponse.json({ error: "Status nicht gefunden" }, { status: 404 });
    }
    newStatusName = newStatus.name;
  }

  // Update version status
  const { error: updateError } = await supabase
    .from("drawing_versions")
    .update({
      status_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", version_id);

  if (updateError) {
    return NextResponse.json({ error: "Status konnte nicht aktualisiert werden" }, { status: 500 });
  }

  // Fetch drawing name for activity log
  const { data: drawingInfo } = await supabase
    .from("drawings")
    .select("display_name")
    .eq("id", drawingId)
    .single();

  // Log activity
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "drawing.status_changed",
    targetType: "drawing",
    targetId: drawingId,
    metadata: {
      change_type: "status",
      drawing_name: drawingInfo?.display_name ?? "",
      version_id,
      old_status: oldStatusName,
      new_status: newStatusName,
    },
  });

  return NextResponse.json({ success: true });
}
