-- Performance: wrap auth.uid() in (select auth.uid()) so Postgres evaluates it
-- once per query instead of once per row. Pure rewrite — semantics unchanged.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ================================================================
-- activity_log
-- ================================================================
DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_log;
CREATE POLICY "Admins can read all activity logs"
  ON public.activity_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.is_admin = true
      AND profiles.status = 'active'
  ));

DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.activity_log;
CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ================================================================
-- drawing_groups
-- ================================================================
DROP POLICY IF EXISTS "Tenant members can create drawing groups" ON public.drawing_groups;
CREATE POLICY "Tenant members can create drawing groups"
  ON public.drawing_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND user_can_access_project(project_id));

-- ================================================================
-- drawing_statuses
-- ================================================================
DROP POLICY IF EXISTS "Tenant members can view statuses" ON public.drawing_statuses;
CREATE POLICY "Tenant members can view statuses"
  ON public.drawing_statuses FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE profiles.id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can insert statuses" ON public.drawing_statuses;
CREATE POLICY "Admins can insert statuses"
  ON public.drawing_statuses FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE profiles.id = (SELECT auth.uid()))
    AND (SELECT is_admin FROM public.profiles WHERE profiles.id = (SELECT auth.uid())) = true
  );

DROP POLICY IF EXISTS "Admins can update statuses" ON public.drawing_statuses;
CREATE POLICY "Admins can update statuses"
  ON public.drawing_statuses FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE profiles.id = (SELECT auth.uid()))
    AND (SELECT is_admin FROM public.profiles WHERE profiles.id = (SELECT auth.uid())) = true
  );

DROP POLICY IF EXISTS "Admins can delete statuses" ON public.drawing_statuses;
CREATE POLICY "Admins can delete statuses"
  ON public.drawing_statuses FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE profiles.id = (SELECT auth.uid()))
    AND (SELECT is_admin FROM public.profiles WHERE profiles.id = (SELECT auth.uid())) = true
  );

-- ================================================================
-- drawing_versions
-- ================================================================
DROP POLICY IF EXISTS "Tenant members can insert drawing versions" ON public.drawing_versions;
CREATE POLICY "Tenant members can insert drawing versions"
  ON public.drawing_versions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.drawings d
      WHERE d.id = drawing_versions.drawing_id
        AND user_can_access_project(d.project_id)
    )
  );

-- ================================================================
-- drawings
-- ================================================================
DROP POLICY IF EXISTS "Tenant project members can insert drawings" ON public.drawings;
CREATE POLICY "Tenant project members can insert drawings"
  ON public.drawings FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()) AND user_can_access_project(project_id));

-- ================================================================
-- markers
-- ================================================================
DROP POLICY IF EXISTS "Tenant members can create markers" ON public.markers;
CREATE POLICY "Tenant members can create markers"
  ON public.markers FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND user_can_access_project(project_id));

-- ================================================================
-- profiles
-- ================================================================
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ================================================================
-- project_members
-- ================================================================
DROP POLICY IF EXISTS "Members can leave project" ON public.project_members;
CREATE POLICY "Members can leave project"
  ON public.project_members FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "Project creator can add self as owner" ON public.project_members;
CREATE POLICY "Project creator can add self as owner"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = (SELECT auth.uid())
        AND p.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "Users can self-join tenant projects" ON public.project_members;
CREATE POLICY "Users can self-join tenant projects"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = current_tenant_id()
        AND p.is_archived = false
    )
  );

-- ================================================================
-- projects
-- ================================================================
DROP POLICY IF EXISTS "Tenant users can view projects" ON public.projects;
CREATE POLICY "Tenant users can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    (
      tenant_id = current_tenant_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.tenant_role = 'guest'
      )
    )
    OR (
      user_is_project_member(id)
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.tenant_role = 'guest'
          AND profiles.tenant_id = projects.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "Project owner can update project" ON public.projects;
CREATE POLICY "Project owner can update project"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (created_by = (SELECT auth.uid()) OR is_admin())
  )
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.tenant_role = 'user'
    )
  );

-- ================================================================
-- tenants
-- ================================================================
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
CREATE POLICY "Users can view own tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (id = (SELECT tenant_id FROM public.profiles WHERE profiles.id = (SELECT auth.uid())));
