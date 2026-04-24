-- Re-align `version_number` with the user-visible stack order and drop the
-- now-redundant `sort_order` column.
--
-- Until now the UI treated the topmost (highest `sort_order`) row as "current"
-- while `version_number` stayed stable as an identifier. Users expect both to
-- mean the same thing: the top of the stack *is* the highest number. Moving a
-- version up renames it instead of shuffling an invisible column.
--
-- Data migration rewrites `version_number` per drawing so that the current
-- display order (sort_order DESC, version_number DESC tie-breaker) maps to
-- DESC version_number. The unique index (drawing_id, version_number) is
-- dropped for the duration of the rewrite and re-created afterwards.
--
-- Also creates an RPC to atomically swap two versions' numbers without
-- transiently violating the unique index. Restricted to service_role so the
-- API route stays the auth boundary.

BEGIN;

-- 1. Drop the unique index so we can rewrite numbers without transient
--    collisions.
DROP INDEX IF EXISTS public.idx_drawing_versions_unique_number;

-- 2. Renumber per drawing: topmost row (highest sort_order, then
--    highest version_number) gets the max new number, bottom gets 1.
WITH ranked AS (
  SELECT
    id,
    drawing_id,
    ROW_NUMBER() OVER (
      PARTITION BY drawing_id
      ORDER BY sort_order DESC, version_number DESC
    ) AS desc_rank,
    COUNT(*) OVER (PARTITION BY drawing_id) AS total
  FROM public.drawing_versions
)
UPDATE public.drawing_versions v
SET version_number = ranked.total - ranked.desc_rank + 1
FROM ranked
WHERE v.id = ranked.id;

-- 3. Re-create the unique index.
CREATE UNIQUE INDEX idx_drawing_versions_unique_number
  ON public.drawing_versions (drawing_id, version_number);

-- 4. Drop the now-unused sort_order column and its supporting index.
DROP INDEX IF EXISTS public.idx_drawing_versions_drawing_sort;
ALTER TABLE public.drawing_versions DROP COLUMN IF EXISTS sort_order;

-- 5. Atomic swap RPC. Uses a temporary value above the current max to side-
--    step the unique index during the three-step swap; fully transactional.
CREATE OR REPLACE FUNCTION public.swap_version_numbers(
  p_drawing_id UUID,
  p_version_a_id UUID,
  p_version_b_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_a_num INT;
  v_b_num INT;
  v_tmp INT;
BEGIN
  -- Lock both rows and confirm both belong to the same drawing.
  SELECT version_number INTO v_a_num
  FROM public.drawing_versions
  WHERE id = p_version_a_id AND drawing_id = p_drawing_id
  FOR UPDATE;

  SELECT version_number INTO v_b_num
  FROM public.drawing_versions
  WHERE id = p_version_b_id AND drawing_id = p_drawing_id
  FOR UPDATE;

  IF v_a_num IS NULL OR v_b_num IS NULL THEN
    RAISE EXCEPTION 'Version not found for drawing %', p_drawing_id;
  END IF;

  -- Pick a temp above current max to satisfy both the unique index and the
  -- >= 1 CHECK constraint.
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_tmp
  FROM public.drawing_versions
  WHERE drawing_id = p_drawing_id;

  UPDATE public.drawing_versions SET version_number = v_tmp   WHERE id = p_version_a_id;
  UPDATE public.drawing_versions SET version_number = v_a_num WHERE id = p_version_b_id;
  UPDATE public.drawing_versions SET version_number = v_b_num WHERE id = p_version_a_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.swap_version_numbers(UUID, UUID, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swap_version_numbers(UUID, UUID, UUID) TO service_role;

COMMIT;
