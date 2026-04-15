import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";
import { getTenantContext } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/restore — restore an archived project
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Check read-only user
  if (await isReadOnlyUser(supabase)) {
    return NextResponse.json({ error: "Kein Schreibzugriff" }, { status: 403 });
  }

  // Verify tenant context
  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

  // Restore project — use service role to bypass RLS, but filter by tenant_id
  let project = null;
  let restoreError = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("projects")
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .eq("is_archived", true)
      .select()
      .single();
    project = result.data;
    restoreError = result.error;
  } catch {
    const result = await supabase
      .from("projects")
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("is_archived", true)
      .select()
      .single();
    project = result.data;
    restoreError = result.error;
  }

  if (restoreError) {
    return NextResponse.json(
      { error: "Projekt konnte nicht wiederhergestellt werden" },
      { status: 500 }
    );
  }

  // Log activity: project restored
  await logActivity(supabase, {
    projectId: id,
    userId: user.id,
    actionType: "project.restored",
    targetType: "project",
    targetId: id,
    metadata: { name: project.name },
  });

  return NextResponse.json({ project });
}
