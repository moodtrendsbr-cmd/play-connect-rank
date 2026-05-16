-- =========================================================
-- Social Runtime Fix Sprint
-- 1) Fix trg_social_from_placement (wrong table name)
-- 2) Add privacy gate to booking + payment triggers
-- 3) Backfill historical social_events idempotently
-- =========================================================

-- ---------- 1. Fix placement trigger (uses non-existent entry_members) ----------
CREATE OR REPLACE FUNCTION public.trg_social_from_placement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
    FROM public.modality_entry_members em
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

-- ---------- 2a. Privacy gate on booking trigger ----------
CREATE OR REPLACE FUNCTION public.trg_social_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_hide_activity boolean;
  v_hide_checkins boolean;
  v_visibility text := 'public';
BEGIN
  IF NEW.status NOT IN ('confirmed','paid') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NEW.user_id IS NOT NULL THEN
    v_identity := public.social_identity_for_user(NEW.user_id);
  ELSIF NEW.customer_whatsapp IS NOT NULL THEN
    v_identity := public.social_identity_upsert(
      NEW.customer_whatsapp, NEW.customer_name, 'booking', NEW.tenant_id, NEW.arena_id
    );
  END IF;
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id, hide_activity, hide_checkins INTO v_profile, v_hide_activity, v_hide_checkins
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF v_hide_activity OR v_hide_checkins THEN v_visibility := 'private'; END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NEW.arena_id, 'booking',
    'booking', NEW.id,
    jsonb_build_object('booking_date', NEW.booking_date, 'start_time', NEW.start_time),
    v_visibility
  );
  RETURN NEW;
END $function$;

-- ---------- 2b. Privacy gate on payment trigger (preserve existing user resolution) ----------
CREATE OR REPLACE FUNCTION public.trg_social_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_user uuid;
  v_hide_activity boolean;
  v_visibility text := 'public';
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') THEN RETURN NEW; END IF;

  IF NEW.source_type = 'enrollment' THEN
    SELECT athlete_user_id INTO v_user FROM public.enrollments WHERE id = NEW.source_id;
  ELSIF NEW.source_type = 'booking' THEN
    SELECT user_id INTO v_user FROM public.bookings WHERE id = NEW.source_id;
  END IF;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  BEGIN v_identity := public.social_identity_for_user(v_user);
  EXCEPTION WHEN OTHERS THEN v_identity := NULL; END;
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id, hide_activity INTO v_profile, v_hide_activity
    FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF v_hide_activity THEN v_visibility := 'private'; END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NULL, 'payment_completed',
    NEW.source_type, NEW.source_id,
    jsonb_build_object('amount', NEW.amount),
    v_visibility
  );
  RETURN NEW;
END $function$;

-- ---------- 3. BACKFILL ----------
-- Helper: build a generic inserter that respects (profile_id, event_type, entity_id) idempotency

-- 3a. tournament_won from existing athlete_activities
DO $$
DECLARE r RECORD; v_identity uuid; v_profile uuid; v_hide boolean; v_t_name text;
BEGIN
  FOR r IN
    SELECT aa.*
    FROM public.athlete_activities aa
    WHERE aa.activity_type = 'tournament.won'
  LOOP
    BEGIN
      v_identity := public.social_identity_for_user(r.athlete_id);
      IF v_identity IS NULL THEN CONTINUE; END IF;
      SELECT id, hide_activity INTO v_profile, v_hide
        FROM public.social_profiles WHERE identity_id = v_identity;
      IF v_profile IS NULL THEN CONTINUE; END IF;
      v_t_name := NULL;
      IF r.reference_type = 'tournament' AND r.reference_id IS NOT NULL THEN
        SELECT name INTO v_t_name FROM public.tournaments WHERE id = r.reference_id;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.social_events
         WHERE profile_id = v_profile AND event_type = 'tournament_won'
           AND COALESCE(entity_id,'00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(r.reference_id,'00000000-0000-0000-0000-000000000000'::uuid)
      ) THEN
        INSERT INTO public.social_events (profile_id, tenant_id, arena_id, event_type, entity_type, entity_id, payload, visibility, created_at)
        VALUES (v_profile, r.tenant_id, r.arena_id, 'tournament_won', 'tournament', r.reference_id,
                COALESCE(r.metadata,'{}'::jsonb) || jsonb_build_object('tournament_id', r.reference_id, 'tournament_name', v_t_name),
                CASE WHEN v_hide THEN 'private' ELSE 'public' END,
                r.created_at);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill tournament_won failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3b. tournament_advance — derive from modality_matches that already have a tournament.match_won activity
-- but no tournament.advance counterpart. Insert into athlete_activities so the existing
-- trg_social_from_activity fires and creates the social_event in one shot.
DO $$
DECLARE m RECORD; v_winner_user uuid; v_max_round int; v_rounds_left int; v_phase text; v_next text;
        v_t_id uuid; v_t_name text; v_meta jsonb;
BEGIN
  FOR m IN
    SELECT mm.*
    FROM public.modality_matches mm
    WHERE mm.winner_entry_id IS NOT NULL
      AND mm.group_id IS NULL
  LOOP
    BEGIN
      SELECT em.user_id INTO v_winner_user
        FROM public.modality_entry_members em
        WHERE em.entry_id = m.winner_entry_id LIMIT 1;
      IF v_winner_user IS NULL THEN CONTINUE; END IF;

      SELECT MAX(round_number) INTO v_max_round
        FROM public.modality_matches WHERE modality_id = m.modality_id AND group_id IS NULL;
      v_rounds_left := COALESCE(v_max_round,0) - COALESCE(m.round_number,0);
      IF v_rounds_left <= 0 THEN CONTINUE; END IF;

      v_phase := CASE
        WHEN v_rounds_left = 1 THEN 'semifinal'
        WHEN v_rounds_left = 2 THEN 'quartas de final'
        WHEN v_rounds_left = 3 THEN 'oitavas de final'
        ELSE 'rodada ' || COALESCE(m.round_number::text,'?') END;
      v_next := CASE
        WHEN v_rounds_left = 1 THEN 'a final'
        WHEN v_rounds_left = 2 THEN 'a semifinal'
        WHEN v_rounds_left = 3 THEN 'as quartas de final'
        ELSE 'a rodada ' || ((COALESCE(m.round_number,0)+1)::text) END;

      SELECT tm.tournament_id, t.name INTO v_t_id, v_t_name
        FROM public.tournament_modalities tm
        LEFT JOIN public.tournaments t ON t.id = tm.tournament_id
        WHERE tm.id = m.modality_id;

      v_meta := jsonb_build_object(
        'modality_id', m.modality_id, 'round_number', m.round_number,
        'phase_label', v_phase, 'next_phase_label', v_next,
        'tournament_id', v_t_id, 'tournament_name', v_t_name
      );

      IF NOT EXISTS (
        SELECT 1 FROM public.athlete_activities
         WHERE athlete_id = v_winner_user AND activity_type='tournament.advance'
           AND reference_type='modality_match' AND reference_id = m.id
      ) THEN
        INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
        VALUES (v_winner_user, m.tenant_id, 'tournament.advance', 'modality_match', m.id, v_meta);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill advance failed for match %: %', m.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3c. tournament_podium from modality_placements
DO $$
DECLARE p RECORD; v_identity uuid; v_profile uuid; v_hide boolean;
        v_t_id uuid; v_t_name text; v_user uuid;
BEGIN
  FOR p IN
    SELECT * FROM public.modality_placements WHERE position IN (2,3)
  LOOP
    SELECT tm.tournament_id, t.name INTO v_t_id, v_t_name
      FROM public.tournament_modalities tm
      JOIN public.tournaments t ON t.id = tm.tournament_id
      WHERE tm.id = p.modality_id;
    FOR v_user IN
      SELECT DISTINCT em.user_id FROM public.modality_entry_members em
      WHERE em.entry_id = p.entry_id AND em.user_id IS NOT NULL
    LOOP
      BEGIN
        v_identity := public.social_identity_for_user(v_user);
        IF v_identity IS NULL THEN CONTINUE; END IF;
        SELECT id, hide_activity INTO v_profile, v_hide
          FROM public.social_profiles WHERE identity_id = v_identity;
        IF v_profile IS NULL THEN CONTINUE; END IF;
        IF NOT EXISTS (
          SELECT 1 FROM public.social_events
           WHERE profile_id = v_profile AND event_type = 'tournament_podium'
             AND entity_id = v_t_id
             AND COALESCE((payload->>'position')::int,0) = p.position
        ) THEN
          INSERT INTO public.social_events (profile_id, tenant_id, arena_id, event_type, entity_type, entity_id, payload, visibility)
          VALUES (v_profile, p.tenant_id, NULL, 'tournament_podium', 'tournament', v_t_id,
                  jsonb_build_object('position', p.position, 'tournament_id', v_t_id, 'tournament_name', v_t_name),
                  CASE WHEN v_hide THEN 'private' ELSE 'public' END);
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill podium failed: %', SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 3d. badge_earned from athlete_badges
DO $$
DECLARE b RECORD; v_identity uuid; v_profile uuid; v_hide boolean; v_name text;
BEGIN
  FOR b IN SELECT * FROM public.athlete_badges LOOP
    BEGIN
      v_identity := public.social_identity_for_user(b.athlete_id);
      IF v_identity IS NULL THEN CONTINUE; END IF;
      SELECT id, hide_activity INTO v_profile, v_hide
        FROM public.social_profiles WHERE identity_id = v_identity;
      IF v_profile IS NULL THEN CONTINUE; END IF;
      SELECT name INTO v_name FROM public.badges_catalog WHERE code = b.badge_code;
      IF NOT EXISTS (
        SELECT 1 FROM public.social_events
         WHERE profile_id = v_profile AND event_type = 'badge_earned'
           AND entity_type = 'athlete_badges' AND entity_id = b.id
      ) THEN
        INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility, created_at)
        VALUES (v_profile, 'badge_earned', 'athlete_badges', b.id,
                jsonb_build_object('badge_code', b.badge_code, 'badge_name', COALESCE(v_name, b.badge_code)),
                CASE WHEN v_hide THEN 'private' ELSE 'public' END,
                COALESCE(b.earned_at, now()));
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill badge failed: %', SQLERRM;
    END;
  END LOOP;
END $$;

-- 3e. level_up from athlete_xp (one event per athlete with level > 1)
DO $$
DECLARE x RECORD; v_identity uuid; v_profile uuid; v_hide boolean;
BEGIN
  FOR x IN SELECT * FROM public.athlete_xp WHERE level > 1 LOOP
    BEGIN
      v_identity := public.social_identity_for_user(x.athlete_id);
      IF v_identity IS NULL THEN CONTINUE; END IF;
      SELECT id, hide_activity INTO v_profile, v_hide
        FROM public.social_profiles WHERE identity_id = v_identity;
      IF v_profile IS NULL THEN CONTINUE; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.social_events
         WHERE profile_id = v_profile AND event_type = 'level_up'
           AND COALESCE((payload->>'level')::int,0) = x.level
      ) THEN
        INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility, created_at)
        VALUES (v_profile, 'level_up', 'athlete_xp', x.athlete_id,
                jsonb_build_object('level', x.level, 'lifetime_xp', x.lifetime_xp),
                CASE WHEN v_hide THEN 'private' ELSE 'public' END,
                COALESCE(x.updated_at, now()));
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill level_up failed: %', SQLERRM;
    END;
  END LOOP;
END $$;

-- 3f. streak_milestone from athlete_streaks
DO $$
DECLARE s RECORD; v_identity uuid; v_profile uuid; v_hide boolean;
BEGIN
  FOR s IN SELECT * FROM public.athlete_streaks
           WHERE current_streak >= 7 AND current_streak % 7 = 0 LOOP
    BEGIN
      v_identity := public.social_identity_for_user(s.athlete_id);
      IF v_identity IS NULL THEN CONTINUE; END IF;
      SELECT id, hide_activity INTO v_profile, v_hide
        FROM public.social_profiles WHERE identity_id = v_identity;
      IF v_profile IS NULL THEN CONTINUE; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.social_events
         WHERE profile_id = v_profile AND event_type = 'streak_milestone'
           AND COALESCE((payload->>'days')::int,0) = s.current_streak
      ) THEN
        INSERT INTO public.social_events (profile_id, event_type, entity_type, entity_id, payload, visibility, created_at)
        VALUES (v_profile, 'streak_milestone', 'athlete_streaks', s.athlete_id,
                jsonb_build_object('days', s.current_streak),
                CASE WHEN v_hide THEN 'private' ELSE 'public' END,
                COALESCE(s.updated_at, now()));
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backfill streak failed: %', SQLERRM;
    END;
  END LOOP;
END $$;
