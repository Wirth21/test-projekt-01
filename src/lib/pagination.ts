/**
 * Shared pagination helper for API endpoints.
 *
 * Parses `page` and `limit` from URLSearchParams, enforces defaults (page=1, limit=50)
 * and a hard maximum (limit=100), and returns the Supabase `.range()` bounds.
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  from: number;
  to: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}

/**
 * Builds a standard pagination metadata object for API responses.
 */
export function paginationMeta(
  page: number,
  limit: number,
  total: number
): { page: number; limit: number; total: number; totalPages: number } {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
