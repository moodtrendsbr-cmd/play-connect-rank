
-- =========================================
-- 1. Tournament check-in tokens
-- =========================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS checkin_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_method text;

UPDATE public.enrollments SET checkin_token = gen_random_uuid() WHERE checkin_token IS NULL;

CREATE OR REPLACE FUNCTION public.enrollment_checkin_validate(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enr public.enrollments;
  v_tournament public.tournaments;
  v_can boolean;
BEGIN
  SELECT * INTO v_enr FROM public.enrollments WHERE checkin_token = _token;
  IF v_enr.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_enr.tournament_id;
  -- Authorization: organizer, admin, or self
  v_can := (auth.uid() = v_tournament.organizer_id)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR (auth.uid() = v_enr.user_id);
  IF NOT v_can THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF v_enr.status::text <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_paid', 'status', v_enr.status);
  END IF;
  IF v_enr.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_checked_in', true,
      'enrollment_id', v_enr.id, 'tournament_id', v_enr.tournament_id,
      'checked_in_at', v_enr.checked_in_at);
  END IF;
  UPDATE public.enrollments
     SET checked_in_at = now(),
         checked_in_by = auth.uid(),
         checkin_method = COALESCE(checkin_method, 'qr')
   WHERE id = v_enr.id;
  RETURN jsonb_build_object('ok', true,
    'enrollment_id', v_enr.id, 'tournament_id', v_enr.tournament_id,
    'tournament_name', v_tournament.name, 'user_id', v_enr.user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.enrollment_checkin_validate(uuid) TO authenticated, anon;

-- =========================================
-- 2. Sortear grupos RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.sortear_grupos(_modality_id uuid, _num_groups integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tournament_id uuid;
  v_organizer uuid;
  v_tenant uuid;
  v_entries uuid[];
  v_groups uuid[];
  v_group_id uuid;
  v_letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];
  i integer;
  v_entry uuid;
  v_total integer;
BEGIN
  IF _num_groups < 1 OR _num_groups > 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_num_groups');
  END IF;
  SELECT t.tournament_id, tour.organizer_id, tour.tenant_id
    INTO v_tournament_id, v_organizer, v_tenant
  FROM public.tournament_modalities t
  JOIN public.tournaments tour ON tour.id = t.tournament_id
  WHERE t.id = _modality_id;
  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'modality_not_found');
  END IF;
  IF auth.uid() <> v_organizer AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Collect entries randomly
  SELECT array_agg(id ORDER BY random()) INTO v_entries
  FROM public.modality_entries WHERE modality_id = _modality_id;

  v_total := COALESCE(array_length(v_entries, 1), 0);
  IF v_total < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_entries', 'count', v_total);
  END IF;

  -- Reset existing groups & members for this modality
  DELETE FROM public.modality_group_members
   WHERE group_id IN (SELECT id FROM public.modality_groups WHERE modality_id = _modality_id);
  DELETE FROM public.modality_groups WHERE modality_id = _modality_id;

  -- Create N groups
  v_groups := ARRAY[]::uuid[];
  FOR i IN 1.._num_groups LOOP
    INSERT INTO public.modality_groups (modality_id, group_name, tenant_id)
    VALUES (_modality_id, v_letters[i], v_tenant)
    RETURNING id INTO v_group_id;
    v_groups := array_append(v_groups, v_group_id);
  END LOOP;

  -- Round-robin assignment
  FOR i IN 1..v_total LOOP
    v_entry := v_entries[i];
    v_group_id := v_groups[((i - 1) % _num_groups) + 1];
    INSERT INTO public.modality_group_members (group_id, entry_id, tenant_id)
    VALUES (v_group_id, v_entry, v_tenant)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Update modality num_groups
  UPDATE public.tournament_modalities SET num_groups = _num_groups WHERE id = _modality_id;

  RETURN jsonb_build_object('ok', true, 'modality_id', _modality_id,
    'groups', _num_groups, 'entries', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.sortear_grupos(uuid, integer) TO authenticated;

-- =========================================
-- 3. Read RPCs for WhatsApp tournament intents
-- =========================================
CREATE OR REPLACE FUNCTION public.get_my_next_match(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := COALESCE(_user_id, auth.uid());
  v_match record;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_user'); END IF;
  SELECT m.id, m.scheduled_at, m.round_number, m.match_number, m.score_a, m.score_b,
         m.entry_a_id, m.entry_b_id, m.status,
         tm.name AS modality_name, t.id AS tournament_id, t.name AS tournament_name,
         ea.name AS team_a, eb.name AS team_b
    INTO v_match
  FROM public.modality_matches m
  JOIN public.tournament_modalities tm ON tm.id = m.modality_id
  JOIN public.tournaments t ON t.id = tm.tournament_id
  LEFT JOIN public.modality_entries ea ON ea.id = m.entry_a_id
  LEFT JOIN public.modality_entries eb ON eb.id = m.entry_b_id
  WHERE m.status IN ('scheduled','in_progress')
    AND (
      EXISTS (SELECT 1 FROM public.modality_entry_members mem
              WHERE mem.entry_id = m.entry_a_id AND mem.user_id = v_user)
      OR EXISTS (SELECT 1 FROM public.modality_entry_members mem
                 WHERE mem.entry_id = m.entry_b_id AND mem.user_id = v_user)
    )
  ORDER BY COALESCE(m.scheduled_at, t.start_date::timestamptz) ASC
  LIMIT 1;
  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'has_match', false);
  END IF;
  RETURN jsonb_build_object('ok', true, 'has_match', true, 'match', to_jsonb(v_match));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_next_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tournament_status_summary(_tournament_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record; v_paid int; v_pending int; v_checked int; v_modalities int;
BEGIN
  SELECT id, name, status, start_date, end_date, max_slots, location, arena
    INTO v_t FROM public.tournaments WHERE id = _tournament_id;
  IF v_t.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT count(*) FILTER (WHERE status::text='paid'),
         count(*) FILTER (WHERE status::text='pending'),
         count(*) FILTER (WHERE checked_in_at IS NOT NULL)
    INTO v_paid, v_pending, v_checked
  FROM public.enrollments WHERE tournament_id = _tournament_id;
  SELECT count(*) INTO v_modalities FROM public.tournament_modalities WHERE tournament_id = _tournament_id;
  RETURN jsonb_build_object('ok', true,
    'tournament', to_jsonb(v_t),
    'paid', v_paid, 'pending', v_pending, 'checked_in', v_checked,
    'modalities', v_modalities);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_tournament_status_summary(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.register_match_score(
  _match_id uuid, _score_a integer, _score_b integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match record; v_organizer uuid; v_winner uuid;
BEGIN
  SELECT m.*, t.organizer_id INTO v_match
  FROM public.modality_matches m
  JOIN public.tournament_modalities tm ON tm.id = m.modality_id
  JOIN public.tournaments t ON t.id = tm.tournament_id
  WHERE m.id = _match_id;
  IF v_match.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'match_not_found'); END IF;
  IF auth.uid() <> v_match.organizer_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF _score_a > _score_b THEN v_winner := v_match.entry_a_id;
  ELSIF _score_b > _score_a THEN v_winner := v_match.entry_b_id;
  ELSE v_winner := NULL; END IF;
  UPDATE public.modality_matches
     SET score_a = _score_a, score_b = _score_b,
         winner_entry_id = v_winner,
         status = CASE WHEN v_winner IS NOT NULL THEN 'completed' ELSE status END
   WHERE id = _match_id;
  RETURN jsonb_build_object('ok', true, 'match_id', _match_id, 'winner_entry_id', v_winner);
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_match_score(uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.enroll_athlete_in_tournament(
  _tournament_id uuid, _modality_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_t record;
  v_enr_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT id, tenant_id, entry_fee, max_slots, status, name INTO v_t
  FROM public.tournaments WHERE id = _tournament_id;
  IF v_t.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'tournament_not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE tournament_id = _tournament_id AND user_id = v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_enrolled');
  END IF;
  INSERT INTO public.enrollments (tournament_id, user_id, tenant_id, status, amount_paid)
  VALUES (_tournament_id, v_user, v_t.tenant_id,
          CASE WHEN COALESCE(v_t.entry_fee, 0) = 0 THEN 'paid' ELSE 'pending' END,
          0)
  RETURNING id INTO v_enr_id;
  RETURN jsonb_build_object('ok', true, 'enrollment_id', v_enr_id,
    'tournament_id', _tournament_id, 'tournament_name', v_t.name,
    'requires_payment', COALESCE(v_t.entry_fee, 0) > 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.enroll_athlete_in_tournament(uuid, uuid) TO authenticated;

-- =========================================
-- 4. Proactive trigger generators (low_enrollment, relevant_tournament)
-- =========================================
CREATE OR REPLACE FUNCTION public.orkym_generate_low_enrollment_triggers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_t record;
BEGIN
  FOR v_t IN
    SELECT t.id, t.organizer_id, t.tenant_id, t.name, t.max_slots, t.start_date,
           (SELECT count(*) FROM public.enrollments e
             WHERE e.tournament_id = t.id AND e.status::text = 'paid') AS paid_count
    FROM public.tournaments t
    WHERE t.start_date BETWEEN current_date AND current_date + interval '14 days'
      AND COALESCE(t.status::text, 'active') NOT IN ('canceled','closed','completed')
  LOOP
    IF v_t.max_slots IS NULL OR v_t.max_slots = 0 THEN CONTINUE; END IF;
    IF v_t.paid_count::numeric / v_t.max_slots::numeric < 0.5 THEN
      BEGIN
        INSERT INTO public.orkym_triggers_queue
          (tenant_id, user_id, profile_type, trigger_type, entity_type, entity_id, payload, priority, dedup_key)
        VALUES (v_t.tenant_id, v_t.organizer_id, 'organizer',
                'low_enrollment', 'tournament', v_t.id,
                jsonb_build_object('tournament_id', v_t.id, 'tournament_name', v_t.name,
                                   'paid', v_t.paid_count, 'max', v_t.max_slots,
                                   'days_to_start', v_t.start_date - current_date),
                'medium',
                'low_enroll:' || v_t.id::text || ':' || to_char(current_date, 'IYYY-IW'))
        ON CONFLICT (dedup_key) DO NOTHING;
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_generate_relevant_tournament_triggers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_row record;
BEGIN
  -- Suggest upcoming tournaments to athletes who follow same arena/tenant but are not enrolled.
  FOR v_row IN
    SELECT DISTINCT ur.user_id, t.id AS tournament_id, t.tenant_id, t.name, t.start_date
    FROM public.tournaments t
    JOIN public.user_roles ur ON ur.role = 'athlete'::app_role
    WHERE t.start_date BETWEEN current_date + interval '3 days' AND current_date + interval '21 days'
      AND COALESCE(t.status::text, 'active') NOT IN ('canceled','closed','completed')
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollments e
         WHERE e.tournament_id = t.id AND e.user_id = ur.user_id
      )
    LIMIT 200
  LOOP
    BEGIN
      INSERT INTO public.orkym_triggers_queue
        (tenant_id, user_id, profile_type, trigger_type, entity_type, entity_id, payload, priority, dedup_key)
      VALUES (v_row.tenant_id, v_row.user_id, 'athlete',
              'relevant_tournament', 'tournament', v_row.tournament_id,
              jsonb_build_object('tournament_id', v_row.tournament_id,
                                 'tournament_name', v_row.name,
                                 'start_date', v_row.start_date),
              'low',
              'rel_tour:' || v_row.tournament_id::text || ':' || v_row.user_id::text)
      ON CONFLICT (dedup_key) DO NOTHING;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Wrap into the existing orkym_generate_periodic_triggers (preserve original behavior, then add ours).
DO $wrap$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='orkym_generate_periodic_triggers') INTO v_exists;
  IF NOT v_exists THEN
    CREATE OR REPLACE FUNCTION public.orkym_generate_periodic_triggers()
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE v_low int; v_rel int;
    BEGIN
      SELECT public.orkym_generate_low_enrollment_triggers() INTO v_low;
      SELECT public.orkym_generate_relevant_tournament_triggers() INTO v_rel;
      RETURN jsonb_build_object('low_enrollment', v_low, 'relevant_tournament', v_rel);
    END;
    $$;
  END IF;
END;
$wrap$;
