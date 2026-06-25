import { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS, type PlanLimits } from "./plan-limits";
import type { PlanType } from "@/lib/types/tenant";

export interface TenantUsage {
  storageBytes: number;
  userCount: number;
  projectCount: number;
}

export async function getTenantUsage(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantUsage> {
  // Count users (non-deleted)
  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("status", "deleted");

  // Count projects
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // Sum storage from drawing_versions via drawings via projects
  const { data: storageData } = await supabase.rpc(
    "get_tenant_storage_bytes",
    { p_tenant_id: tenantId }
  );

  return {
    storageBytes: storageData ?? 0,
    userCount: userCount ?? 0,
    projectCount: projectCount ?? 0,
  };
}

export function getLimitsForPlan(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanType] ?? PLAN_LIMITS.free;
}

export async function checkStorageLimit(
  supabase: SupabaseClient,
  tenantId: string,
  plan: string,
  additionalBytes: number
): Promise<{ allowed: boolean; currentBytes: number; maxBytes: number }> {
  const limits = getLimitsForPlan(plan);
  const usage = await getTenantUsage(supabase, tenantId);
  return {
    allowed: usage.storageBytes + additionalBytes <= limits.maxStorageBytes,
    currentBytes: usage.storageBytes,
    maxBytes: limits.maxStorageBytes,
  };
}

export function checkFileSize(
  plan: string,
  fileSize: number
): { allowed: boolean; maxBytes: number } {
  const limits = getLimitsForPlan(plan);
  return {
    allowed: fileSize <= limits.maxFileSizeBytes,
    maxBytes: limits.maxFileSizeBytes,
  };
}

/**
 * Reads the authoritative byte size of an already-uploaded Storage object.
 *
 * Uploads go directly client -> Supabase Storage; the client then reports
 * `file_size` in the metadata call. Trusting that number lets a client
 * understate the size to bypass per-file and tenant storage quotas (and
 * corrupts usage accounting). Read the real size from Storage instead.
 *
 * Returns the size in bytes, or null if the object can't be found.
 */
export async function getStorageObjectSize(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string
): Promise<number | null> {
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const filename = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { search: filename, limit: 100 });
  if (error || !data) return null;

  const obj = data.find((o) => o.name === filename);
  const size = (obj?.metadata as { size?: number } | null | undefined)?.size;
  return typeof size === "number" ? size : null;
}
