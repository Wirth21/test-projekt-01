export type PlanType = "free" | "team" | "business" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
