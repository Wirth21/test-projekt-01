-- Phase 5: Allow admin password-reset events in the tenant audit log.
-- Extends the existing CHECK constraints; no table-data migration needed.

ALTER TABLE public.tenant_activity_log
  DROP CONSTRAINT IF EXISTS tenant_activity_log_action_type_check;

ALTER TABLE public.tenant_activity_log
  ADD CONSTRAINT tenant_activity_log_action_type_check
  CHECK (action_type IN ('project.deleted', 'user.password_reset_by_admin'));

ALTER TABLE public.tenant_activity_log
  DROP CONSTRAINT IF EXISTS tenant_activity_log_target_type_check;

ALTER TABLE public.tenant_activity_log
  ADD CONSTRAINT tenant_activity_log_target_type_check
  CHECK (target_type IN ('project', 'user'));
