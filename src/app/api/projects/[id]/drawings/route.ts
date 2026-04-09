import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createDrawingSchema } from "@/lib/validations/drawing";
import { getTenantContext } from "@/lib/tenant";
import { checkFileSize, checkStorageLimit } from "@/lib/check-limits";
import { formatBytes } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";
import { isReadOnlyUser } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/drawings — list drawings with latest version info
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Verify user is a project member
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: "Fehler bei der Berechtigungsprüfung" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt" }, { status: 403 });
  }

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
    .order("created_at", { ascending: false });

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
    };
  });

  return NextResponse.json({ drawings: enrichedDrawings });
}

// POST /api/projects/[id]/drawings — create drawing + initial v1 version
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
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

  // Verify user is a project member
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: "Fehler bei der Berechtigungsprüfung" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt" }, { status: 403 });
  }

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

  const { display_name, storage_path, file_size, page_count, status_id: initialStatusId } = result.data;

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
