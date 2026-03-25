import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

// DELETE /api/projects/[id]/members/[memberId] — remove a member (owner) or self-remove
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: projectId, memberId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Fetch the member to check their role
  const { data: memberToRemove, error: fetchError } = await supabase
    .from("project_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .single();

  if (fetchError || !memberToRemove) {
    return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
  }

  // Fetch removed member's profile info for activity log
  const { data: removedProfile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", memberToRemove.user_id)
    .single();

  // Prevent removal of the last owner
  if (memberToRemove.role === "owner") {
    const { count } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Der letzte Eigentümer kann nicht entfernt werden." },
        { status: 400 }
      );
    }
  }

  const { error: removeError } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId);

  if (removeError) {
    return NextResponse.json({ error: "Mitglied konnte nicht entfernt werden" }, { status: 500 });
  }

  // Log activity: member removed
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "member.removed",
    targetType: "member",
    targetId: memberToRemove.user_id,
    metadata: {
      removed_email: removedProfile?.email || "unbekannt",
      removed_name: removedProfile?.display_name || removedProfile?.email || "Unbekannter Nutzer",
    },
  });

  return NextResponse.json({ success: true });
}
