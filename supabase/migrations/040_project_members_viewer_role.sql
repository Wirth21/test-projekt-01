-- ============================================================
-- Allow tenant-viewers to self-join projects with role='viewer'.
-- Extends project_members.role CHECK to include 'viewer'.
-- Depends on: 002_projects.sql
-- ============================================================

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_role_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('owner', 'member', 'viewer'));
