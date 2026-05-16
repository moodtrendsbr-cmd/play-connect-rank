
-- 1. Expandir check constraint de tipos de eventos
ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_event_type_check;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'checkin','tournament_join','match_win','match_loss','booking',
    'class_attendance','ranking_update','tournament_created','payment_completed',
    'tournament_won','tournament_podium','level_up','streak_milestone','badge_earned'
  ]));

-- 2. Privacy flags em social_profiles
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS hide_checkins boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_ranking  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_activity boolean NOT NULL DEFAULT false;

-- 3. Descrições amigáveis
CREATE OR REPLACE FUNCTION public.social_event_description(_event_type text, _payload jsonb, _name text, _arena_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _event_type
    WHEN 'checkin' THEN COALESCE(_name,'Atleta') || ' fez check-in' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_join' THEN COALESCE(_name,'Atleta') || ' entrou em ' || COALESCE(_payload->>'tournament_name', 'um torneio')
    WHEN 'match_win' THEN COALESCE(_name,'Atleta') || ' venceu sua partida'
    WHEN 'match_loss' THEN COALESCE(_name,'Atleta') || ' disputou sua partida'
    WHEN 'booking' THEN COALESCE(_name,'Atleta') || ' reservou uma quadra' || COALESCE(' em ' || _arena_name, '')
    WHEN 'class_attendance' THEN COALESCE(_name,'Atleta') || ' treinou' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_created' THEN 'Novo torneio: ' || COALESCE(_payload->>'tournament_name', 'evento')
    WHEN 'tournament_won' THEN COALESCE(_name,'Atleta') || ' foi campeão em ' || COALESCE(_payload->>'tournament_name', 'um torneio')
    WHEN 'tournament_podium' THEN COALESCE(_name,'Atleta') || ' ficou em ' || COALESCE((_payload->>'position') || 'º lugar', 'pódio') || COALESCE(' em ' || (_payload->>'tournament_name'), '')
    WHEN 'ranking_update' THEN COALESCE(_name,'Atleta') || ' atualizou seu ranking'
    WHEN 'payment_completed' THEN COALESCE(_name,'Atleta') || ' completou um pagamento'
    WHEN 'level_up' THEN COALESCE(_name,'Atleta') || ' subiu para o nível ' || COALESCE(_payload->>'level', '?')
    WHEN 'streak_milestone' THEN COALESCE(_name,'Atleta') || ' está há ' || COALESCE(_payload->>'days', '?') || ' dias na ativa'
    WHEN 'badge_earned' THEN COALESCE(_name,'Atleta') || ' conquistou ' || COALESCE(_payload->>'badge_name', 'uma nova conquista')
    ELSE COALESCE(_name,'Atleta') || ' tem novidades'
  END;
$function$;

-- 4. Helper: respeitar privacy flags + hide_activity ao montar trigger de atividade
CREATE OR REPLACE FUNCTION public.trg_social_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_event text;
  v_payload jsonb := COALESCE(NEW.metadata, '{}'::jsonb);
  v_t_name text;
  v_hide_activity boolean;
  v_hide_checkins boolean;
  v_visibility text := 'public';
BEGIN
  v_event := CASE NEW.activity_type
    WHEN 'tournament.enrolled' THEN 'tournament_join'
    WHEN 'tournament.checked_in' THEN 'checkin'
    WHEN 'tournament.match_won' THEN 'match_win'
    WHEN 'tournament.match_lost' THEN 'match_loss'
    WHEN 'tournament.won' THEN 'tournament_won'
    WHEN 'class.attended' THEN 'class_attendance'
    ELSE NULL
  END;
  IF v_event IS NULL THEN RETURN NEW; END IF;

  BEGIN
    v_identity := public.social_identity_for_user(NEW.athlete_id);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;

  SELECT id, hide_activity, hide_checkins INTO v_profile, v_hide_activity, v_hide_checkins
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF v_hide_activity THEN v_visibility := 'private'; END IF;
  IF v_event = 'checkin' AND v_hide_checkins THEN v_visibility := 'private'; END IF;

  IF NEW.reference_type = 'tournament' AND NEW.reference_id IS NOT NULL THEN
    SELECT name INTO v_t_name FROM public.tournaments WHERE id = NEW.reference_id;
    IF v_t_name IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('tournament_name', v_t_name, 'tournament_id', NEW.reference_id);
    END IF;
  END IF;

  BEGIN
    PERFORM public._social_insert_event(
      v_profile, NEW.tenant_id, NEW.arena_id, v_event,
      NEW.reference_type, NEW.reference_id, v_payload, v_visibility
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_social_from_activity insert failed for activity %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 5. Trigger: level_up
CREATE OR REPLACE FUNCTION public.trg_social_from_level_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_hide boolean;
BEGIN
  IF NEW.level IS NULL OR OLD.level IS NULL OR NEW.level <= OLD.level THEN
    RETURN NEW;
  END IF;
  BEGIN v_identity := public.social_identity_for_user(NEW.athlete_id);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id, hide_activity INTO v_profile, v_hide
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public._social_insert_event(
      v_profile, NULL, NULL, 'level_up',
      'athlete_xp', NEW.athlete_id,
      jsonb_build_object('level', NEW.level, 'lifetime_xp', NEW.lifetime_xp),
      CASE WHEN v_hide THEN 'private' ELSE 'public' END
    );
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_up event failed: %', SQLERRM; END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_social_from_level_up ON public.athlete_xp;
CREATE TRIGGER trg_social_from_level_up
AFTER UPDATE OF level ON public.athlete_xp
FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_level_up();

-- 6. Trigger: streak milestone (a cada 7 dias)
CREATE OR REPLACE FUNCTION public.trg_social_from_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_hide boolean;
BEGIN
  IF NEW.current_streak IS NULL OR NEW.current_streak = 0
     OR NEW.current_streak = COALESCE(OLD.current_streak, 0)
     OR (NEW.current_streak % 7) <> 0 THEN
    RETURN NEW;
  END IF;
  BEGIN v_identity := public.social_identity_for_user(NEW.athlete_id);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id, hide_activity INTO v_profile, v_hide
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public._social_insert_event(
      v_profile, NULL, NULL, 'streak_milestone',
      'athlete_streaks', NEW.athlete_id,
      jsonb_build_object('days', NEW.current_streak),
      CASE WHEN v_hide THEN 'private' ELSE 'public' END
    );
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'streak event failed: %', SQLERRM; END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_social_from_streak ON public.athlete_streaks;
CREATE TRIGGER trg_social_from_streak
AFTER UPDATE OF current_streak ON public.athlete_streaks
FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_streak();

-- 7. Trigger: badge_earned
CREATE OR REPLACE FUNCTION public.trg_social_from_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_hide boolean;
  v_badge_name text;
BEGIN
  BEGIN v_identity := public.social_identity_for_user(NEW.athlete_id);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id, hide_activity INTO v_profile, v_hide
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;
  BEGIN SELECT name INTO v_badge_name FROM public.badges_catalog WHERE code = NEW.badge_code;
  EXCEPTION WHEN OTHERS THEN v_badge_name := NEW.badge_code; END;
  BEGIN
    PERFORM public._social_insert_event(
      v_profile, NULL, NULL, 'badge_earned',
      'athlete_badges', NEW.id,
      jsonb_build_object('badge_code', NEW.badge_code, 'badge_name', COALESCE(v_badge_name, NEW.badge_code)),
      CASE WHEN v_hide THEN 'private' ELSE 'public' END
    );
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'badge event failed: %', SQLERRM; END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_social_from_badge ON public.athlete_badges;
CREATE TRIGGER trg_social_from_badge
AFTER INSERT ON public.athlete_badges
FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_badge();

-- 8. Trigger: tournament_podium (posições 2 e 3) — campeão (1) já é coberto por trg_activity_from_placement
CREATE OR REPLACE FUNCTION public.trg_social_from_placement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_identity uuid;
  v_profile uuid;
  v_hide boolean;
  v_t_id uuid;
  v_t_name text;
  v_member RECORD;
BEGIN
  IF NEW.position NOT IN (2,3) THEN RETURN NEW; END IF;

  SELECT tm.tournament_id, t.name INTO v_t_id, v_t_name
    FROM public.tournament_modalities tm
    JOIN public.tournaments t ON t.id = tm.tournament_id
    WHERE tm.id = NEW.modality_id;

  FOR v_member IN
    SELECT DISTINCT em.user_id
    FROM public.entry_members em
    WHERE em.entry_id = NEW.entry_id AND em.user_id IS NOT NULL
  LOOP
    BEGIN v_identity := public.social_identity_for_user(v_member.user_id);
    EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
    IF v_identity IS NULL THEN CONTINUE; END IF;
    SELECT id, hide_activity INTO v_profile, v_hide
      FROM public.social_profiles WHERE identity_id = v_identity;
    IF v_profile IS NULL THEN CONTINUE; END IF;
    BEGIN
      PERFORM public._social_insert_event(
        v_profile, NEW.tenant_id, NULL, 'tournament_podium',
        'tournament', v_t_id,
        jsonb_build_object('position', NEW.position, 'tournament_id', v_t_id, 'tournament_name', v_t_name),
        CASE WHEN v_hide THEN 'private' ELSE 'public' END
      );
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'podium event failed: %', SQLERRM; END;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_social_from_placement ON public.modality_placements;
CREATE TRIGGER trg_social_from_placement
AFTER INSERT ON public.modality_placements
FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_placement();
