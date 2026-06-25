-- 045_codify_orphaned_security_definer_functions.sql
--
-- DRIFT-KORREKTUR (Audit Juni 2026): Die folgenden SECURITY-DEFINER-Funktionen
-- wurden direkt auf die Live-Instanz angewendet und fehlten in JEDER Migration.
-- Sie sind tragend für die Tenant-/Projekt-Isolation — RLS-Policies in den
-- Migrationen 020/023/026/030 rufen sie auf — d. h. ihr Quelltext war bisher
-- nicht versioniert, nicht reviewbar, und eine Neuanlage der DB aus den
-- Migrationen wäre fehlgeschlagen.
--
-- Diese Migration ist eine FAITHFUL SNAPSHOT der aktuellen Live-Definitionen
-- (1:1 aus pg_get_functiondef). Sie ist idempotent (CREATE OR REPLACE) und auf
-- die bestehende Instanz angewendet ein No-Op — sie verändert kein Verhalten,
-- sondern bringt nur den Quelltext zurück in die Versionskontrolle. Bestehende
-- EXECUTE-Grants bleiben erhalten (CREATE OR REPLACE setzt Grants nicht zurück).
--
-- HINWEIS GREENFIELD-REBUILD: Da Policies in 020–030 diese Funktionen
-- referenzieren, eine reine sequentielle Wiederholung der Migrationen aber erst
-- hier (045) die Funktionen anlegt, braucht ein echter Neuaufbau aus dem
-- Nullzustand entweder eine vorgezogene Anlage dieser Funktionen ODER eine
-- frische Schema-Baseline (`supabase db dump`). Für die laufende Instanz und
-- als reviewbare Quelle der Wahrheit ist dieser Snapshot maßgeblich.
--
-- search_path ist bewusst exakt wie live ('public'); SQL-Funktionen mit fixem
-- search_path sind gegen Schema-Hijack geschützt. Eine spätere Angleichung an
-- die Team-Konvention ('public, pg_temp') wäre verhaltensneutral.

-- ──────────────────────────────────────────────────────────────
-- Tenant-/Projekt-Zugriff (post-026 das zentrale Isolations-Gate)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    JOIN profiles pr ON pr.tenant_id = p.tenant_id AND pr.id = auth.uid()
    WHERE p.id = p_project_id
      AND (
        -- Non-guests: can access all tenant projects
        pr.tenant_role IN ('user', 'admin', 'viewer')
        OR
        -- Guests: must be explicit project member
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
        )
      )
  );
$function$;

-- ──────────────────────────────────────────────────────────────
-- Mitgliedschafts-/Eigentümer-Helfer (in RLS-Policies verwendet)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_is_project_member(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_project_owner(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$function$;

-- Ältere Helfer-Variante (gleiche Semantik; noch von Policies referenziert)
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role = 'owner'
  );
$function$;

-- ──────────────────────────────────────────────────────────────
-- Test-Helfer: harter Delete eines synthetischen Test-Projekts.
-- Wird in der Test-Suite genutzt (siehe Memory feedback_tests_synthetic_uuids
-- und feedback_vitest_file_parallelism). Schutz: nur 00000000-…-UUIDs.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.force_delete_test_project(p_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Safety: only allow deletion of test projects (synthetic UUIDs)
  IF p_project_id::text NOT LIKE '00000000-%' THEN
    RAISE EXCEPTION 'force_delete_test_project only works on synthetic test UUIDs';
  END IF;

  -- Disable protective triggers
  ALTER TABLE project_members DISABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE project_members DISABLE TRIGGER prevent_owner_leave_trigger;

  -- Delete all related data
  DELETE FROM markers WHERE project_id = p_project_id;
  DELETE FROM drawing_versions WHERE drawing_id IN (SELECT id FROM drawings WHERE project_id = p_project_id);
  DELETE FROM drawings WHERE project_id = p_project_id;
  DELETE FROM drawing_groups WHERE project_id = p_project_id;
  DELETE FROM activity_log WHERE project_id = p_project_id;
  DELETE FROM project_members WHERE project_id = p_project_id;
  DELETE FROM projects WHERE id = p_project_id;

  -- Re-enable triggers
  ALTER TABLE project_members ENABLE TRIGGER check_last_owner_before_delete;
  ALTER TABLE project_members ENABLE TRIGGER prevent_owner_leave_trigger;
END;
$function$;
