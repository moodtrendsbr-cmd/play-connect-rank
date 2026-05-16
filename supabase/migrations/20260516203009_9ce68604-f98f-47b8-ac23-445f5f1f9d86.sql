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

  BEGIN
    v_identity := public.social_identity_for_user(NEW.athlete_id);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF NEW.reference_type = 'tournament' AND NEW.reference_id IS NOT NULL THEN
    SELECT name INTO v_t_name FROM public.tournaments WHERE id = NEW.reference_id;
    IF v_t_name IS NOT NULL THEN v_payload := v_payload || jsonb_build_object('tournament_name', v_t_name); END IF;
  END IF;

  BEGIN
    PERFORM public._social_insert_event(
      v_profile, NEW.tenant_id, NEW.arena_id, v_event,
      NEW.reference_type, NEW.reference_id, v_payload, 'public'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_social_from_activity insert failed for activity %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;