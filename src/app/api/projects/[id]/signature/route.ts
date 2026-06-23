import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/signature
//
// Cheap change-detection fingerprint for a project (see migration 043). The
// client polls this tiny value and only refetches the heavy drawings/markers
// lists when it changed — staying cache-first the ~99% of the time nothing
// changed. Membership is enforced here so signatures don't leak across projects.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId);
  if ("error" in accessResult) return accessResult.error;
  const { supabase } = accessResult.data;

  const { data, error } = await supabase.rpc("project_signature", {
    p_project_id: projectId,
  });

  if (error) {
    return NextResponse.json(
      { error: "Signatur konnte nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signature: (data as string | null) ?? "" });
}
