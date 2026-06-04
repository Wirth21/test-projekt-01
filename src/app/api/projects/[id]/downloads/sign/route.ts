import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/require-project-access";

/**
 * PROJ-29 — Batch-sign drawing PDFs for download.
 *
 * Resolves a download scope server-side to a concrete set of
 * `drawing_versions`, validates everything against the caller's project access
 * (same RLS the viewer uses — no client-supplied storage paths are trusted),
 * and returns short-lived signed URLs plus the relative path each file should
 * take inside the ZIP. The client streams the bytes itself (Browser↔Storage),
 * so this endpoint stays cheap and Free-plan friendly.
 *
 *  - "current"          → the current (latest active) version of one drawing
 *  - "current-versions" → all versions of one drawing
 *  - "all-current"      → the current version of every drawing in the project
 *  - "all-versions"     → all versions of every drawing in the project
 */

const bodySchema = z.object({
  scope: z.enum(["current", "current-versions", "all-current", "all-versions"]),
  drawingId: z.string().uuid().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Windows-/ZIP-safe path segment. Strips path separators, reserved chars and
// control chars, trims trailing dots/spaces, caps length, never empty.
function sanitizeSegment(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "unbenannt";
}

interface VersionRow {
  id: string;
  drawing_id: string;
  version_number: number;
  label: string;
  storage_path: string;
  file_size: number;
  is_archived: boolean;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { scope, drawingId } = parsed.data;
  const singleDrawingScope = scope === "current" || scope === "current-versions";
  if (singleDrawingScope && !drawingId) {
    return NextResponse.json({ error: "drawingId erforderlich" }, { status: 400 });
  }

  // Project name → ZIP filename root.
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  const projectName = sanitizeSegment(project?.name ?? "Projekt");

  // Drawings in scope (active only; archived drawings aren't downloadable here).
  let drawingsQuery = supabase
    .from("drawings")
    .select("id, display_name, group_id")
    .eq("project_id", projectId)
    .eq("is_archived", false);
  if (singleDrawingScope) drawingsQuery = drawingsQuery.eq("id", drawingId!);
  const { data: drawings, error: dErr } = await drawingsQuery.limit(1000);

  if (dErr) {
    return NextResponse.json({ error: "Zeichnungen konnten nicht geladen werden" }, { status: 500 });
  }
  if (!drawings || drawings.length === 0) {
    return NextResponse.json({ error: "Keine Zeichnungen gefunden" }, { status: 404 });
  }

  const drawingIds = drawings.map((d) => d.id);

  // Group id → name (for folder structure on the "all" scopes).
  const { data: groups } = await supabase
    .from("drawing_groups")
    .select("id, name")
    .eq("project_id", projectId);
  const groupNameById = new Map<string, string>();
  for (const g of groups ?? []) groupNameById.set(g.id, g.name);

  // Versions. For the "current" scopes we only need active versions; for the
  // "*-versions" scopes we include archived versions too.
  const wantAllVersions = scope === "current-versions" || scope === "all-versions";
  let vQuery = supabase
    .from("drawing_versions")
    .select("id, drawing_id, version_number, label, storage_path, file_size, is_archived")
    .in("drawing_id", drawingIds);
  if (!wantAllVersions) vQuery = vQuery.eq("is_archived", false);
  const { data: versions, error: vErr } = await vQuery
    .order("version_number", { ascending: false })
    .limit(5000);

  if (vErr) {
    return NextResponse.json({ error: "Versionen konnten nicht geladen werden" }, { status: 500 });
  }

  const byDrawing = new Map<string, VersionRow[]>();
  for (const v of (versions ?? []) as VersionRow[]) {
    const list = byDrawing.get(v.drawing_id) ?? [];
    list.push(v);
    byDrawing.set(v.drawing_id, list);
  }

  const includeGroupFolder = scope === "all-current" || scope === "all-versions";
  const usedNames = new Set<string>();
  const files: { path: string; zipEntryName: string; fileSize: number }[] = [];

  // Stable, alphabetical drawing order for a predictable ZIP layout.
  const orderedDrawings = [...drawings].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, "de", { numeric: true, sensitivity: "base" })
  );

  for (const d of orderedDrawings) {
    let dv = byDrawing.get(d.id) ?? [];
    if (dv.length === 0) continue;
    if (!wantAllVersions) dv = [dv[0]]; // highest version_number = current

    const dName = sanitizeSegment(d.display_name);
    const gName = d.group_id
      ? sanitizeSegment(groupNameById.get(d.group_id) ?? "Ohne Gruppe")
      : "Ohne Gruppe";

    for (const v of dv) {
      const segments: string[] = [];
      if (includeGroupFolder) segments.push(gName);
      if (wantAllVersions) {
        segments.push(dName);
        const label = v.label ? `_${sanitizeSegment(v.label)}` : "";
        segments.push(`${dName}_v${v.version_number}${label}.pdf`);
      } else {
        segments.push(`${dName}.pdf`);
      }

      // Dedupe within the ZIP (two drawings/versions could sanitise equal).
      const base = segments.join("/");
      let entry = base;
      let n = 2;
      while (usedNames.has(entry.toLowerCase())) {
        entry = base.replace(/\.pdf$/i, `_${n}.pdf`);
        n++;
      }
      usedNames.add(entry.toLowerCase());

      files.push({ path: v.storage_path, zipEntryName: entry, fileSize: v.file_size ?? 0 });
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Keine Dateien zum Herunterladen" }, { status: 404 });
  }

  const totalBytes = files.reduce((sum, f) => sum + (f.fileSize ?? 0), 0);

  // Single file → set Content-Disposition: attachment with a friendly name so
  // the cross-origin download works without a client-side blob round trip.
  if (scope === "current") {
    const f = files[0];
    const { data: signed, error } = await supabase.storage
      .from("drawings")
      .createSignedUrl(f.path, 3600, { download: f.zipEntryName });
    if (error || !signed) {
      return NextResponse.json({ error: "URL konnte nicht generiert werden" }, { status: 500 });
    }
    return NextResponse.json({
      single: true,
      fileName: f.zipEntryName,
      files: [{ signedUrl: signed.signedUrl, zipEntryName: f.zipEntryName }],
      count: 1,
      totalBytes,
    });
  }

  // Multi file → batch-sign; client zips.
  const { data: signedList, error: signErr } = await supabase.storage
    .from("drawings")
    .createSignedUrls(
      files.map((f) => f.path),
      3600
    );
  if (signErr || !signedList) {
    return NextResponse.json({ error: "URLs konnten nicht generiert werden" }, { status: 500 });
  }

  const urlByPath = new Map<string, string>();
  for (const item of signedList) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  const outFiles = files
    .map((f) => ({ signedUrl: urlByPath.get(f.path), zipEntryName: f.zipEntryName }))
    .filter((f): f is { signedUrl: string; zipEntryName: string } => Boolean(f.signedUrl));

  if (outFiles.length === 0) {
    return NextResponse.json({ error: "URLs konnten nicht generiert werden" }, { status: 500 });
  }

  const zipName =
    scope === "current-versions"
      ? `${projectName} - ${sanitizeSegment(drawings[0].display_name)}.zip`
      : `${projectName}.zip`;

  return NextResponse.json({
    single: false,
    zipName,
    files: outFiles,
    count: outFiles.length,
    totalBytes,
  });
}
