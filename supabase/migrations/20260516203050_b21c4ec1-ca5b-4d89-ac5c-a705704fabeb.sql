CREATE OR REPLACE FUNCTION public.trg_emit_ranking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pos int;
  v_identity uuid;
  v_profile uuid;
BEGIN
  BEGIN
    SELECT COUNT(*) + 1 INTO _pos FROM public.athlete_xp WHERE lifetime_xp > NEW.lifetime_xp;
  EXCEPTION WHEN OTHERS THEN _pos := NULL; END;

  BEGIN
    v_identity := public.social_identity_for_user(NEW.athlete_id);
    IF v_identity IS NULL THEN RETURN NEW; END IF;
    SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
    IF v_profile IS NULL THEN RETURN NEW; END IF;

    INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility)
    VALUES (
      v_profile, 'ranking_update', 'athlete', NEW.athlete_id,
      jsonb_build_object('position', _pos, 'total_points', NEW.lifetime_xp, 'level', NEW.level),
      'public'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_emit_ranking_update failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;