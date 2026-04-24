import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/require-project-access";
import { createServiceRoleClient } from "@/lib/superadmin";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

const bodySchema = z.object({
  direction: z.enum(["up", "down"]),
});

// POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/move
//
// Swap version_number with the adjacent non-archived version. The stack top
// is always the highest version_number, so "up" moves towards a higher
// number and "down" towards a lower one. Archived versions are skipped.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;

  const access = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in access) return access.error;
  const { supabase } = access.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { direction } = parsed.data;

  // Fetch all non-archived versions of this drawing in stack order.
  const { data: active, error: fetchError } = await supabase
    .from("drawing_versions")
    .select("id, version_number, drawing_id, drawings!inner(project_id)")
    .eq("drawing_id", drawingId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false });

  if (fetchError || !active) {
    return NextResponse.json(
      { error: "Versionen konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  // Tenant-isolation: verify the drawing sits in the project we authed against.
  const first = active[0];
  if (first) {
    const pid = (first as unknown as { drawings: { project_id: string } }).drawings.project_id;
    if (pid !== projectId) {
      return NextResponse.json({ error: "Zeichnung gehört nicht zu diesem Projekt" }, { status: 403 });
    }
  }

  const currentIndex = active.findIndex((v) => v.id === versionId);
  if (currentIndex === -1) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (neighborIndex < 0 || neighborIndex >= active.length) {
    return NextResponse.json({ error: "Kein Nachbar in dieser Richtung" }, { status: 400 });
  }

  const current = active[currentIndex];
  const neighbor = active[neighborIndex];

  const service = createServiceRoleClient();
  const { error: swapError } = await service.rpc("swap_version_numbers", {
    p_drawing_id: drawingId,
    p_version_a_id: current.id,
    p_version_b_id: neighbor.id,
  });

  if (swapError) {
    return NextResponse.json(
      { error: "Versionen konnten nicht getauscht werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
