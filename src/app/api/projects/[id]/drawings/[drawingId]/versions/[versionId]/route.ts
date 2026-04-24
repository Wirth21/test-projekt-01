import { NextResponse } from "next/server";
import { updateVersionSchema } from "@/lib/validations/version";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

// PATCH /api/projects/[id]/drawings/[drawingId]/versions/[versionId]
// Partial update: label, created_at, rotation, page_count.
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = updateVersionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  // Verify version belongs to this drawing + drawing belongs to this project
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select(`
      id,
      drawing_id,
      drawings!inner ( project_id )
    `)
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const drawingData = version.drawings as unknown as { project_id: string };
  if (drawingData.project_id !== projectId) {
    return NextResponse.json({ error: "Version gehört nicht zu diesem Projekt" }, { status: 403 });
  }

  const updates: Record<string, string | number> = {};
  if (result.data.label !== undefined) updates.label = result.data.label;
  if (result.data.created_at !== undefined) updates.created_at = result.data.created_at;
  if (result.data.rotation !== undefined) updates.rotation = result.data.rotation;
  if (result.data.page_count !== undefined) updates.page_count = result.data.page_count;

  const { data: updatedVersion, error: updateError } = await supabase
    .from("drawing_versions")
    .update(updates)
    .eq("id", versionId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Version konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ version: updatedVersion });
}
