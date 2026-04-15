import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/archive — archive project (owner only)
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const result = await requireProjectAccess(id, { requireRole: "owner", requireWrite: true });
  if ("error" in result) return result.error;
  const { supabase, user } = result.data;

  const { data: project, error: archiveError } = await supabase
    .from("projects")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (archiveError) {
    return NextResponse.json({ error: "Projekt konnte nicht archiviert werden" }, { status: 500 });
  }

  // Log activity: project archived
  await logActivity(supabase, {
    projectId: id,
    userId: user.id,
    actionType: "project.archived",
    targetType: "project",
    targetId: id,
    metadata: { name: project.name },
  });

  return NextResponse.json({ project });
}
