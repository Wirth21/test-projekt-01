import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createProjectSchema } from "@/lib/validations/project";
import { getTenantContext } from "@/lib/tenant";
import { getTenantUsage } from "@/lib/check-limits";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { isReadOnlyUser } from "@/lib/admin";

// GET /api/projects — list projects the current user is a member of
// Query params: ?page=1&limit=50&archived=false
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { page, limit, from, to } = parsePagination(searchParams);
  const showArchived = searchParams.get("archived") === "true";

  // Get project IDs the user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", user.id);

  if (memberError) {
    return NextResponse.json({ error: "Projekte konnten nicht geladen werden" }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({
      data: [],
      pagination: paginationMeta(page, limit, 0),
    });
  }

  const projectIds = memberships.map((m) => m.project_id);
  const roleMap: Record<string, string> = {};
  for (const m of memberships) {
    roleMap[m.project_id] = m.role;
  }

  // Fetch projects with count
  let query = supabase
    .from("projects")
    .select("*", { count: "exact", head: false })
    .in("id", projectIds)
    .eq("is_archived", showArchived)
    .order("updated_at", { ascending: false })
    .range(from, to);

  const { data: projects, error: queryError, count } = await query;

  if (queryError) {
    return NextResponse.json({ error: "Projekte konnten nicht geladen werden" }, { status: 500 });
  }

  const total = count ?? 0;
  const data = (projects ?? []).map((p) => ({
    ...p,
    role: roleMap[p.id] ?? null,
  }));

  return NextResponse.json({
    data,
    pagination: paginationMeta(page, limit, total),
  });
}

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

  // Check read-only user
  if (await isReadOnlyUser(supabase)) {
    return NextResponse.json({ error: "Kein Schreibzugriff" }, { status: 403 });
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
