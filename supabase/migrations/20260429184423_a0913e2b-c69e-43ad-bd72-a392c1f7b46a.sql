
-- ============================================================
-- G-4: Gamification Engine mínima
-- Reaproveita athlete_xp/xp_events/athlete_streaks (G-1).
-- ============================================================

-- 1) Bookings -> +6 pontos quando pago/confirmado
CREATE OR REPLACE FUNCTION public.trg_award_xp_on_booking_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('paid','confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.award_xp(NEW.user_id, 'booking', NEW.id, 6, 'Reserva confirmada');
    PERFORM public.update_streak(NEW.user_id, COALESCE(NEW.booking_date, CURRENT_DATE));
    PERFORM public.evaluate_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_xp_on_booking_paid ON public.bookings;
CREATE TRIGGER trg_award_xp_on_booking_paid
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_award_xp_on_booking_paid();


-- 2) View resumo (semanal/mensal sem nova tabela)
CREATE OR REPLACE VIEW public.athlete_points_summary
WITH (security_invoker = on) AS
SELECT
  ax.athlete_id,
  ax.lifetime_xp                                                     AS total_points,
  ax.current_xp,
  ax.level,
  COALESCE((SELECT SUM(delta) FROM public.xp_events e
            WHERE e.athlete_id = ax.athlete_id
              AND e.created_at >= now() - interval '7 days'), 0)::int  AS weekly_points,
  COALESCE((SELECT SUM(delta) FROM public.xp_events e
            WHERE e.athlete_id = ax.athlete_id
              AND e.created_at >= now() - interval '30 days'), 0)::int AS monthly_points,
  COALESCE(s.current_streak, 0)  AS current_streak,
  COALESCE(s.longest_streak, 0)  AS longest_streak,
  s.last_activity_date
FROM public.athlete_xp ax
LEFT JOIN public.athlete_streaks s ON s.athlete_id = ax.athlete_id;

GRANT SELECT ON public.athlete_points_summary TO anon, authenticated;


-- 3) Ranking views (sem tabela nova)
CREATE OR REPLACE VIEW public.ranking_global
WITH (security_invoker = on) AS
SELECT
  ROW_NUMBER() OVER (ORDER BY ax.lifetime_xp DESC, ax.athlete_id)::int AS position,
  ax.athlete_id,
  ax.lifetime_xp AS total_points,
  ax.level,
  pp.full_name,
  pp.avatar_url,
  pp.city,
  pp.state
FROM public.athlete_xp ax
LEFT JOIN public.profiles_public pp ON pp.user_id = ax.athlete_id
WHERE ax.lifetime_xp > 0
ORDER BY ax.lifetime_xp DESC, ax.athlete_id
LIMIT 100;

GRANT SELECT ON public.ranking_global TO anon, authenticated;

-- Ranking por arena: agrega xp_events vinculados a bookings/attendance daquela arena
CREATE OR REPLACE VIEW public.ranking_by_arena
WITH (security_invoker = on) AS
WITH events_with_arena AS (
  SELECT e.athlete_id, e.delta, b.arena_id
  FROM public.xp_events e
  JOIN public.bookings b ON b.id = e.source_id
  WHERE e.source = 'booking' AND b.arena_id IS NOT NULL
  UNION ALL
  SELECT e.athlete_id, e.delta, a.arena_id
  FROM public.xp_events e
  JOIN public.arena_attendance a ON a.id = e.source_id
  WHERE e.source = 'attendance' AND a.arena_id IS NOT NULL
)
SELECT
  arena_id,
  athlete_id,
  SUM(delta)::int AS total_points,
  ROW_NUMBER() OVER (PARTITION BY arena_id ORDER BY SUM(delta) DESC, athlete_id)::int AS position
FROM events_with_arena
GROUP BY arena_id, athlete_id;

GRANT SELECT ON public.ranking_by_arena TO anon, authenticated;

-- Ranking por modalidade: via modality_matches
CREATE OR REPLACE VIEW public.ranking_by_modality
WITH (security_invoker = on) AS
WITH events_with_modality AS (
  SELECT e.athlete_id, e.delta, m.modality_id
  FROM public.xp_events e
  JOIN public.modality_matches m ON m.id = e.source_id
  WHERE e.source IN ('match_win','match_played') AND m.modality_id IS NOT NULL
)
SELECT
  modality_id,
  athlete_id,
  SUM(delta)::int AS total_points,
  ROW_NUMBER() OVER (PARTITION BY modality_id ORDER BY SUM(delta) DESC, athlete_id)::int AS position
FROM events_with_modality
GROUP BY modality_id, athlete_id;

GRANT SELECT ON public.ranking_by_modality TO anon, authenticated;


-- 4) Eventos sociais: ranking_update e streak_update (idempotentes via social_event_should_emit)

-- Ranking update: ao subir XP, se entrar/permanecer no top 10, emite no máximo 1x por 6h
CREATE OR REPLACE FUNCTION public.trg_emit_ranking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pos int;
BEGIN
  IF NEW.lifetime_xp <= COALESCE(OLD.lifetime_xp, 0) THEN
    RETURN NEW;
  END IF;

  SELECT position INTO _pos
  FROM public.ranking_global
  WHERE athlete_id = NEW.athlete_id;

  IF _pos IS NULL OR _pos > 10 THEN
    RETURN NEW;
  END IF;

  IF public.social_event_should_emit(NEW.athlete_id, 'ranking_update', NEW.athlete_id, interval '6 hours') THEN
    INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility)
    VALUES (
      NEW.athlete_id,
      'ranking_update',
      'athlete',
      NEW.athlete_id,
      jsonb_build_object('position', _pos, 'total_points', NEW.lifetime_xp, 'level', NEW.level),
      'public'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_ranking_update ON public.athlete_xp;
CREATE TRIGGER trg_emit_ranking_update
AFTER UPDATE OF lifetime_xp ON public.athlete_xp
FOR EACH ROW EXECUTE FUNCTION public.trg_emit_ranking_update();

-- Streak update: emite ao atingir múltiplos de 5 dias
CREATE OR REPLACE FUNCTION public.trg_emit_streak_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak IS NULL OR NEW.current_streak < 5 THEN
    RETURN NEW;
  END IF;

  IF (NEW.current_streak % 5) <> 0 THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.current_streak, 0) = NEW.current_streak THEN
    RETURN NEW;
  END IF;

  IF public.social_event_should_emit(NEW.athlete_id, 'streak_update', NEW.athlete_id, interval '6 hours') THEN
    INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility)
    VALUES (
      NEW.athlete_id,
      'streak_update',
      'athlete',
      NEW.athlete_id,
      jsonb_build_object('current_streak', NEW.current_streak, 'longest_streak', NEW.longest_streak),
      'public'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_streak_update ON public.athlete_streaks;
CREATE TRIGGER trg_emit_streak_update
AFTER UPDATE OF current_streak ON public.athlete_streaks
FOR EACH ROW EXECUTE FUNCTION public.trg_emit_streak_update();


-- 5) RPC pública para ORKYM e UI: progresso completo do atleta
CREATE OR REPLACE FUNCTION public.get_athlete_progress(_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _rank int;
BEGIN
  SELECT position INTO _rank FROM public.ranking_global WHERE athlete_id = _profile_id;

  SELECT jsonb_build_object(
    'athlete_id', s.athlete_id,
    'total_points', s.total_points,
    'weekly_points', s.weekly_points,
    'monthly_points', s.monthly_points,
    'current_xp', s.current_xp,
    'level', s.level,
    'current_streak', s.current_streak,
    'longest_streak', s.longest_streak,
    'last_activity_date', s.last_activity_date,
    'rank_global', _rank
  )
  INTO _result
  FROM public.athlete_points_summary s
  WHERE s.athlete_id = _profile_id;

  RETURN COALESCE(_result, jsonb_build_object(
    'athlete_id', _profile_id,
    'total_points', 0,
    'weekly_points', 0,
    'monthly_points', 0,
    'current_xp', 0,
    'level', 1,
    'current_streak', 0,
    'longest_streak', 0,
    'last_activity_date', null,
    'rank_global', null
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_progress(uuid) TO anon, authenticated;
