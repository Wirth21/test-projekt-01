import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";
import { rateLimit } from "@/lib/rate-limit";
import type { AdminTenantProject } from "@/lib/types/admin";

/**
 * GET /api/admin/projects/list
 *
 * Returns every project that belongs to the caller's tenant
 * (active + archived), including aggregated counts used by the
 * admin "Projekte" tab and the delete-confirm dialog:
 *
 *   {
 *     projects: [{
 *       id, name, is_archived, created_at,
 *       drawings_count, versions_count,
 *       members_count, groups_count,
 *       storage_bytes
 *     }, ...]
 *   }
 *
 * Counts are aggregated server-side in a few fixed queries
 * (no per-project N+1) and then merged in memory.
 *
 * Auth: must be an authenticated admin whose profile status
 * is 'active'. Tenant isolation is enforced by filtering on
 * `projects.tenant_id = admin.tenant_id`.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { user, isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !user || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Rate limit the aggregation endpoint to match the DELETE route.
  // Four parallel Supabase aggregation queries per call can get
  // expensive on tenants with many projects / drawings.
  const limiter = rateLimit(`admin-projects-list:${user.id}`, 60, 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Service-role for the aggregation queries so we can traverse
  // drawings/versions/members/groups without RLS getting in the way.
  // Tenant isolation is still guaranteed: we filter the project set
  // to `tenant_id = admin.tenant_id` up front and only aggregate
  // over that set.
  const admin = createServiceRoleClient();

  // 1. Base list of projects for the caller's tenant.
  const { data: projects, error: projectsError } = await admin
    .from("projects")
    .select("id, name, is_archived, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(2000);

  if (projectsError) {
    console.error("[admin/projects/list] projects query failed:", projectsError.message);
    return NextResponse.json(
      { error: "Projekte konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  const projectIds = projects.map((p) => p.id);

  // 2. Parallel aggregation queries, one per related entity.
  //    Each returns rows of `(project_id, ...)` that we fold into
  //    counters by project.
  const [drawingsRes, versionsRes, membersRes, groupsRes] = await Promise.all([
    admin
      .from("drawings")
      .select("id, project_id")
      .in("project_id", projectIds),
    admin
      .from("drawing_versions")
      .select("id, file_size, drawing_id, drawings!inner(project_id)")
      .in("drawings.project_id", projectIds),
    admin
      .from("project_members")
      .select("id, project_id")
      .in("project_id", projectIds),
    admin
      .from("drawing_groups")
      .select("id, project_id")
      .in("project_id", projectIds),
  ]);

  if (drawingsRes.error) {
    console.error("[admin/projects/list] drawings query failed:", drawingsRes.error.message);
    return NextResponse.json({ error: "Zeichnungsdaten konnten nicht geladen werden" }, { status: 500 });
  }
  if (versionsRes.error) {
    console.error("[admin/projects/list] versions query failed:", versionsRes.error.message);
    return NextResponse.json({ error: "Versionsdaten konnten nicht geladen werden" }, { status: 500 });
  }
  if (membersRes.error) {
    console.error("[admin/projects/list] members query failed:", membersRes.error.message);
    return NextResponse.json({ error: "Mitgliederdaten konnten nicht geladen werden" }, { status: 500 });
  }
  if (groupsRes.error) {
    console.error("[admin/projects/list] groups query failed:", groupsRes.error.message);
    return NextResponse.json({ error: "Gruppendaten konnten nicht geladen werden" }, { status: 500 });
  }

  // Per-project counters. Storage = sum over drawing_versions.file_size
  // (drawings.file_size also exists but represents the latest version;
  // versions own the authoritative per-version byte count and are what
  // lives in storage).
  const counters: Record<
    string,
    {
      drawings: number;
      versions: number;
      members: number;
      groups: number;
      storage_bytes: number;
    }
  > = {};
  for (const id of projectIds) {
    counters[id] = { drawings: 0, versions: 0, members: 0, groups: 0, storage_bytes: 0 };
  }

  for (const row of drawingsRes.data ?? []) {
    const c = counters[row.project_id as string];
    if (c) c.drawings += 1;
  }

  type VersionRow = {
    id: string;
    file_size: number | null;
    drawing_id: string;
    drawings: { project_id: string } | { project_id: string }[] | null;
  };
  for (const row of (versionsRes.data ?? []) as VersionRow[]) {
    const projRef = Array.isArray(row.drawings) ? row.drawings[0] : row.drawings;
    const pid = projRef?.project_id;
    if (!pid) continue;
    const c = counters[pid];
    if (!c) continue;
    c.versions += 1;
    c.storage_bytes += Number(row.file_size ?? 0);
  }

  for (const row of membersRes.data ?? []) {
    const c = counters[row.project_id as string];
    if (c) c.members += 1;
  }

  for (const row of groupsRes.data ?? []) {
    const c = counters[row.project_id as string];
    if (c) c.groups += 1;
  }

  const payload: AdminTenantProject[] = projects.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    is_archived: Boolean(p.is_archived),
    created_at: p.created_at as string,
    drawings_count: counters[p.id as string].drawings,
    versions_count: counters[p.id as string].versions,
    members_count: counters[p.id as string].members,
    groups_count: counters[p.id as string].groups,
    storage_bytes: counters[p.id as string].storage_bytes,
  }));

  return NextResponse.json({ projects: payload });
}
