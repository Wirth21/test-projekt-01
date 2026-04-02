import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// POST /api/projects/[id]/drawings/[drawingId]/restore — restore an archived drawing
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

  // Check read-only user
  if (await isReadOnlyUser(supabase)) {
    return NextResponse.json({ error: "Kein Schreibzugriff" }, { status: 403 });
  }

  // Verify user is a project member
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json(
      { error: "Fehler bei der Berechtigungsprüfung" },
      { status: 500 }
    );
  }

  if (!membership) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt" },
      { status: 403 }
    );
  }

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
