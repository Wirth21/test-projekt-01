import { NextResponse } from "next/server";
import { createDrawingSchema } from "@/lib/validations/drawing";
import { getTenantContext } from "@/lib/tenant";
import { checkFileSize, checkStorageLimit } from "@/lib/check-limits";
import { formatBytes } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/drawings — list drawings with latest version info
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Fetch all drawings with their versions and status
  const { data: drawings, error: fetchError } = await supabase
    .from("drawings")
    .select(`
      *,
      drawing_versions (
        id,
        drawing_id,
        version_number,
        label,
        storage_path,
        thumbnail_path,
        file_size,
        page_count,
        is_archived,
        created_by,
        created_at,
        updated_at,
        status_id,
        status:drawing_statuses(id, name, color)
      )
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (fetchError) {
    return NextResponse.json({ error: "Zeichnungen konnten nicht geladen werden" }, { status: 500 });
  }

  // Enrich each drawing with version_count and latest_version
  const enrichedDrawings = (drawings ?? []).map((drawing) => {
    const versions = (drawing.drawing_versions ?? []) as Array<{
      id: string;
      drawing_id: string;
      version_number: number;
      label: string;
      storage_path: string;
      thumbnail_path: string | null;
      file_size: number;
      page_count: number | null;
      is_archived: boolean;
      created_by: string;
      created_at: string;
      updated_at: string;
      status_id: string | null;
      status: { id: string; name: string; color: string } | null;
    }>;

    const activeVersions = versions
      .filter((v) => !v.is_archived)
      .sort((a, b) => b.version_number - a.version_number);

    const latestVersion = activeVersions[0] ?? null;

    // Remove the raw join data, return clean object
    const { drawing_versions: _, ...drawingBase } = drawing;

    return {
      ...drawingBase,
      version_count: versions.length,
      latest_version: latestVersion,
      thumbnail_url: null as string | null,
    };
  });

  // Batch-sign thumbnail URLs (1 hour). Much cheaper than one request per
  // drawing: clients can render previews immediately without a second
  // round trip per card.
  const thumbPaths = enrichedDrawings
    .map((d) => d.latest_version?.thumbnail_path)
    .filter((p): p is string => !!p);

  if (thumbPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("drawings")
      .createSignedUrls(thumbPaths, 3600);

    if (signed) {
      const urlByPath = new Map<string, string>();
      for (const item of signed) {
        if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
      }
      for (const d of enrichedDrawings) {
        const path = d.latest_version?.thumbnail_path;
        if (path) d.thumbnail_url = urlByPath.get(path) ?? null;
      }
    }
  }

  return NextResponse.json({ drawings: enrichedDrawings });
}

// POST /api/projects/[id]/drawings — create drawing + initial v1 version
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = createDrawingSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const {
    display_name,
    storage_path,
    file_size,
    page_count,
    status_id: initialStatusId,
    thumbnail_path,
  } = result.data;

  // Check plan limits for file size and storage
  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single();

  const plan = (tenant?.plan as PlanType) ?? "free";

  const fileSizeCheck = checkFileSize(plan, file_size);
  if (!fileSizeCheck.allowed) {
    return NextResponse.json(
      { error: `Die Datei ist zu groß. Maximale Dateigröße: ${formatBytes(fileSizeCheck.maxBytes)}.` },
      { status: 413 }
    );
  }

  const storageCheck = await checkStorageLimit(supabase, tenantId, plan, file_size);
  if (!storageCheck.allowed) {
    return NextResponse.json(
      { error: "Speicherlimit erreicht. Bitte Plan upgraden." },
      { status: 403 }
    );
  }

  // Validate storage_path belongs to this project (prevents IDOR)
  const expectedPrefix = `${projectId}/`;
  if (!storage_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Ungültiger Speicherpfad" }, { status: 400 });
  }

  // Insert drawing metadata (without storage_path/file_size/page_count — those go in drawing_versions)
  const { data: drawing, error: insertError } = await supabase
    .from("drawings")
    .insert({
      project_id: projectId,
      display_name,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Zeichnung konnte nicht gespeichert werden" }, { status: 500 });
  }

  // Create initial v1 version
  const now = new Date();
  const defaultLabel = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .insert({
      drawing_id: drawing.id,
      version_number: 1,
      label: defaultLabel,
      storage_path,
      thumbnail_path: thumbnail_path ?? null,
      file_size,
      page_count: page_count ?? null,
      created_by: user.id,
      status_id: initialStatusId ?? null,
    })
    .select()
    .single();

  if (versionError) {
    // Rollback: delete the drawing if version creation fails
    await supabase.from("drawings").delete().eq("id", drawing.id);
    return NextResponse.json({ error: "Version konnte nicht erstellt werden" }, { status: 500 });
  }

  // Log activity: drawing uploaded
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "drawing.uploaded",
    targetType: "drawing",
    targetId: drawing.id,
    metadata: { display_name, file_size },
  });

  return NextResponse.json(
    {
      drawing: {
        ...drawing,
        version_count: 1,
        latest_version: version,
      },
    },
    { status: 201 }
  );
}
