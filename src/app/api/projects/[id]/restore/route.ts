import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { logActivity } from "@/lib/activity-log";
import { getTenantContext } from "@/lib/tenant";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/restore — restore an archived project (owner only)
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Authorize: must be an owner of THIS project with write access.
  // Mirrors the archive route; restore was previously missing the membership/
  // owner check, so any writer in the tenant could un-archive any project.
  const access = await requireProjectAccess(id, { requireRole: "owner", requireWrite: true });
  if ("error" in access) return access.error;
  const { supabase, user } = access.data;

  // Tenant scope for the privileged restore
  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

  // Restore project — service role to bypass RLS, still scoped by tenant_id.
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
