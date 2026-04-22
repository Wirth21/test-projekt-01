-- Security hardening after the Supabase advisor flagged an unsecured public
-- table and a handful of functions with mutable search_path.
--
-- 1. Drop public._membership_audit + its trigger/function. This was a
--    temporary diagnostic log for the project_members cascade-delete
--    investigation (March 2026); never referenced by app code. Leaving it
--    in the public schema without RLS meant anyone with the anon key
--    could enumerate or tamper with historical membership changes.
DROP TRIGGER IF EXISTS audit_membership_delete ON public.project_members;
DROP FUNCTION IF EXISTS public.log_membership_delete();
DROP TABLE IF EXISTS public._membership_audit;

-- 2. Pin search_path on the remaining trigger helpers so they can't be
--    hijacked by a rogue schema further down the search path.
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_last_owner_removal() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_reserved_slugs() SET search_path = public, pg_temp;
