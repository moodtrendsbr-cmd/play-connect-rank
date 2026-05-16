-- Fix trg_xp_from_match: use correct column (user_id) and trigger on winner_entry_id
-- (status='finished' was never matched as 'completed', so XP never fired).
CREATE OR REPLACE FUNCTION public.trg_xp_from_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _athlete uuid;
BEGIN
  IF NEW.winner_entry_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.winner_entry_id IS NOT DISTINCT FROM OLD.winner_entry_id THEN
    RETURN NEW;
  END IF;

  FOR _athlete IN
    SELECT DISTINCT mem.user_id
      FROM public.modality_entry_members mem
     WHERE mem.entry_id IN (NEW.entry_a_id, NEW.entry_b_id)
       AND mem.user_id IS NOT NULL
  LOOP
    IF _athlete IN (
      SELECT user_id FROM public.modality_entry_members WHERE entry_id = NEW.winner_entry_id
    ) THEN
      PERFORM public.award_xp(_athlete, 'match_win', NEW.id, 50, 'Match win');
    ELSE
      PERFORM public.award_xp(_athlete, 'match_played', NEW.id, 10, 'Match played');
    END IF;
    PERFORM public.update_streak(_athlete, CURRENT_DATE);
    PERFORM public.evaluate_badges(_athlete);
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Re-attach trigger on winner_entry_id change
DROP TRIGGER IF EXISTS trg_xp_from_match ON public.modality_matches;
CREATE TRIGGER trg_xp_from_match
AFTER UPDATE OF winner_entry_id ON public.modality_matches
FOR EACH ROW EXECUTE FUNCTION public.trg_xp_from_match();

-- New: activity + bonus XP when a champion (position=1) is recorded.
CREATE OR REPLACE FUNCTION public.trg_activity_from_placement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_member uuid;
BEGIN
  IF NEW.position <> 1 THEN RETURN NEW; END IF;

  SELECT tm.tournament_id INTO v_tournament_id
    FROM public.tournament_modalities tm WHERE tm.id = NEW.modality_id;

  FOR v_member IN
    SELECT user_id FROM public.modality_entry_members WHERE entry_id = NEW.entry_id AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
    VALUES (
      v_member, NEW.tenant_id, 'tournament.won', 'tournament', v_tournament_id,
      jsonb_build_object('modality_id', NEW.modality_id, 'position', 1)
    ) ON CONFLICT DO NOTHING;

    PERFORM public.award_xp(v_member, 'tournament_win', NEW.id, 150, 'Tournament champion');
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_activity_from_placement ON public.modality_placements;
CREATE TRIGGER trg_activity_from_placement
AFTER INSERT ON public.modality_placements
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_placement();

-- Extend social_event_description to describe champion event
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
    WHEN 'ranking_update' THEN COALESCE(_name,'Atleta') || ' atualizou seu ranking'
    WHEN 'payment_completed' THEN COALESCE(_name,'Atleta') || ' completou um pagamento'
    ELSE COALESCE(_name,'Atleta') || ' tem novidades'
  END;
$function$;

-- Extend trg_social_from_activity to emit tournament_won social event
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

  v_identity := public.social_identity_for_user(NEW.athlete_id);
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF NEW.reference_type = 'tournament' AND NEW.reference_id IS NOT NULL THEN
    SELECT name INTO v_t_name FROM public.tournaments WHERE id = NEW.reference_id;
    IF v_t_name IS NOT NULL THEN v_payload := v_payload || jsonb_build_object('tournament_name', v_t_name); END IF;
  END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NEW.arena_id, v_event,
    NEW.reference_type, NEW.reference_id, v_payload, 'public'
  );
  RETURN NEW;
END;
$function$;