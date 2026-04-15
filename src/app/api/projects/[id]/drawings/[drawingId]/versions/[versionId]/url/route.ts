import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string; drawingId: string; versionId: string }>;
}

// GET /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/url — signed URL for a version's PDF
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId, drawingId, versionId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  // Fetch the version with its drawing to verify project ownership
  const { data: version, error: versionError } = await supabase
    .from("drawing_versions")
    .select(`
      id,
      storage_path,
      drawing_id,
      drawings!inner ( project_id )
    `)
    .eq("id", versionId)
    .eq("drawing_id", drawingId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version nicht gefunden" }, { status: 404 });
  }

  const drawingData = version.drawings as unknown as { project_id: string };
  if (drawingData.project_id !== projectId) {
    return NextResponse.json({ error: "Version gehört nicht zu diesem Projekt" }, { status: 403 });
  }

  // Generate signed URL (1 hour = 3600 seconds)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from("drawings")
    .createSignedUrl(version.storage_path, 3600);

  if (urlError || !signedUrlData) {
    return NextResponse.json({ error: "URL konnte nicht generiert werden" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrlData.signedUrl });
}
