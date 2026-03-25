-- Function to calculate total storage bytes for a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_storage_bytes(p_tenant_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(dv.file_size), 0)::BIGINT
  FROM public.drawing_versions dv
  JOIN public.drawings d ON d.id = dv.drawing_id
  JOIN public.projects p ON p.id = d.project_id
  WHERE p.tenant_id = p_tenant_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
