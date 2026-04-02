import { SupabaseClient } from "@supabase/supabase-js";
import type { TenantRole } from "@/lib/types/admin";

/**
 * Checks whether the currently authenticated user is an admin.
 * Returns the user object, admin status, and tenant_id.
 */
export async function getAuthenticatedAdmin(supabase: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isAdmin: false, tenantId: null, error: "Nicht authentifiziert" as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, status, tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user, isAdmin: false, tenantId: null, error: "Profil nicht gefunden" as const };
  }

  if (!profile.is_admin || profile.status !== "active") {
    return { user, isAdmin: false, tenantId: profile.tenant_id as string, error: "Keine Admin-Berechtigung" as const };
  }

  return { user, isAdmin: true, tenantId: profile.tenant_id as string, error: null };
}

/**
 * Fetches the tenant_role of the authenticated user.
 * Returns 'user' | 'viewer' | 'guest'.
 */
export async function getTenantRole(supabase: SupabaseClient): Promise<TenantRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "user";

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_role")
    .eq("id", user.id)
    .single();

  return (profile?.tenant_role as TenantRole) ?? "user";
}

/**
 * Returns true if the user's tenant_role is read-only (viewer or guest).
 */
export async function isReadOnlyUser(supabase: SupabaseClient): Promise<boolean> {
  const role = await getTenantRole(supabase);
  return role === "viewer" || role === "guest";
}
