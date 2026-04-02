import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { z } from "zod";

const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(1, "Name darf nicht leer sein")
    .max(200)
    .trim()
    .optional(),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .optional(),
  tenant_role: z
    .enum(["user", "viewer", "guest"], { message: "Ungültige Rolle" })
    .optional(),
}).refine(
  (data) => data.display_name !== undefined || data.email !== undefined || data.tenant_role !== undefined,
  { message: "Keine Änderungen angegeben" }
);

// PATCH /api/admin/users/[userId]/profile — update display_name, email, and/or tenant_role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Verify target user belongs to the same tenant
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (!targetProfile || targetProfile.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { display_name, email, tenant_role } = result.data;

  // Update profile in profiles table
  const profileUpdate: Record<string, string> = {};
  if (display_name !== undefined) profileUpdate.display_name = display_name;
  if (email !== undefined) profileUpdate.email = email.trim().toLowerCase();
  if (tenant_role !== undefined) profileUpdate.tenant_role = tenant_role;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId)
    .select("id, display_name, email, status, is_admin, tenant_role, created_at, updated_at")
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
