-- ============================================================
-- PROJ-10: Multi-Tenancy — tenants table, tenant_id columns,
--          updated RLS policies for tenant isolation
-- Depends on: 001-009 (all prior migrations)
-- ============================================================

-- ============================================================
-- 1. Create tenants table
-- ============================================================
CREATE TABLE public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'),
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'team', 'business', 'enterprise')),
  settings   JSONB DEFAULT '{}'::jsonb,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reserved slugs constraint (enforced via trigger)
CREATE OR REPLACE FUNCTION public.check_reserved_slugs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug = ANY(ARRAY[
    'www', 'app', 'api', 'admin', 'mail', 'support', 'help',
    'status', 'blog', 'login', 'auth', 'dashboard', 'register',
    'billing', 'docs', 'static', 'assets', 'cdn', 'img',
    'ftp', 'smtp', 'pop', 'imap', 'ns1', 'ns2'
  ]) THEN
    RAISE EXCEPTION 'Subdomain "%" ist reserviert', NEW.slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_reserved_slugs_trigger
  BEFORE INSERT OR UPDATE OF slug ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reserved_slugs();

-- Updated_at trigger
CREATE TRIGGER on_tenants_updated
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_is_active ON public.tenants(is_active);
CREATE INDEX idx_tenants_plan ON public.tenants(plan);

-- RLS for tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own tenant
CREATE POLICY "Users can view own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for regular users — managed by superadmins via service role

-- ============================================================
-- 2. Helper function: get current user's tenant_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. Add tenant_id to profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Index for tenant lookups
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- ============================================================
-- 4. Add tenant_id to projects
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Index for tenant lookups
CREATE INDEX idx_projects_tenant_id ON public.projects(tenant_id);

-- ============================================================
-- 5. Migrate existing data: create a default tenant and assign
-- ============================================================
DO $$
DECLARE
  v_default_tenant_id UUID;
BEGIN
  -- Only create default tenant if there are existing profiles
  IF EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN
    INSERT INTO public.tenants (name, slug, plan)
    VALUES ('Default', 'default', 'team')
    RETURNING id INTO v_default_tenant_id;

    -- Assign all existing profiles to default tenant
    UPDATE public.profiles SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;

    -- Assign all existing projects to default tenant
    UPDATE public.projects SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- Now make tenant_id NOT NULL
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================
-- 6. Update handle_new_user() to include tenant_id
--    (tenant_id must be passed via user metadata at signup)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, tenant_id, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 7. Drop ALL existing RLS policies and recreate with tenant isolation
-- ============================================================

-- ----- PROFILES -----
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- SELECT: Users see profiles in their tenant; admins see all in their tenant
CREATE POLICY "Tenant users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
  );

-- INSERT: Only via trigger (handle_new_user), or service role
CREATE POLICY "System can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can update own profile; tenant admins can update any in their tenant
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Tenant admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- ----- PROJECTS -----
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Project owner can update project" ON public.projects;

-- SELECT: Users see projects they are members of, scoped to their tenant
CREATE POLICY "Tenant members can view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
      )
      OR public.is_admin()
    )
  );

-- INSERT: Authenticated users can create projects in their tenant
CREATE POLICY "Tenant users can create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND created_by = auth.uid()
  );

-- UPDATE: Project owner can update, scoped to tenant
CREATE POLICY "Project owner can update project"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      created_by = auth.uid()
      OR public.is_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- ----- PROJECT_MEMBERS -----
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins can view all project members" ON public.project_members;
DROP POLICY IF EXISTS "Project creator can add self as owner" ON public.project_members;
DROP POLICY IF EXISTS "Project owner can add members" ON public.project_members;
DROP POLICY IF EXISTS "Admins can add members to any project" ON public.project_members;
DROP POLICY IF EXISTS "Owner can remove members" ON public.project_members;
DROP POLICY IF EXISTS "Members can leave project" ON public.project_members;
DROP POLICY IF EXISTS "Admins can remove any member" ON public.project_members;

-- SELECT: Members of projects in own tenant
CREATE POLICY "Tenant members can view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.project_members pm2
        WHERE pm2.project_id = project_members.project_id
          AND pm2.user_id = auth.uid()
      )
      OR public.is_admin()
    )
  );

-- INSERT: Project creator self-add or owner adds members
CREATE POLICY "Project creator can add self as owner"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
        AND p.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY "Project owner can add members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
    -- Invited user must belong to the same tenant
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = project_members.user_id
        AND pr.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY "Admins can add members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

-- DELETE: Owner can remove members, members can self-remove
CREATE POLICY "Owner can remove members"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY "Members can leave project"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY "Admins can remove any member"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

-- ----- DRAWINGS -----
DROP POLICY IF EXISTS "Project members can view drawings" ON public.drawings;
DROP POLICY IF EXISTS "Project members can insert drawings" ON public.drawings;
DROP POLICY IF EXISTS "Project members can update drawings" ON public.drawings;

CREATE POLICY "Tenant project members can view drawings"
  ON public.drawings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawings.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant project members can insert drawings"
  ON public.drawings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawings.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant project members can update drawings"
  ON public.drawings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawings.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawings.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

-- ----- DRAWING_VERSIONS -----
DROP POLICY IF EXISTS "Project members can view drawing versions" ON public.drawing_versions;
DROP POLICY IF EXISTS "Project members can insert drawing versions" ON public.drawing_versions;
DROP POLICY IF EXISTS "Project members can update drawing versions" ON public.drawing_versions;

CREATE POLICY "Tenant members can view drawing versions"
  ON public.drawing_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.projects p ON p.id = d.project_id
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE d.id = drawing_versions.drawing_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert drawing versions"
  ON public.drawing_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.projects p ON p.id = d.project_id
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE d.id = drawing_versions.drawing_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can update drawing versions"
  ON public.drawing_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.projects p ON p.id = d.project_id
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE d.id = drawing_versions.drawing_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drawings d
      JOIN public.projects p ON p.id = d.project_id
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE d.id = drawing_versions.drawing_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

-- ----- DRAWING_GROUPS -----
DROP POLICY IF EXISTS "Project members can view drawing groups" ON public.drawing_groups;
DROP POLICY IF EXISTS "Project members can create drawing groups" ON public.drawing_groups;
DROP POLICY IF EXISTS "Project members can update drawing groups" ON public.drawing_groups;

CREATE POLICY "Tenant members can view drawing groups"
  ON public.drawing_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawing_groups.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can create drawing groups"
  ON public.drawing_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawing_groups.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can update drawing groups"
  ON public.drawing_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawing_groups.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = drawing_groups.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

-- ----- MARKERS -----
DROP POLICY IF EXISTS "Project members can view markers" ON public.markers;
DROP POLICY IF EXISTS "Project members can create markers" ON public.markers;
DROP POLICY IF EXISTS "Project members can update markers" ON public.markers;
DROP POLICY IF EXISTS "Project members can delete markers" ON public.markers;

CREATE POLICY "Tenant members can view markers"
  ON public.markers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = markers.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can create markers"
  ON public.markers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = markers.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can update markers"
  ON public.markers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = markers.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = markers.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can delete markers"
  ON public.markers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = markers.project_id
        AND p.tenant_id = public.current_tenant_id()
        AND pm.user_id = auth.uid()
    )
  );

-- ============================================================
-- 8. Update is_admin() to be tenant-scoped
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 9. Add is_superadmin to profiles (for global platform admins)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_profiles_is_superadmin ON public.profiles(is_superadmin);

-- Update privilege escalation trigger to also protect is_superadmin
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Nur Admins duerfen Admin-Status aendern';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Nur Admins duerfen den Status aendern';
    END IF;
  END IF;
  -- Only superadmins can grant superadmin
  IF NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin THEN
    IF NOT (SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()) THEN
      RAISE EXCEPTION 'Nur Superadmins duerfen Superadmin-Status aendern';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
