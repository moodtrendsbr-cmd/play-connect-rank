ALTER TABLE public.sponsor_arena_links
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contract_start DATE,
  ADD COLUMN IF NOT EXISTS contract_end DATE;

CREATE INDEX IF NOT EXISTS idx_sponsor_links_tournament ON public.sponsor_arena_links(tournament_id);

DROP POLICY IF EXISTS "Sponsor links visible to all" ON public.sponsor_arena_links;
DROP POLICY IF EXISTS "Sponsor links read scoped" ON public.sponsor_arena_links;
CREATE POLICY "Sponsor links read scoped" ON public.sponsor_arena_links
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = sponsor_arena_links.tenant_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.arenas a
      WHERE a.id = sponsor_arena_links.arena_id
        AND a.owner_user_id = auth.uid()
    )
  );
