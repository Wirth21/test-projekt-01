import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/restore — restore an archived project
export async function POST(_request: Request, { params }: RouteParams) {
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

  // Verify ownership or admin
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isOwner = membership?.role === "owner";
  const isAdmin = profile?.is_admin === true;

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Nur der Eigentümer oder ein Admin kann Projekte wiederherstellen" },
      { status: 403 }
    );
  }

  const { data: project, error: restoreError } = await supabase
    .from("projects")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_archived", true)
    .select()
    .single();

  if (restoreError) {
    return NextResponse.json(
      { error: "Projekt konnte nicht wiederhergestellt werden" },
      { status: 500 }
    );
  }

  // Log activity: project restored
  await logActivity(supabase, {
    projectId: id,
    userId: user.id,
    actionType: "project.restored",
    targetType: "project",
    targetId: id,
    metadata: { name: project.name },
  });

  return NextResponse.json({ project });
}
