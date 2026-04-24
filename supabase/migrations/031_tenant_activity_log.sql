-- ============================================================
-- PROJ-25: Tenant-wide activity log
--
-- A separate, tenant-scoped audit table that survives the
-- deletion of the entities it references (in particular,
-- project hard-deletes). Unlike `public.activity_log` — which
-- is project-scoped and cascade-deleted together with the
-- project — rows here are kept even after the target object
-- is gone. Therefore `target_id` is intentionally NOT a
-- foreign key to `projects`.
--
-- Depends on: 010_multi_tenancy.sql (tenants), 001_profiles.sql
-- ============================================================

-- 1. Table
CREATE TABLE public.tenant_activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN (
    'project.deleted'
  )),
  target_type  TEXT NOT NULL CHECK (target_type IN (
    'project'
  )),
  target_id    UUID, -- no FK on purpose; the target may be gone
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
--    - primary query pattern: "most recent activity for my tenant"
--    - secondary: filter by action type across the tenant
CREATE INDEX idx_tenant_activity_log_tenant_created_at
  ON public.tenant_activity_log (tenant_id, created_at DESC);

CREATE INDEX idx_tenant_activity_log_action_created_at
  ON public.tenant_activity_log (action_type, created_at DESC);

CREATE INDEX idx_tenant_activity_log_user_id
  ON public.tenant_activity_log (user_id);

-- 3. Enable Row Level Security
ALTER TABLE public.tenant_activity_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
--
-- SELECT: active admins of the same tenant can read their tenant's log.
--         Non-admins have no access. Other tenants are invisible.
CREATE POLICY "Admins can read own tenant activity log"
  ON public.tenant_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.tenant_id = tenant_activity_log.tenant_id
        AND p.is_admin = true
        AND p.status = 'active'
    )
  );

-- INSERT / UPDATE / DELETE: intentionally no policies for authenticated users.
-- Writes happen exclusively via the service-role client in API routes,
-- which bypasses RLS. This keeps the log tamper-resistant from the client.

-- NOTE: no UPDATE / DELETE policies — audit rows are effectively immutable
-- from the application side.
