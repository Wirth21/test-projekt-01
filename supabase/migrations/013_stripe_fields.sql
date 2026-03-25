-- Add Stripe fields to tenants table
ALTER TABLE public.tenants
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  ADD COLUMN current_period_end TIMESTAMPTZ;

CREATE INDEX idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id);
CREATE INDEX idx_tenants_stripe_subscription_id ON public.tenants(stripe_subscription_id);
