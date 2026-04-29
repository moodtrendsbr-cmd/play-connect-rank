CREATE OR REPLACE FUNCTION public.orkym_enqueue_athlete_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_arena uuid;
  v_trigger_type text;
  v_dedup text;
  v_payload jsonb;
  v_priority text := 'medium';
  v_entity_type text;
  v_entity_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'enrollments' THEN
    v_user := COALESCE(NEW.user_id, NEW.payer_id);
    IF v_user IS NULL THEN RETURN NEW; END IF;
    SELECT tenant_id INTO v_tenant FROM public.tournaments WHERE id = NEW.tournament_id;
    IF v_tenant IS NULL THEN v_tenant := NEW.tenant_id; END IF;
    v_entity_type := 'tournament';
    v_entity_id := NEW.tournament_id;

    IF TG_OP = 'INSERT' THEN
      v_trigger_type := 'enrollment_created';
      v_dedup := 'enroll_created:' || NEW.id::text;
      v_payload := jsonb_build_object('enrollment_id', NEW.id, 'tournament_id', NEW.tournament_id, 'status', NEW.status::text);
    ELSIF TG_OP = 'UPDATE' AND NEW.status::text = 'paid' AND (OLD.status IS NULL OR OLD.status::text <> 'paid') THEN
      v_trigger_type := 'enrollment_paid';
      v_dedup := 'enroll_paid:' || NEW.id::text;
      v_priority := 'high';
      v_payload := jsonb_build_object('enrollment_id', NEW.id, 'tournament_id', NEW.tournament_id, 'amount_paid', NEW.amount_paid);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'modality_matches' THEN
    IF NEW.winner_entry_id IS NULL OR NEW.winner_entry_id IS NOT DISTINCT FROM OLD.winner_entry_id THEN
      RETURN NEW;
    END IF;
    v_tenant := NEW.tenant_id;
    v_arena := NEW.arena_id;
    v_entity_type := 'modality_match';
    v_entity_id := NEW.id;
    v_trigger_type := 'match_result';
    v_payload := jsonb_build_object('match_id', NEW.id, 'modality_id', NEW.modality_id, 'score_a', NEW.score_a, 'score_b', NEW.score_b, 'winner_entry_id', NEW.winner_entry_id);

    FOR v_user IN
      SELECT em.user_id FROM public.modality_entry_members em
       WHERE em.entry_id IN (NEW.entry_a_id, NEW.entry_b_id) AND em.user_id IS NOT NULL
    LOOP
      v_dedup := 'match_result:' || NEW.id::text || ':' || v_user::text;
      BEGIN
        INSERT INTO public.orkym_triggers_queue (tenant_id, arena_id, user_id, profile_type, trigger_type, entity_type, entity_id, payload, priority, dedup_key)
        VALUES (v_tenant, v_arena, v_user, 'athlete', v_trigger_type, v_entity_type, v_entity_id, v_payload, v_priority, v_dedup)
        ON CONFLICT (dedup_key) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'orkym_enqueue match_result failed: %', SQLERRM;
      END;
    END LOOP;
    RETURN NEW;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.orkym_triggers_queue (tenant_id, arena_id, user_id, profile_type, trigger_type, entity_type, entity_id, payload, priority, dedup_key)
    VALUES (v_tenant, v_arena, v_user, 'athlete', v_trigger_type, v_entity_type, v_entity_id, v_payload, v_priority, v_dedup)
    ON CONFLICT (dedup_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'orkym_enqueue enrollments failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;