-- 044_security_harden_tenant_and_stat_rpcs.sql
--
-- Behebt zwei bestätigte, UNAUTHENTIFIZIERTE Datenpreisgaben aus dem
-- Sicherheits-Audit (Juni 2026). Der NEXT_PUBLIC_SUPABASE_ANON_KEY steckt im
-- Client-Bundle und ist damit öffentlich — alles, was die `anon`-Rolle lesen/
-- aufrufen darf, ist faktisch für jeden im Internet erreichbar.
--
--  1) tenants: Policy "Anyone can look up tenant by slug" hatte USING(true) für
--     anon. Damit konnte JEDER ohne Login `GET /rest/v1/tenants?select=*` machen
--     und die komplette Mandantenliste inkl. name, plan, stripe_customer_id,
--     stripe_subscription_id, subscription_status auslesen.
--     -> Policy ersatzlos entfernen. Es gibt keinen anonymen Slug-Lookup in der
--        App (Registrierung ist deaktiviert; Tenant-Kontext kommt aus dem
--        Profil, nicht aus der Subdomain). Eingeloggte Nutzer behalten
--        "Users can view own tenant". Falls je ein unauth. Slug-Lookup nötig
--        wird: eine SECURITY-DEFINER-Funktion bauen, die NUR (id, slug,
--        is_active) zurückgibt — niemals die ganze Zeile wieder für anon öffnen.
--
--  2) Stat-RPCs: get_tenant_storage_bytes / project_stats / project_stats_batch /
--     project_signature / project_{drawing,marker,member}_count sind
--     SECURITY DEFINER (umgehen RLS), nahmen aber eine BELIEBIGE id entgegen
--     ohne den Zugriff des Aufrufers zu prüfen, und waren per PUBLIC-Default
--     auch für anon via /rest/v1/rpc/... aufrufbar. Damit ließen sich Speicher,
--     Zähler und Änderungs-Signaturen JEDES Mandanten/Projekts per UUID-
--     Iteration auslesen.
--     -> (a) interner Access-Guard (current_tenant_id() bzw.
--            user_can_access_project()), sodass ein eingeloggter Nutzer nur
--            Daten zu eigenen Mandanten/Projekten erhält;
--        (b) EXECUTE von PUBLIC entziehen und gezielt nur authenticated +
--            service_role gewähren (anon hat danach keinen Pfad mehr).
--     Alle legitimen Aufrufer nutzen den authentifizierten Client auf EIGENE
--     Mandanten/Projekte, der Guard ist für sie transparent.
--
-- Die Hilfsfunktionen is_admin() / current_tenant_id() / user_can_access_project()
-- sind ebenfalls anon-aufrufbar, aber UNGEFÄHRLICH: sie lesen intern auth.uid()
-- und spiegeln nur den Zugriff des Aufrufers — sie werden hier bewusst NICHT
-- angefasst, weil RLS-Policies sie während der Auswertung aufrufen.

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. tenants: anon-lesbare USING(true)-Policy entfernen
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can look up tenant by slug" ON public.tenants;

-- ──────────────────────────────────────────────────────────────
-- 2a. get_tenant_storage_bytes — nur eigener Mandant
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tenant_storage_bytes(p_tenant_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(dv.file_size), 0)::BIGINT
  FROM public.drawing_versions dv
  JOIN public.drawings d ON d.id = dv.drawing_id
  JOIN public.projects p ON p.id = d.project_id
  WHERE p.tenant_id = p_tenant_id
    AND p_tenant_id = public.current_tenant_id();  -- Guard: nur eigener Mandant
$$;

-- ──────────────────────────────────────────────────────────────
-- 2b. project_stats — nur zugängliche Projekte
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.project_stats(p_project_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.user_can_access_project(p_project_id) THEN
    json_build_object(
      'drawing_count', (
        SELECT COUNT(*)::INTEGER FROM public.drawings
        WHERE project_id = p_project_id AND is_archived = false
      ),
      'marker_count', (
        SELECT COUNT(*)::INTEGER FROM public.markers
        WHERE project_id = p_project_id
      ),
      'member_count', (
        SELECT COUNT(*)::INTEGER FROM public.project_members
        WHERE project_id = p_project_id
      )
    )
  ELSE NULL END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2c. project_stats_batch — auf zugängliche Projekte filtern
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.project_stats_batch(p_project_ids uuid[])
RETURNS TABLE(project_id uuid, drawing_count integer, marker_count integer, member_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    p.id AS project_id,
    COALESCE(d.cnt, 0)::integer  AS drawing_count,
    COALESCE(m.cnt, 0)::integer  AS marker_count,
    COALESCE(pm.cnt, 0)::integer AS member_count
  FROM unnest(p_project_ids) AS p(id)
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.drawings
    WHERE is_archived = false AND project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) d ON d.project_id = p.id
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.markers
    WHERE project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) m ON m.project_id = p.id
  LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM public.project_members
    WHERE project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) pm ON pm.project_id = p.id
  WHERE public.user_can_access_project(p.id);  -- Guard: nur zugängliche Projekte
$$;

-- ──────────────────────────────────────────────────────────────
-- 2d. project_signature — nur zugängliche Projekte
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.project_signature(p_project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.user_can_access_project(p_project_id) THEN
       coalesce((SELECT max(updated_at) FROM public.drawings
                 WHERE project_id = p_project_id)::text, '-')
    || '/' || (SELECT count(*) FROM public.drawings
               WHERE project_id = p_project_id)::text
    || '|' || coalesce((SELECT max(updated_at) FROM public.markers
                        WHERE project_id = p_project_id)::text, '-')
    || '/' || (SELECT count(*) FROM public.markers
               WHERE project_id = p_project_id)::text
    || '|' || coalesce((SELECT max(dv.updated_at)
                        FROM public.drawing_versions dv
                        JOIN public.drawings d ON d.id = dv.drawing_id
                        WHERE d.project_id = p_project_id)::text, '-')
    || '/' || (SELECT count(*)
               FROM public.drawing_versions dv
               JOIN public.drawings d ON d.id = dv.drawing_id
               WHERE d.project_id = p_project_id)::text
  ELSE NULL END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2e. Einzel-Zähler (von der App ungenutzt) — Guard + Lockdown
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.project_drawing_count(p_project_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.user_can_access_project(p_project_id)
    THEN (SELECT COUNT(*)::INTEGER FROM public.drawings
          WHERE project_id = p_project_id AND is_archived = false)
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.project_marker_count(p_project_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.user_can_access_project(p_project_id)
    THEN (SELECT COUNT(*)::INTEGER FROM public.markers
          WHERE project_id = p_project_id)
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.project_member_count(p_project_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.user_can_access_project(p_project_id)
    THEN (SELECT COUNT(*)::INTEGER FROM public.project_members
          WHERE project_id = p_project_id)
    ELSE NULL END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2f. EXECUTE von PUBLIC/anon entziehen, gezielt neu gewähren.
--     CREATE OR REPLACE setzt Grants NICHT zurück, daher hier explizit.
--     REVOKE FROM PUBLIC ist nötig, weil der Postgres-Default EXECUTE an
--     PUBLIC gewährt (und PUBLIC schließt anon ein) — ein reines
--     "REVOKE FROM anon" wäre wirkungslos.
-- ──────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_tenant_storage_bytes(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_stats(uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_stats_batch(uuid[])    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_signature(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_drawing_count(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_marker_count(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_member_count(uuid)     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_tenant_storage_bytes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_stats(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_stats_batch(uuid[])    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_signature(uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_drawing_count(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_marker_count(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_member_count(uuid)     TO authenticated, service_role;

COMMIT;
