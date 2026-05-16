
-- 1) Permitir novo tipo de atividade
ALTER TABLE public.athlete_activities
  DROP CONSTRAINT IF EXISTS athlete_activities_activity_type_check;
ALTER TABLE public.athlete_activities
  ADD CONSTRAINT athlete_activities_activity_type_check CHECK (activity_type = ANY (ARRAY[
    'tournament.enrolled','tournament.checked_in','tournament.match_won','tournament.match_lost',
    'tournament.placed','tournament.won','tournament.advance',
    'class.attended','class.enrolled','social.posted','social.clip_posted'
  ]));

-- 2) Permitir novo event_type
ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_event_type_check;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_event_type_check CHECK (event_type = ANY (ARRAY[
    'checkin','tournament_join','match_win','match_loss','booking','class_attendance',
    'ranking_update','tournament_created','payment_completed','tournament_won',
    'tournament_podium','tournament_advance','level_up','streak_milestone','badge_earned'
  ]));

-- 3) Atualizar descrição (match_win com torneio/fase + tournament_advance)
CREATE OR REPLACE FUNCTION public.social_event_description(_event_type text, _payload jsonb, _name text, _arena_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _event_type
    WHEN 'checkin' THEN COALESCE(_name,'Atleta') || ' fez check-in' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_join' THEN COALESCE(_name,'Atleta') || ' entrou em ' || COALESCE(_payload->>'tournament_name', 'um torneio')
    WHEN 'match_win' THEN COALESCE(_name,'Atleta') || ' venceu' ||
         COALESCE(' a ' || (_payload->>'phase_label'), ' sua partida') ||
         COALESCE(' em ' || (_payload->>'tournament_name'), '')
    WHEN 'match_loss' THEN COALESCE(_name,'Atleta') || ' disputou sua partida'
    WHEN 'booking' THEN COALESCE(_name,'Atleta') || ' reservou uma quadra' || COALESCE(' em ' || _arena_name, '')
    WHEN 'class_attendance' THEN COALESCE(_name,'Atleta') || ' treinou' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_created' THEN 'Novo torneio: ' || COALESCE(_payload->>'tournament_name', 'evento')
    WHEN 'tournament_won' THEN COALESCE(_name,'Atleta') || ' foi campeão em ' || COALESCE(_payload->>'tournament_name', 'um torneio')
    WHEN 'tournament_podium' THEN COALESCE(_name,'Atleta') || ' ficou em ' || COALESCE((_payload->>'position') || 'º lugar', 'pódio') || COALESCE(' em ' || (_payload->>'tournament_name'), '')
    WHEN 'tournament_advance' THEN COALESCE(_name,'Atleta') || ' avançou para ' || COALESCE(_payload->>'next_phase_label','a próxima fase') || COALESCE(' em ' || (_payload->>'tournament_name'), '')
    WHEN 'ranking_update' THEN COALESCE(_name,'Atleta') || ' atualizou seu ranking'
    WHEN 'payment_completed' THEN COALESCE(_name,'Atleta') || ' completou um pagamento'
    WHEN 'level_up' THEN COALESCE(_name,'Atleta') || ' subiu para o nível ' || COALESCE(_payload->>'level', '?')
    WHEN 'streak_milestone' THEN COALESCE(_name,'Atleta') || ' está há ' || COALESCE(_payload->>'days', '?') || ' dias na ativa'
    WHEN 'badge_earned' THEN COALESCE(_name,'Atleta') || ' conquistou ' || COALESCE(_payload->>'badge_name', 'uma nova conquista')
    ELSE COALESCE(_name,'Atleta') || ' tem novidades'
  END;
$$;

-- 4) Mapear tournament.advance no emissor social
CREATE OR REPLACE FUNCTION public.trg_social_from_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    WHEN 'tournament.advance' THEN 'tournament_advance'
    WHEN 'class.attended' THEN 'class_attendance'
    ELSE NULL
  END;
  IF v_event IS NULL THEN RETURN NEW; END IF;

  BEGIN v_identity := public.social_identity_for_user(NEW.athlete_id);
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
END $$;

-- 5) Enriquecer trg_activity_from_match com tournament_id/name/phase + emitir tournament.advance
CREATE OR REPLACE FUNCTION public.trg_activity_from_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_winner_user uuid; v_loser_user uuid; v_loser_entry uuid; v_tenant uuid;
  v_tournament_id uuid; v_tournament_name text;
  v_max_round int; v_rounds_left int;
  v_phase_label text; v_next_phase_label text;
  v_meta jsonb;
BEGIN
  IF NEW.winner_entry_id IS NULL OR NEW.winner_entry_id IS NOT DISTINCT FROM OLD.winner_entry_id THEN
    RETURN NEW;
  END IF;

  v_loser_entry := CASE WHEN NEW.winner_entry_id = NEW.entry_a_id THEN NEW.entry_b_id ELSE NEW.entry_a_id END;
  v_tenant := NEW.tenant_id;

  -- Lookup tournament + max round (apenas chaveamento eliminatório: ignora group stage)
  SELECT m.tournament_id, t.name INTO v_tournament_id, v_tournament_name
    FROM public.tournament_modalities m
    LEFT JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE m.id = NEW.modality_id;

  SELECT MAX(round_number) INTO v_max_round
    FROM public.modality_matches
    WHERE modality_id = NEW.modality_id AND group_id IS NULL;

  v_rounds_left := COALESCE(v_max_round,0) - COALESCE(NEW.round_number,0);

  v_phase_label := CASE
    WHEN NEW.group_id IS NOT NULL THEN 'fase de grupos'
    WHEN v_rounds_left = 0 THEN 'final'
    WHEN v_rounds_left = 1 THEN 'semifinal'
    WHEN v_rounds_left = 2 THEN 'quartas de final'
    WHEN v_rounds_left = 3 THEN 'oitavas de final'
    ELSE 'rodada ' || COALESCE(NEW.round_number::text,'?')
  END;

  v_next_phase_label := CASE
    WHEN v_rounds_left <= 0 THEN NULL
    WHEN v_rounds_left = 1 THEN 'a final'
    WHEN v_rounds_left = 2 THEN 'a semifinal'
    WHEN v_rounds_left = 3 THEN 'as quartas de final'
    WHEN v_rounds_left = 4 THEN 'as oitavas de final'
    ELSE 'a rodada ' || ((COALESCE(NEW.round_number,0)+1)::text)
  END;

  v_meta := jsonb_build_object(
    'modality_id', NEW.modality_id,
    'score_a', NEW.score_a, 'score_b', NEW.score_b,
    'round_number', NEW.round_number,
    'phase_label', v_phase_label
  );
  IF v_tournament_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('tournament_id', v_tournament_id, 'tournament_name', v_tournament_name);
  END IF;

  SELECT em.user_id INTO v_winner_user
    FROM public.modality_entry_members em
    WHERE em.entry_id = NEW.winner_entry_id LIMIT 1;

  IF v_winner_user IS NOT NULL THEN
    INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
    VALUES (v_winner_user, v_tenant, 'tournament.match_won', 'modality_match', NEW.id, v_meta)
    ON CONFLICT DO NOTHING;

    -- Avanço de fase (não emitir na final — quem ganha a final já gera tournament.won)
    IF NEW.group_id IS NULL AND v_rounds_left > 0 AND v_next_phase_label IS NOT NULL THEN
      INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
      VALUES (v_winner_user, v_tenant, 'tournament.advance', 'modality_match', NEW.id,
              v_meta || jsonb_build_object('next_phase_label', v_next_phase_label))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_loser_entry IS NOT NULL THEN
    SELECT em.user_id INTO v_loser_user
      FROM public.modality_entry_members em
      WHERE em.entry_id = v_loser_entry LIMIT 1;
    IF v_loser_user IS NOT NULL THEN
      INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
      VALUES (v_loser_user, v_tenant, 'tournament.match_lost', 'modality_match', NEW.id, v_meta)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;
