-- ============================================================
-- Security fix: Add SET search_path to SECURITY DEFINER functions
-- Fixes PROJ-4 BUG-4 (check_markers_same_project)
-- ============================================================

-- Fix check_markers_same_project to include search_path
CREATE OR REPLACE FUNCTION public.check_markers_same_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.drawings
    WHERE id = NEW.drawing_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Source drawing does not belong to the specified project';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drawings
    WHERE id = NEW.target_drawing_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Target drawing does not belong to the specified project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Fix: Prevent owner from leaving their own project
-- Fixes PROJ-2 BUG-6 (owner leave creates orphaned project)
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_owner_leave()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Der Eigentümer kann das Projekt nicht verlassen';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_owner_leave_trigger ON public.project_members;

CREATE TRIGGER prevent_owner_leave_trigger
  BEFORE DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_leave();
