import { NextResponse } from "next/server";
import { editProjectSchema } from "@/lib/validations/project";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/projects/[id] — update project name/description (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const result = await requireProjectAccess(id, { requireRole: "owner", requireWrite: true });
  if ("error" in result) return result.error;
  const { supabase, user } = result.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = editProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description } = parsed.data;

  // Fetch old project name for activity log
  const { data: existingProject } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single();

  const oldName = existingProject?.name ?? null;

  const { data: project, error: updateError } = await supabase
    .from("projects")
    .update({ name, description: description || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Projekt konnte nicht aktualisiert werden" }, { status: 500 });
  }

  // Log activity: project updated (only if name changed)
  if (oldName && oldName !== name) {
    await logActivity(supabase, {
      projectId: id,
      userId: user.id,
      actionType: "project.updated",
      targetType: "project",
      targetId: id,
      metadata: { old_name: oldName, new_name: name },
    });
  }

  return NextResponse.json({ project });
}
