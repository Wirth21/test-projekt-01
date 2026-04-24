import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";
import { rateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

const passwordSchema = z
  .string()
  .min(8, "Mindestens 8 Zeichen")
  .max(200, "Maximal 200 Zeichen")
  .regex(/[A-Za-z]/, "Mindestens ein Buchstabe")
  .regex(/[0-9]/, "Mindestens eine Ziffer");

const bodySchema = z.object({
  newPassword: passwordSchema,
});

const paramSchema = z.object({
  userId: z.string().uuid("Ungültige Nutzer-ID"),
});

/**
 * POST /api/admin/users/[userId]/password
 *
 * Tenant-admin resets a user's password. Uses the Supabase Auth Admin API
 * (service-role). Tenant-isolated: admin may only reset users in their own
 * tenant. Self-reset is blocked here — admins must use the self-service
 * endpoint at /api/profile/password so they still need to prove the current
 * password.
 *
 * Writes an entry to tenant_activity_log (action_type =
 * 'user.password_reset_by_admin') for accountability.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();

  // 1. Admin check + own tenant
  const { user: admin, isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !admin || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // 2. Validate target user ID
  const { userId: rawTarget } = await params;
  const paramResult = paramSchema.safeParse({ userId: rawTarget });
  if (!paramResult.success) {
    return NextResponse.json({ error: "Ungültige Nutzer-ID" }, { status: 400 });
  }
  const targetUserId = paramResult.data.userId;

  if (targetUserId === admin.id) {
    return NextResponse.json(
      {
        error:
          "Eigenes Passwort bitte unter Profil > Passwort aendern setzen; dort wird das aktuelle Passwort abgefragt.",
      },
      { status: 400 }
    );
  }

  // 3. Rate limit per admin
  const limiter = rateLimit(`admin-password-reset:${admin.id}`, 30, 10 * 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Passwort-Resets. Bitte spater erneut versuchen." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  // 4. Body validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }
  const bodyResult = bodySchema.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: bodyResult.error.flatten() },
      { status: 400 }
    );
  }
  const { newPassword } = bodyResult.data;

  const service = createServiceRoleClient();

  // 5. Confirm target user exists and belongs to the same tenant
  const { data: targetProfile, error: targetError } = await service
    .from("profiles")
    .select("id, email, tenant_id, display_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json(
      { error: "Nutzer konnte nicht geladen werden" },
      { status: 500 }
    );
  }
  if (!targetProfile || targetProfile.tenant_id !== tenantId) {
    // Info-hiding: same response for "not found" and "wrong tenant".
    return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });
  }

  // 6. Update password via Auth Admin API
  const { error: updateError } = await service.auth.admin.updateUserById(
    targetUserId,
    { password: newPassword }
  );
  if (updateError) {
    return NextResponse.json(
      { error: "Passwort konnte nicht gesetzt werden" },
      { status: 500 }
    );
  }

  // 7. Audit log — never includes the password value itself
  await service.from("tenant_activity_log").insert({
    tenant_id: tenantId,
    user_id: admin.id,
    action_type: "user.password_reset_by_admin",
    target_type: "user",
    target_id: targetUserId,
    metadata: {
      target_email: targetProfile.email,
      target_display_name: targetProfile.display_name,
      reset_at: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}
