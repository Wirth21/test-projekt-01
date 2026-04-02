-- ============================================================
-- PROJ: Drawing Statuses - Admin-definable statuses for drawings
-- ============================================================

-- 1. Create drawing_statuses table (per tenant)
CREATE TABLE public.drawing_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  color TEXT NOT NULL DEFAULT '#6b7280' CHECK (char_length(color) >= 4 AND char_length(color) <= 9),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

-- 2. Add status_id to drawings
ALTER TABLE public.drawings
  ADD COLUMN status_id UUID REFERENCES public.drawing_statuses(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.drawing_statuses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Tenant members can view statuses"
  ON public.drawing_statuses
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert statuses"
  ON public.drawing_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "Admins can update statuses"
  ON public.drawing_statuses
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete statuses"
  ON public.drawing_statuses
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- 5. Indexes
CREATE INDEX idx_drawing_statuses_tenant ON public.drawing_statuses(tenant_id);
CREATE INDEX idx_drawings_status_id ON public.drawings(status_id);

-- 6. Updated_at trigger
CREATE TRIGGER on_drawing_statuses_updated
  BEFORE UPDATE ON public.drawing_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
