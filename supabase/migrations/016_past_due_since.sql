-- Add past_due_since to track grace period start for failed payments
ALTER TABLE public.tenants
  ADD COLUMN past_due_since TIMESTAMPTZ;

COMMENT ON COLUMN public.tenants.past_due_since IS 'Timestamp when subscription entered past_due status. Used for 7-day grace period before auto-downgrade.';
