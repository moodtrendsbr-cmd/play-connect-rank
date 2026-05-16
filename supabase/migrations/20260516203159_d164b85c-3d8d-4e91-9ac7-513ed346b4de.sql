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
  BEGIN
    SELECT tm.tournament_id INTO v_tournament_id
      FROM public.tournament_modalities tm WHERE tm.id = NEW.modality_id;

    FOR v_member IN
      SELECT user_id FROM public.modality_entry_members WHERE entry_id = NEW.entry_id AND user_id IS NOT NULL
    LOOP
      BEGIN
        INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
        VALUES (
          v_member, NEW.tenant_id, 'tournament.won', 'tournament', v_tournament_id,
          jsonb_build_object('modality_id', NEW.modality_id, 'position', 1)
        ) ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN RAISE WARNING 'placement activity failed: %', SQLERRM; END;
      BEGIN
        PERFORM public.award_xp(v_member, 'tournament_win', NEW.id, 150, 'Tournament champion');
      EXCEPTION WHEN OTHERS THEN RAISE WARNING 'placement xp failed: %', SQLERRM; END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_activity_from_placement failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;