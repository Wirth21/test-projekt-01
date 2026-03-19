import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

  return NextResponse.json({ success: true });
}
