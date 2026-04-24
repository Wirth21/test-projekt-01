import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

// Password rules kept in sync with the admin-set-password endpoint.
const passwordSchema = z
  .string()
  .min(8, "Mindestens 8 Zeichen")
  .max(200, "Maximal 200 Zeichen")
  .regex(/[A-Za-z]/, "Mindestens ein Buchstabe")
  .regex(/[0-9]/, "Mindestens eine Ziffer");

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
  newPassword: passwordSchema,
});

/**
 * POST /api/profile/password
 *
 * Authenticated users change their own password.
 * - Requires the current password (re-auth via signInWithPassword) before
 *   applying the update. That blocks session-hijack attackers who have a
 *   cookie but not the current password.
 * - Rate-limited per user.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // 5 attempts per 10 minutes per user — plenty for typos, enough to slow
  // a cookie-stealing attacker who tries to brute-force the current password.
  const limiter = rateLimit(`profile-password:${user.id}`, 5, 10 * 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte versuche es in einigen Minuten erneut." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "Das neue Passwort muss sich vom aktuellen unterscheiden." },
      { status: 400 }
    );
  }

  // Re-auth with a fresh anon client so we don't disturb the caller's session.
  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    return NextResponse.json(
      { error: "Aktuelles Passwort ist falsch." },
      { status: 403 }
    );
  }

  // Apply the update via the caller's authenticated session.
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return NextResponse.json(
      { error: "Passwort konnte nicht geändert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
