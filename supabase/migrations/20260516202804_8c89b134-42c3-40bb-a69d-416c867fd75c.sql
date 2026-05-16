CREATE OR REPLACE FUNCTION public.evaluate_badges(_athlete uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wins int;
  _matches int;
  _attendances int;
  _posts int;
  _enrollments int;
  _streak int;
  _awarded text[] := ARRAY[]::text[];
  _b record;
  _eligible boolean;
BEGIN
  IF _athlete IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT COUNT(*) FILTER (WHERE mm.winner_entry_id = mem.entry_id) INTO _wins
    FROM public.modality_entry_members mem
    JOIN public.modality_matches mm
      ON mm.entry_a_id = mem.entry_id OR mm.entry_b_id = mem.entry_id
   WHERE mem.user_id = _athlete AND mm.status IN ('completed','finished');

  SELECT COUNT(*) INTO _matches
    FROM public.modality_entry_members mem
    JOIN public.modality_matches mm
      ON mm.entry_a_id = mem.entry_id OR mm.entry_b_id = mem.entry_id
   WHERE mem.user_id = _athlete AND mm.status IN ('completed','finished');

  SELECT COUNT(*) INTO _attendances FROM public.arena_attendance WHERE athlete_id = _athlete AND status = 'present';
  SELECT COUNT(*) INTO _posts FROM public.posts WHERE author_id = _athlete;
  SELECT COUNT(*) INTO _enrollments FROM public.enrollments WHERE user_id = _athlete;
  SELECT COALESCE(longest_streak, 0) INTO _streak FROM public.athlete_streaks WHERE athlete_id = _athlete;

  FOR _b IN SELECT code, criteria, xp_reward FROM public.badges_catalog WHERE active = true LOOP
    IF EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = _athlete AND badge_code = _b.code) THEN
      CONTINUE;
    END IF;
    _eligible := false;
    IF (_b.criteria ? 'min_wins') AND _wins >= (_b.criteria->>'min_wins')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_matches') AND _matches >= (_b.criteria->>'min_matches')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_attendances') AND _attendances >= (_b.criteria->>'min_attendances')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_posts') AND _posts >= (_b.criteria->>'min_posts')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_enrollments') AND _enrollments >= (_b.criteria->>'min_enrollments')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_streak') AND _streak >= (_b.criteria->>'min_streak')::int THEN _eligible := true; END IF;

    IF _eligible THEN
      INSERT INTO public.athlete_badges (athlete_id, badge_code) VALUES (_athlete, _b.code) ON CONFLICT DO NOTHING;
      _awarded := array_append(_awarded, _b.code);
      IF _b.xp_reward > 0 THEN
        PERFORM public.award_xp(_athlete, 'badge', NULL, _b.xp_reward, 'Badge: ' || _b.code);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'awarded', _awarded);
END;
$function$;