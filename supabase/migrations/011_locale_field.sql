-- ============================================================
-- PROJ-12: Add locale preference to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN locale VARCHAR(5) NOT NULL DEFAULT 'de'
  CHECK (locale IN ('de', 'en'));
