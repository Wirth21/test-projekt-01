import { NextResponse } from "next/server";
import { createVersionSchema } from "@/lib/validations/version";
import { getTenantContext } from "@/lib/tenant";
import { checkFileSize, checkStorageLimit } from "@/lib/check-limits";
import { formatBytes } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string }>;
}

// GET /api/projects/[id]/drawings/[drawingId]/versions — list all versions
export async function GET(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Verify drawing belongs to this project
  const { data: drawing, error: drawingError } = await supabase
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (drawingError || !drawing) {
    return NextResponse.json({ error: "Zeichnung nicht gefunden" }, { status: 404 });
  }

  // Check if archived versions should be included
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  // Fetch versions
  let query = supabase
    .from("drawing_versions")
    .select("*, status:drawing_statuses(id, name, color)")
    .eq("drawing_id", drawingId)
    .order("version_number", { ascending: false });

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data: versions, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: "Versionen konnten nicht geladen werden" }, { status: 500 });
  }

  return NextResponse.json({ versions });
}

// POST /api/projects/[id]/drawings/[drawingId]/versions — create new version + copy markers
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

  // Verify drawing belongs to this project and is not archived
  const { data: drawing, error: drawingError } = await supabase
    .from("drawings")
    .select("id, is_archived, display_name")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (drawingError || !drawing) {
    return NextResponse.json({ error: "Zeichnung nicht gefunden" }, { status: 404 });
  }

  if (drawing.is_archived) {
    return NextResponse.json({ error: "Archivierte Zeichnungen können keine neuen Versionen erhalten" }, { status: 400 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = createVersionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { storage_path, file_size, page_count, label, thumbnail_path } = result.data;

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

  // Validate storage_path format: {project_id}/{drawing_id}/{version_number}.pdf
  const expectedPrefix = `${projectId}/${drawingId}/`;
  if (!storage_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Ungültiger Speicherpfad" }, { status: 400 });
  }

  // Determine next version number
  const { data: latestVersion, error: latestError } = await supabase
    .from("drawing_versions")
    .select("id, version_number")
    .eq("drawing_id", drawingId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return NextResponse.json({ error: "Versionsnummer konnte nicht ermittelt werden" }, { status: 500 });
  }

  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

  // Find the current active version (latest non-archived) for marker copying + status inheritance
  const { data: currentActiveVersion } = await supabase
    .from("drawing_versions")
    .select("id, status_id")
    .eq("drawing_id", drawingId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Generate default label: current date in DD.MM.YYYY format
  const now = new Date();
  const defaultLabel = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  // Insert new version
  const { data: newVersion, error: insertError } = await supabase
    .from("drawing_versions")
    .insert({
      drawing_id: drawingId,
      version_number: nextVersionNumber,
      label: label ?? defaultLabel,
      storage_path,
      thumbnail_path: thumbnail_path ?? null,
      file_size,
      page_count: page_count ?? null,
      is_archived: false,
      created_by: user.id,
      status_id: currentActiveVersion?.status_id ?? null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Version konnte nicht erstellt werden" }, { status: 500 });
  }

  // Copy markers from the current active version (best-effort)
  let markersCopied = 0;
  let markerCopyFailed = false;

  if (currentActiveVersion) {
    try {
      // Fetch markers from the previous active version
      const { data: existingMarkers, error: markersError } = await supabase
        .from("markers")
        .select("drawing_id, target_drawing_id, project_id, name, page_number, x_percent, y_percent")
        .eq("drawing_version_id", currentActiveVersion.id);

      if (markersError) {
        markerCopyFailed = true;
      } else if (existingMarkers && existingMarkers.length > 0) {
        // Insert copied markers with new version ID
        const copiedMarkers = existingMarkers.map((m) => ({
          drawing_id: m.drawing_id,
          drawing_version_id: newVersion.id,
          target_drawing_id: m.target_drawing_id,
          project_id: m.project_id,
          name: m.name,
          page_number: m.page_number,
          x_percent: m.x_percent,
          y_percent: m.y_percent,
          created_by: user.id,
        }));

        const { error: copyError, data: copiedData } = await supabase
          .from("markers")
          .insert(copiedMarkers)
          .select("id");

        if (copyError) {
          markerCopyFailed = true;
        } else {
          markersCopied = copiedData?.length ?? 0;
        }
      }
    } catch {
      markerCopyFailed = true;
    }
  }

  // Log activity: version uploaded
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "version.uploaded",
    targetType: "version",
    targetId: newVersion.id,
    metadata: {
      drawing_name: drawing.display_name,
      version_number: nextVersionNumber,
    },
  });

  return NextResponse.json(
    {
      version: newVersion,
      markers_copied: markersCopied,
      marker_copy_failed: markerCopyFailed,
    },
    { status: 201 }
  );
}
