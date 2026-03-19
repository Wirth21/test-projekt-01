-- ============================================================
-- PROJ-5 Security fix: prevent privilege escalation via RLS
-- BUG-12: Users could update is_admin/status on their own row
-- ============================================================

-- Trigger function: block non-admins from changing protected columns
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If the caller is an admin, allow all changes
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Block changes to is_admin
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Keine Berechtigung: is_admin kann nicht geaendert werden';
  END IF;

  -- Block changes to status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Keine Berechtigung: status kann nicht geaendert werden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS prevent_privilege_escalation_trigger ON public.profiles;

CREATE TRIGGER prevent_privilege_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();
