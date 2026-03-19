import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { approveUserSchema, rejectUserSchema } from "@/lib/validations/admin";

// GET /api/admin/pending — list all pending user registrations
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const { data: pendingUsers, error: queryError } = await supabase
    .from("profiles")
    .select("id, display_name, email, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (queryError) {
    return NextResponse.json(
      { error: "Ausstehende Anfragen konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: pendingUsers ?? [] });
}

// POST /api/admin/pending — approve a pending user
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
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

  const result = approveUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { userId } = result.data;

  // Verify user is actually pending
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Nutzer nicht gefunden" },
      { status: 404 }
    );
  }

  if (profile.status !== "pending") {
    return NextResponse.json(
      { error: "Nutzer ist nicht im Status 'ausstehend'" },
      { status: 400 }
    );
  }

  // Approve: set status to 'active'
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", userId)
    .select("id, display_name, email, status, created_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Nutzer konnte nicht freigegeben werden" },
      { status: 500 }
    );
  }

  // No email notification per project requirements

  return NextResponse.json({ user: updatedProfile });
}

// DELETE /api/admin/pending — reject a pending user (mark as deleted)
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
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

  const result = rejectUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { userId } = result.data;

  // Verify user is actually pending
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Nutzer nicht gefunden" },
      { status: 404 }
    );
  }

  if (profile.status !== "pending") {
    return NextResponse.json(
      { error: "Nutzer ist nicht im Status 'ausstehend'" },
      { status: 400 }
    );
  }

  // Reject: mark as deleted (soft delete, no auth.users deletion)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ status: "deleted" })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json(
      { error: "Nutzer konnte nicht abgelehnt werden" },
      { status: 500 }
    );
  }

  // No email notification per project requirements

  return NextResponse.json({ success: true });
}
