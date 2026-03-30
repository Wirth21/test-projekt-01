import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

/**
 * DELETE /api/admin/tenant/delete
 *
 * DSGVO Art. 17 - Admin-initiated tenant soft-deletion.
 * Requires admin authentication.
 *
 * Soft-delete approach:
 * - Sets tenant `is_active` to false
 * - Sets ALL profiles in the tenant to status 'deleted'
 * - Anonymizes display_names to 'Geloeschter Nutzer'
 * - Does NOT delete storage files or projects (archival / DSGVO Art. 17 Abs. 3)
 * - Logs the action to server console
 */
export async function DELETE() {
  const supabase = await createServerSupabaseClient();

  // 1. Verify admin authentication
  const { user, isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !user) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    // 2. Fetch admin's tenant_id
    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (adminProfileError || !adminProfile?.tenant_id) {
      return NextResponse.json(
        { error: "Admin-Profil oder Mandant konnte nicht geladen werden" },
        { status: 500 }
      );
    }

    const tenantId = adminProfile.tenant_id;

    // 3. Fetch tenant info for logging
    const { data: tenant, error: tenantError } = await serviceClient
      .from("tenants")
      .select("id, name, slug, is_active")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Mandant konnte nicht geladen werden" },
        { status: 500 }
      );
    }

    // 4. Check if already deactivated
    if (tenant.is_active === false) {
      return NextResponse.json(
        { error: "Dieser Mandant wurde bereits deaktiviert" },
        { status: 409 }
      );
    }

    // 5. Deactivate tenant
    const { error: tenantUpdateError } = await serviceClient
      .from("tenants")
      .update({ is_active: false })
      .eq("id", tenantId);

    if (tenantUpdateError) {
      console.error("[admin/tenant/delete] Error deactivating tenant:", tenantUpdateError.message);
      return NextResponse.json(
        { error: "Mandant konnte nicht deaktiviert werden" },
        { status: 500 }
      );
    }

    // 6. Soft-delete all profiles: set status to 'deleted' and anonymize display_name
    const { error: profilesUpdateError } = await serviceClient
      .from("profiles")
      .update({
        status: "deleted",
        display_name: "Geloeschter Nutzer",
      })
      .eq("tenant_id", tenantId);

    if (profilesUpdateError) {
      console.error("[admin/tenant/delete] Error updating profiles:", profilesUpdateError.message);
      return NextResponse.json(
        { error: "Nutzerprofile konnten nicht aktualisiert werden" },
        { status: 500 }
      );
    }

    // 7. Log the action
    console.info(
      `[admin/tenant/delete] DSGVO Art. 17 tenant soft-delete: admin=${user.id} deleted tenant=${tenantId} slug=${tenant.slug} name=${tenant.name} at ${new Date().toISOString()}`
    );

    return NextResponse.json({
      message: `Mandant "${tenant.name}" wurde erfolgreich deaktiviert. Alle Nutzerkonten wurden zur Loeschung markiert.`,
      deleted_tenant_id: tenantId,
      tenant_slug: tenant.slug,
    });
  } catch (err) {
    console.error("[admin/tenant/delete] Unexpected error:", err);
    return NextResponse.json(
      { error: "Mandantenloeschung konnte nicht durchgefuehrt werden" },
      { status: 500 }
    );
  }
}
