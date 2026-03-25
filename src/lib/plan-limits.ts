import type { PlanType } from "@/lib/types/tenant";

export interface PlanLimits {
  maxStorageBytes: number;
  maxFileSizeBytes: number;
  maxUsers: number;
  maxProjects: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxStorageBytes: 500 * 1024 * 1024, // 500 MB
    maxFileSizeBytes: 20 * 1024 * 1024, // 20 MB
    maxUsers: 2,
    maxProjects: 1,
  },
  team: {
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
    maxUsers: 10,
    maxProjects: 10,
  },
  business: {
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
    maxUsers: 50,
    maxProjects: 9999,
  },
  enterprise: {
    maxStorageBytes: 500 * 1024 * 1024 * 1024, // 500 GB
    maxFileSizeBytes: 200 * 1024 * 1024, // 200 MB
    maxUsers: 9999,
    maxProjects: 9999,
  },
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
