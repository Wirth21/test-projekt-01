import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";
import { z } from "zod";

const changeRoleSchema = z.object({
  role: z.enum(["owner", "member"], { message: "Ungültige Rolle" }),
});

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

// PATCH /api/projects/[id]/members/[memberId] — change member role (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId, memberId } = await params;
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

  // Verify caller is an owner
  const { data: callerMembership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Nur Eigentümer können Rollen ändern" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = changeRoleSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }
  const { role } = result.data;

  // Prevent demoting the last owner
  if (role === "member") {
    const { data: targetMember } = await supabase
      .from("project_members")
      .select("role")
      .eq("id", memberId)
      .eq("project_id", projectId)
      .single();

    if (targetMember?.role === "owner") {
      const { count } = await supabase
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("role", "owner");

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Der letzte Eigentümer kann nicht herabgestuft werden." },
          { status: 400 }
        );
      }
    }
  }

  // Update role using service role to bypass RLS
  let updateError: { message: string } | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("project_members")
      .update({ role })
      .eq("id", memberId)
      .eq("project_id", projectId);
    updateError = result.error;
  } catch {
    const result = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", memberId)
      .eq("project_id", projectId);
    updateError = result.error;
  }

  if (updateError) {
    return NextResponse.json({ error: "Rolle konnte nicht geändert werden" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
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

  // Check read-only user
  if (await isReadOnlyUser(supabase)) {
    return NextResponse.json({ error: "Kein Schreibzugriff" }, { status: 403 });
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

  // Delete membership using service role to bypass RLS
  let removeError: { message: string } | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("project_members")
      .delete()
      .eq("id", memberId);
    removeError = result.error;
  } catch {
    const result = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);
    removeError = result.error;
  }

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
