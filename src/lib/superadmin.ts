import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Creates a Supabase client with the service role key (bypasses RLS).
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}

/**
 * Checks whether the currently authenticated user is a superadmin.
 * Returns the user object if authorized, or an error string.
 */
export async function getAuthenticatedSuperadmin() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isSuperadmin: false, error: "Not authenticated" as const };
  }

  // Use service role client to read is_superadmin (bypasses RLS)
  const serviceClient = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("is_superadmin, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user, isSuperadmin: false, error: "Profile not found" as const };
  }

  if (!profile.is_superadmin || profile.status !== "active") {
    return { user, isSuperadmin: false, error: "Not a superadmin" as const };
  }

  return { user, isSuperadmin: true, error: null };
}
