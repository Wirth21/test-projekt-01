import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";
import { adminProjectIdParamSchema } from "@/lib/validations/admin";
import { rateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// Vercel serverless function timeout (30 s). For very large projects,
// the storage-delete fan-out can take longer than the default 10 s Hobby
// window; this route is explicitly allowed up to 30 s. See the feature
// spec "Edge Cases" section for the documented upper bound.
export const maxDuration = 30;

const STORAGE_BUCKET = "drawings";
const STORAGE_LIST_PAGE = 1000;
const STORAGE_REMOVE_BATCH = 100;

/**
 * Recursively collects every storage object path under <projectId>/ in
 * the `drawings` bucket. Walks the bucket tree because `list()` is not
 * recursive by default.
 */
async function listAllProjectStoragePaths(
  admin: SupabaseClient,
  projectId: string
): Promise<string[]> {
  const allPaths: string[] = [];
  const stack: string[] = [projectId];

  while (stack.length > 0) {
    const prefix = stack.pop()!;
    let offset = 0;

    // Paginate through the current folder.
    // Each returned entry is either a file (has `id`/`metadata`) or a
    // subfolder (no `id`). We recurse into subfolders.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await admin.storage.from(STORAGE_BUCKET).list(prefix, {
        limit: STORAGE_LIST_PAGE,
        offset,
      });
      if (error) {
        throw new Error(`storage.list('${prefix}') failed: ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const fullPath = `${prefix}/${entry.name}`;
        // Files have `id` set. Folders do not.
        if (entry.id) {
          allPaths.push(fullPath);
        } else {
          stack.push(fullPath);
        }
      }

      if (data.length < STORAGE_LIST_PAGE) break;
      offset += data.length;
    }
  }

  return allPaths;
}

/**
 * Removes all paths in batches of at most STORAGE_REMOVE_BATCH. If any
 * batch fails, throws so the caller can abort before touching the DB.
 */
async function removePathsInBatches(
  admin: SupabaseClient,
  paths: string[]
): Promise<void> {
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(batch);
    if (error) {
      throw new Error(
        `storage.remove (batch ${i / STORAGE_REMOVE_BATCH + 1}) failed: ${error.message}`
      );
    }
  }
}

/**
 * DELETE /api/admin/projects/[projectId]
 *
 * Permanently removes a project, all storage objects under its prefix,
 * and (via ON DELETE CASCADE) drawings, drawing_versions, drawing_groups,
 * markers, project_members and activity_log rows.
 *
 * Auth requirements:
 *   - Authenticated
 *   - `is_admin = true`
 *   - `status = 'active'`
 *   - Target project must belong to the same tenant as the caller.
 *     Mismatch returns 404 (information hiding — don't leak that the
 *     project exists on a different tenant).
 *
 * Execution order:
 *   1. Auth + tenant check.
 *   2. Collect storage paths under `<projectId>/` in the `drawings` bucket.
 *   3. Delete storage objects in batches of 100.
 *      If any batch fails -> abort, DB untouched, HTTP 500.
 *   4. Write an audit row to `tenant_activity_log` *before* the DB delete
 *      so the log survives even if step 5 fails. Service-role insert.
 *   5. Call `public.admin_hard_delete_project(p_project_id)` which
 *      atomically: DISABLE protection triggers -> DELETE FROM projects
 *      -> ENABLE triggers. Trigger state is restored even on error.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();

  // 1. Auth — admin + active status.
  const { user, isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !user || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // 2. Validate URL param shape.
  const { projectId: rawProjectId } = await params;
  const paramParse = adminProjectIdParamSchema.safeParse({ projectId: rawProjectId });
  if (!paramParse.success) {
    return NextResponse.json(
      { error: "Ungueltige Projekt-ID" },
      { status: 400 }
    );
  }
  const projectId = paramParse.data.projectId;

  // 3. Rate limit per admin user (20 deletes per minute is already generous).
  const limiter = rateLimit(`admin-delete-project:${user.id}`, 20, 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const admin = createServiceRoleClient();

  // 4. Load target project — confirm existence + tenant ownership.
  const { data: project, error: projectLoadError } = await admin
    .from("projects")
    .select("id, name, tenant_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectLoadError) {
    console.error("[admin/project-delete] project load failed:", projectLoadError.message);
    return NextResponse.json(
      { error: "Projekt konnte nicht geladen werden" },
      { status: 500 }
    );
  }

  // Missing project OR different tenant -> 404 (info hiding).
  if (!project || project.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "Projekt nicht gefunden" },
      { status: 404 }
    );
  }

  // 5. Pre-compute counts + storage size in a single RPC.
  //    Uses server-side SUM so it is accurate regardless of
  //    version count (the previous PostgREST approach capped
  //    at 100k rows). Runs before the storage wipe so the
  //    numbers reflect the pre-delete state for the audit row.
  const { data: statsRows, error: statsError } = await admin.rpc(
    "project_storage_stats",
    { p_project_id: projectId }
  );

  if (statsError) {
    return NextResponse.json(
      { error: "Projekt-Statistiken konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  // RPC returns a single-row table; Supabase gives us an array.
  const stats = Array.isArray(statsRows) ? statsRows[0] : statsRows;
  const drawingsCount = Number(stats?.drawings_count ?? 0);
  const versionsCount = Number(stats?.versions_count ?? 0);
  const membersCount = Number(stats?.members_count ?? 0);
  const groupsCount = Number(stats?.groups_count ?? 0);
  const storageBytes = Number(stats?.storage_bytes ?? 0);

  // 6. Collect + delete storage objects.
  let storagePaths: string[] = [];
  try {
    storagePaths = await listAllProjectStoragePaths(admin, projectId);
  } catch (err) {
    console.error("[admin/project-delete] storage list failed:", err);
    return NextResponse.json(
      { error: "Dateien im Speicher konnten nicht aufgelistet werden" },
      { status: 500 }
    );
  }

  if (storagePaths.length > 0) {
    try {
      await removePathsInBatches(admin, storagePaths);
    } catch (err) {
      console.error("[admin/project-delete] storage remove failed:", err);
      return NextResponse.json(
        {
          error: "Dateien im Speicher konnten nicht geloescht werden. DB bleibt unveraendert — bitte erneut versuchen.",
        },
        { status: 500 }
      );
    }
  }

  // 7. Atomic DB delete + audit log.
  //    The RPC performs both operations in a single transaction:
  //    DISABLE trigger -> DELETE FROM projects -> ENABLE trigger -> INSERT audit.
  //    This makes the audit row and the delete consistent: a rollback on the
  //    delete side leaves no orphan audit row, and a retry on an already-
  //    deleted project returns rows_deleted = 0 and does NOT duplicate the
  //    audit entry.
  const auditMetadata = {
    project_name: project.name,
    drawings_count: drawingsCount,
    versions_count: versionsCount,
    members_count: membersCount,
    groups_count: groupsCount,
    storage_bytes: storageBytes,
    storage_objects_removed: storagePaths.length,
    deleted_at: new Date().toISOString(),
  };

  const { data: rowsDeleted, error: deleteError } = await admin.rpc(
    "admin_hard_delete_project",
    {
      p_project_id: projectId,
      p_tenant_id: tenantId,
      p_user_id: user.id,
      p_metadata: auditMetadata,
    }
  );

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          "Projekt konnte aus der Datenbank nicht geloescht werden. Bitte erneut versuchen.",
      },
      { status: 500 }
    );
  }

  // Row count of 0 means the project was already gone between step 4 and now
  // (concurrent delete from another admin). Treat as success — the end state
  // is exactly what the caller wanted, and the first caller already wrote
  // the audit row. Returning 200 keeps retries idempotent.
  const wasAlreadyDeleted = !rowsDeleted || Number(rowsDeleted) === 0;

  return NextResponse.json({
    deleted: {
      project_id: projectId,
      project_name: project.name,
      drawings: drawingsCount,
      members: membersCount,
      storage_bytes: storageBytes,
      already_deleted: wasAlreadyDeleted,
    },
  });
}

