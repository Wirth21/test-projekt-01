-- Change-detection fingerprint for a project.
-- Returns a tiny text "signature" combining max(updated_at) + row count for
-- the three things that make a project's data look different to a viewer:
-- drawings, markers, and drawing_versions. The client polls this cheap value
-- instead of refetching the heavy lists; it only refreshes the real data when
-- the signature changed (~99% of polls return an unchanged value).
--
-- max(updated_at) catches edits, count catches insert/delete — together they
-- catch an update+delete-in-the-same-tick that either alone would miss.
-- updated_at is rendered at full timestamp precision (no epoch rounding).
--
-- SECURITY DEFINER like the other count helpers; access is gated at the API
-- route (requireProjectAccess) so only members can read a project's signature.

CREATE OR REPLACE FUNCTION public.project_signature(p_project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
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
               WHERE d.project_id = p_project_id)::text;
$$;

GRANT EXECUTE ON FUNCTION public.project_signature(uuid) TO authenticated;
