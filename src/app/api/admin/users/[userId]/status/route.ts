import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { updateUserStatusSchema } from "@/lib/validations/admin";

// PUT /api/admin/users/[userId]/status — change user status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { user, isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !user) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const result = updateUserStatusSchema.safeParse({ ...body as object, userId });
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { status } = result.data;

  // Prevent admin from disabling/deleting their own account
  if (userId === user.id && (status === "disabled" || status === "deleted")) {
    return NextResponse.json(
      { error: "Du kannst deinen eigenen Account nicht deaktivieren oder loeschen." },
      { status: 400 }
    );
  }

  // Check that the target user exists and is not already in the desired status
  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, status, is_admin")
    .eq("id", userId)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json(
      { error: "Nutzer nicht gefunden" },
      { status: 404 }
    );
  }

  // Last-admin protection: ensure at least one active admin remains
  if (targetProfile.is_admin && (status === "disabled" || status === "deleted")) {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", true)
      .eq("status", "active")
      .neq("id", userId);

    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: "Es muss mindestens ein aktiver Admin verbleiben." },
        { status: 400 }
      );
    }
  }

  // If marking as deleted, set status to 'deleted' (soft delete)
  // The user remains in auth.users but cannot log in
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId)
    .select("id, display_name, email, status, is_admin, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Status konnte nicht geaendert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: updatedProfile });
}
