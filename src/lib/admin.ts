import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether the currently authenticated user is an admin.
 * Returns the user object and admin status, or null if not authenticated.
 */
export async function getAuthenticatedAdmin(supabase: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isAdmin: false, error: "Nicht authentifiziert" as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user, isAdmin: false, error: "Profil nicht gefunden" as const };
  }

  if (!profile.is_admin || profile.status !== "active") {
    return { user, isAdmin: false, error: "Keine Admin-Berechtigung" as const };
  }

  return { user, isAdmin: true, error: null };
}
