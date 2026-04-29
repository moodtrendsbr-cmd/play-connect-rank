
-- =========================================================
-- G-0: Cleanup gamification RPCs + social_events dedup
-- =========================================================

-- 1. Fix get_athlete_ranking → use modality_matches as source of truth
CREATE OR REPLACE FUNCTION public.get_athlete_ranking(_athlete_id uuid, _modality text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  WITH athlete_results AS (
    SELECT
      tm.id AS modality_id,
      tm.name AS modality_name,
      tm.category,
      mem.user_id AS athlete_id,
      COUNT(*) FILTER (WHERE mm.winner_entry_id = mem.entry_id) AS wins,
      COUNT(*) FILTER (WHERE mm.status = 'completed') AS played
    FROM public.modality_matches mm
    JOIN public.modality_entry_members mem
      ON mem.entry_id IN (mm.entry_a_id, mm.entry_b_id)
    JOIN public.tournament_modalities tm ON tm.id = mm.modality_id
    WHERE mm.status = 'completed'
      AND (_modality IS NULL OR tm.name = _modality)
    GROUP BY tm.id, tm.name, tm.category, mem.user_id
  ),
  ranked AS (
    SELECT
      modality_name AS modality,
      category,
      athlete_id,
      (wins * 10) AS points,
      played,
      wins,
      ROW_NUMBER() OVER (PARTITION BY modality_name, category ORDER BY wins DESC, played DESC) AS position
    FROM athlete_results
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'modality', modality,
    'category', category,
    'points', points,
    'wins', wins,
    'played', played,
    'position', position
  ) ORDER BY points DESC), '[]'::jsonb)
  INTO v_rows
  FROM ranked
  WHERE athlete_id = _athlete_id;

  RETURN jsonb_build_object(
    'success', true,
    'athlete_id', _athlete_id,
    'rankings', COALESCE(v_rows, '[]'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', true,
    'athlete_id', _athlete_id,
    'rankings', '[]'::jsonb,
    'note', 'ranking_calc_error'
  );
END $function$;

-- 2. Fix get_athlete_performance → use modality_matches via entry_members
CREATE OR REPLACE FUNCTION public.get_athlete_performance(_athlete_id uuid, _period_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0;
  v_wins int := 0;
  v_losses int := 0;
BEGIN
  WITH my_entries AS (
    SELECT DISTINCT entry_id
    FROM public.modality_entry_members
    WHERE user_id = _athlete_id
  ),
  my_matches AS (
    SELECT
      mm.id,
      mm.winner_entry_id,
      CASE
        WHEN mm.entry_a_id IN (SELECT entry_id FROM my_entries) THEN mm.entry_a_id
        WHEN mm.entry_b_id IN (SELECT entry_id FROM my_entries) THEN mm.entry_b_id
      END AS my_entry_id
    FROM public.modality_matches mm
    WHERE mm.status = 'completed'
      AND (
        mm.entry_a_id IN (SELECT entry_id FROM my_entries) OR
        mm.entry_b_id IN (SELECT entry_id FROM my_entries)
      )
      AND COALESCE(mm.scheduled_at, mm.created_at) > now() - (_period_days || ' days')::interval
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE winner_entry_id = my_entry_id),
    COUNT(*) FILTER (WHERE winner_entry_id IS NOT NULL AND winner_entry_id <> my_entry_id)
  INTO v_total, v_wins, v_losses
  FROM my_matches;

  RETURN jsonb_build_object(
    'success', true,
    'athlete_id', _athlete_id,
    'period_days', _period_days,
    'total_matches', COALESCE(v_total, 0),
    'wins', COALESCE(v_wins, 0),
    'losses', COALESCE(v_losses, 0),
    'win_rate', CASE WHEN v_total > 0 THEN ROUND((v_wins::numeric / v_total) * 100, 1) ELSE 0 END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', true,
    'athlete_id', _athlete_id,
    'period_days', _period_days,
    'total_matches', 0,
    'wins', 0,
    'losses', 0,
    'win_rate', 0,
    'note', 'performance_calc_error'
  );
END $function$;

-- 3. social_events dedup helper
-- Index to accelerate dedup lookup
CREATE INDEX IF NOT EXISTS idx_social_events_dedup
  ON public.social_events (profile_id, event_type, entity_id, created_at DESC);

-- Helper: returns true if there is NO recent duplicate, i.e. caller should emit.
CREATE OR REPLACE FUNCTION public.social_event_should_emit(
  _profile_id uuid,
  _event_type text,
  _entity_id uuid,
  _window interval DEFAULT interval '6 hours'
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.social_events
    WHERE profile_id = _profile_id
      AND event_type = _event_type
      AND COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND created_at > now() - _window
  );
$$;

COMMENT ON FUNCTION public.social_event_should_emit IS
  'Phase G-0: returns true if no equivalent social_event was registered for this profile+type+entity in the last window (default 6h). Use from triggers before INSERT.';
