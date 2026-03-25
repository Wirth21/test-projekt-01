export type PlanType = "free" | "team" | "business" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status: string;
  current_period_end?: string | null;
  created_at: string;
  updated_at: string;
}
