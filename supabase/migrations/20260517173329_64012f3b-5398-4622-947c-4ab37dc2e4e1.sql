
-- Circuits: tenant-owned sequence of tournaments
CREATE TABLE IF NOT EXISTS public.circuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  cover_image_url TEXT,
  start_date DATE,
  end_date DATE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_circuits_tenant ON public.circuits(tenant_id);

ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public circuits visible to all" ON public.circuits;
CREATE POLICY "Public circuits visible to all" ON public.circuits
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Tenant admins manage circuits" ON public.circuits;
CREATE POLICY "Tenant admins manage circuits" ON public.circuits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = circuits.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = circuits.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER trg_circuits_updated BEFORE UPDATE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tournament FK to circuit
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS circuit_id UUID REFERENCES public.circuits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_circuit ON public.tournaments(circuit_id);

-- Sponsor ↔ Arena links
CREATE TABLE IF NOT EXISTS public.sponsor_arena_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, arena_id)
);
CREATE INDEX IF NOT EXISTS idx_sponsor_links_tenant ON public.sponsor_arena_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_links_arena ON public.sponsor_arena_links(arena_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_links_company ON public.sponsor_arena_links(company_id);

ALTER TABLE public.sponsor_arena_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sponsor links visible to all" ON public.sponsor_arena_links;
CREATE POLICY "Sponsor links visible to all" ON public.sponsor_arena_links
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant admins manage sponsor links" ON public.sponsor_arena_links;
CREATE POLICY "Tenant admins manage sponsor links" ON public.sponsor_arena_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = sponsor_arena_links.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = sponsor_arena_links.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER trg_sponsor_links_updated BEFORE UPDATE ON public.sponsor_arena_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
