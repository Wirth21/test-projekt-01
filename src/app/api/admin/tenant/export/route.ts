import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

/**
 * GET /api/admin/tenant/export
 *
 * DSGVO Art. 20 - Tenant-wide data export for admin.
 * Exports ALL data belonging to the admin's tenant as a downloadable JSON file.
 * Requires admin authentication. Uses service role client to bypass RLS.
 */
export async function GET() {
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

    // 3. Fetch tenant info
    const { data: tenant, error: tenantError } = await serviceClient
      .from("tenants")
      .select("id, name, slug, plan, created_at")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Mandant konnte nicht geladen werden" },
        { status: 500 }
      );
    }

    // 4. Fetch all profiles in the tenant
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, display_name, email, status, is_admin, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    // 5. Fetch all projects in the tenant
    const { data: projects } = await serviceClient
      .from("projects")
      .select("id, name, description, is_archived, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    const projectIds = (projects ?? []).map((p) => p.id);

    // 6. Fetch all drawings for tenant projects
    const { data: drawings } = projectIds.length > 0
      ? await serviceClient
          .from("drawings")
          .select("id, project_id, display_name, file_size, page_count, is_archived")
          .in("project_id", projectIds)
          .order("project_id", { ascending: true })
      : { data: [] };

    const drawingIds = (drawings ?? []).map((d) => d.id);

    // 7. Fetch all markers for tenant drawings
    const { data: markers } = drawingIds.length > 0
      ? await serviceClient
          .from("markers")
          .select("id, drawing_id, target_drawing_id, name, page_number")
          .in("drawing_id", drawingIds)
      : { data: [] };

    // 8. Fetch all drawing versions for tenant drawings
    const { data: drawingVersions } = drawingIds.length > 0
      ? await serviceClient
          .from("drawing_versions")
          .select("id, drawing_id, version_number, file_size")
          .in("drawing_id", drawingIds)
      : { data: [] };

    // 9. Fetch activity log entries for tenant projects
    const { data: activityLog } = projectIds.length > 0
      ? await serviceClient
          .from("activity_log")
          .select("id, project_id, action_type, metadata, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    // 10. Assemble export
    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        tenant_id: tenantId,
        tenant_name: tenant.name,
        exported_by_admin: user.id,
        description:
          "Mandantenweiter Datenexport gemaess DSGVO Art. 20 (Recht auf Datenuebertragbarkeit). Enthaelt saemtliche Daten des Mandanten.",
      },
      tenant,
      profiles: profiles ?? [],
      projects: projects ?? [],
      drawings: drawings ?? [],
      markers: markers ?? [],
      drawing_versions: drawingVersions ?? [],
      activity_log: activityLog ?? [],
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `tenant-export-${tenant.slug}-${dateStr}.json`;

    console.info(
      `[admin/tenant/export] Admin ${user.id} exported tenant ${tenantId} (${tenant.slug}) at ${new Date().toISOString()}`
    );

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/tenant/export] Unexpected error:", err);
    return NextResponse.json(
      { error: "Mandanten-Datenexport konnte nicht erstellt werden" },
      { status: 500 }
    );
  }
}
