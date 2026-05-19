-- 041_revoke_trigger_functions.sql
--
-- Widerruft EXECUTE auf SECURITY-DEFINER-Funktionen, die ausschliesslich
-- als Trigger oder mit service_role aufgerufen werden. Davor waren sie
-- per /rest/v1/rpc/<name> auch fuer anon und authenticated erreichbar
-- (Supabase-Advisor: anon_security_definer_function_executable,
--  authenticated_security_definer_function_executable).
--
-- Funktionen die weiterhin oeffentlich aufrufbar bleiben muessen
-- (is_admin, is_project_member, current_tenant_id, project_stats, etc.)
-- sind hier bewusst nicht enthalten.

revoke execute on function public.handle_new_user()
  from anon, authenticated, public;

revoke execute on function public.prevent_owner_leave()
  from anon, authenticated, public;

revoke execute on function public.prevent_privilege_escalation()
  from anon, authenticated, public;

revoke execute on function public.check_markers_same_project()
  from anon, authenticated, public;

revoke execute on function public.force_delete_test_project(p_project_id uuid)
  from anon, authenticated, public;

-- service_role behaelt EXECUTE (Default fuer SECURITY DEFINER); keine
-- explizite GRANT noetig. Trigger-Aufrufe sind von GRANTs unabhaengig.
