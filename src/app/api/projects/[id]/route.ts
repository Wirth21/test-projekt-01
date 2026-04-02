import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { editProjectSchema } from "@/lib/validations/project";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/projects/[id] — update project name/description (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Check read-only user
  if (await isReadOnlyUser(supabase)) {
    return NextResponse.json({ error: "Kein Schreibzugriff" }, { status: 403 });
  }

  // Verify caller is project owner
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Nur Eigentümer können das Projekt bearbeiten" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = editProjectSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description } = result.data;

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
