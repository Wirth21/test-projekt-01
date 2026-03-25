import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";

// PATCH /api/admin/users/[userId]/profile — update display_name and/or email
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  let body: { display_name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const { display_name, email } = body;

  if (!display_name && !email) {
    return NextResponse.json({ error: "Keine Änderungen angegeben" }, { status: 400 });
  }

  // Validate
  if (display_name !== undefined && display_name.trim().length === 0) {
    return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });
  }
  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }
  }

  // Update profile in profiles table
  const profileUpdate: Record<string, string> = {};
  if (display_name !== undefined) profileUpdate.display_name = display_name.trim();
  if (email !== undefined) profileUpdate.email = email.trim().toLowerCase();

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId)
    .select("id, display_name, email, status, is_admin, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Profil konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }

  // If email changed, also update in Supabase Auth
  if (email) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      );
      await adminClient.auth.admin.updateUserById(userId, { email });
    }
  }

  return NextResponse.json({ user: updatedProfile });
}
