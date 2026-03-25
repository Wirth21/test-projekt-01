import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createProjectSchema } from "@/lib/validations/project";
import { getTenantContext } from "@/lib/tenant";
import { getTenantUsage } from "@/lib/check-limits";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";

// POST /api/projects — create a new project
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = createProjectSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description } = result.data;

  const { tenantId } = await getTenantContext();

  // Check project count limit
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single();

  const plan = (tenant?.plan as PlanType) ?? "free";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const usage = await getTenantUsage(supabase, tenantId);

  if (usage.projectCount >= limits.maxProjects) {
    return NextResponse.json(
      { error: "Projektlimit erreicht. Bitte Plan upgraden." },
      { status: 403 }
    );
  }

  const { data: project, error: createError } = await supabase
    .from("projects")
    .insert({ name, description: description || null, created_by: user.id, tenant_id: tenantId })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: "Projekt konnte nicht erstellt werden", detail: createError.message }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from("project_members")
    .insert({ project_id: project.id, user_id: user.id, role: "owner" });

  if (memberError) {
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht erstellt werden", detail: memberError.message }, { status: 500 });
  }

  // Log activity: project created
  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    actionType: "project.created",
    targetType: "project",
    targetId: project.id,
    metadata: { name },
  });

  return NextResponse.json({ project }, { status: 201 });
}
