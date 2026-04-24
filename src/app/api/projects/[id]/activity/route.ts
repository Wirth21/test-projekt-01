import { NextResponse } from "next/server";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/activity — list activity log entries with pagination and filters
export async function GET(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const result = await requireProjectAccess(projectId);
  if ("error" in result) return result.error;
  const { supabase } = result.data;

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const { page, limit, from, to } = parsePagination(searchParams);
  const actionType = searchParams.get("action_type");
  const userId = searchParams.get("user_id");

  // Build query
  let query = supabase
    .from("activity_log")
    .select("*", { count: "exact", head: false })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(from, to);

  // Client may send a comma-separated list (e.g. "drawing.uploaded,drawing.renamed")
  // to filter by a group of related action types. Use `.in()` for multi-value
  // filters and fall back to `.eq()` for single values.
  if (actionType) {
    const types = actionType.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      query = query.eq("action_type", types[0]);
    } else if (types.length > 1) {
      query = query.in("action_type", types);
    }
  }

  // Users filter: accept comma-separated to allow multi-select in the UI.
  if (userId) {
    const ids = userId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 1) {
      query = query.eq("user_id", ids[0]);
    } else if (ids.length > 1) {
      query = query.in("user_id", ids);
    }
  }

  const { data: entries, error: fetchError, count } = await query;

  if (fetchError) {
    return NextResponse.json({ error: "Änderungsprotokoll konnte nicht geladen werden" }, { status: 500 });
  }

  const total = count ?? 0;

  return NextResponse.json({
    entries: entries ?? [],
    pagination: paginationMeta(page, limit, total),
  });
}
