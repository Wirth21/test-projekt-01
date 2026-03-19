-- ============================================================
-- PROJ-5: Admin panel — is_admin flag, status column, RLS updates
-- Depends on: 001_profiles.sql, 002_projects.sql
-- ============================================================

-- ============================================================
-- 1. Add is_admin and status columns to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'disabled', 'deleted'));

-- ============================================================
-- 2. Indexes for new columns
-- ============================================================

CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_is_admin ON public.profiles(is_admin);

-- ============================================================
-- 3. Update RLS policies on profiles for admin access
-- ============================================================

-- Drop existing SELECT policy — replace with one that shows
-- all profiles to admins but only active profiles to regular users
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Admins can see ALL profiles (including pending, disabled, deleted)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Regular authenticated users can only see active profiles
CREATE POLICY "Users can view active profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    OR id = auth.uid()
  );

-- Drop existing UPDATE policy — replace with admin + self-update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can update their own profile (display_name only — status/is_admin
-- are protected by the API layer, not updatable via direct client queries)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile (for status changes, admin flag)
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ============================================================
-- 4. Admin RLS policies for projects (admin can see all projects)
-- ============================================================

-- Admins can view all projects (for user-project management)
CREATE POLICY "Admins can view all projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 5. Admin RLS policies for project_members
-- ============================================================

-- Admins can view all project memberships
CREATE POLICY "Admins can view all project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admins can add members to any project
CREATE POLICY "Admins can add members to any project"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admins can remove members from any project
CREATE POLICY "Admins can remove members from any project"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 6. Update handle_new_user trigger to set status = 'pending'
--    (new users start as pending, must be approved by admin)
--    Also fix SECURITY DEFINER search_path (QA BUG-9 from PROJ-1)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, status, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    'pending',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 7. Seed admin user
--    Sets the existing profile for f.stoeckel@wirth-chemnitz.de
--    as admin with active status.
--    If the user does not exist yet, this is a no-op.
-- ============================================================

UPDATE public.profiles
SET is_admin = true, status = 'active'
WHERE email = 'f.stoeckel@wirth-chemnitz.de';

-- ============================================================
-- 8. Set all existing users to 'active' status
--    (users who registered before the admin panel was added
--    should not be locked out)
-- ============================================================

UPDATE public.profiles
SET status = 'active'
WHERE status = 'pending'
  AND email != 'f.stoeckel@wirth-chemnitz.de';

-- ============================================================
-- 9. Helper function: check if current user is admin
--    Used by API routes and RLS policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
