ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS arena_id uuid REFERENCES public.arenas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_arena_id ON public.tournaments(arena_id);

UPDATE public.tournaments t
SET arena_id = a.id
FROM public.arenas a
WHERE t.arena_id IS NULL
  AND t.arena IS NOT NULL
  AND lower(trim(t.arena)) = lower(trim(a.name))
  AND (t.tenant_id IS NULL OR a.tenant_id IS NULL OR t.tenant_id = a.tenant_id);

CREATE OR REPLACE VIEW public.tournament_enrollment_counts AS
SELECT
  t.id AS tournament_id,
  COUNT(e.id) FILTER (WHERE e.status = 'paid') AS paid_count,
  COUNT(e.id) FILTER (WHERE e.status = 'pending') AS pending_count,
  COUNT(e.id) AS total_count
FROM public.tournaments t
LEFT JOIN public.enrollments e ON e.tournament_id = t.id
WHERE t.is_public = true
GROUP BY t.id;

GRANT SELECT ON public.tournament_enrollment_counts TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.tournament_modalities'::regclass
      AND polname = 'Public modalities visible'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Public modalities visible" ON public.tournament_modalities
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_modalities.tournament_id
              AND t.is_public = true
          )
        )
    $POL$;
  END IF;
END $$;