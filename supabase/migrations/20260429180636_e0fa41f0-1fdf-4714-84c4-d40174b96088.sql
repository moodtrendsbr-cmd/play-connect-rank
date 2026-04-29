
-- ============================================================
-- PHASE G-1: Gamification Core (XP, Badges, Streaks)
-- ============================================================

-- 1. ATHLETE_XP — current balance and lifetime total
CREATE TABLE public.athlete_xp (
  athlete_id uuid PRIMARY KEY,
  current_xp integer NOT NULL DEFAULT 0,
  lifetime_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_xp self read"
  ON public.athlete_xp FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "athlete_xp public read minimal"
  ON public.athlete_xp FOR SELECT
  USING (true);

-- 2. XP_EVENTS — append-only ledger with idempotency
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  source text NOT NULL,            -- e.g. 'match', 'checkin', 'enrollment', 'post'
  source_id uuid,                  -- entity id; nullable for ad-hoc grants
  delta integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, source, source_id)
);

CREATE INDEX idx_xp_events_athlete ON public.xp_events (athlete_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_events self read"
  ON public.xp_events FOR SELECT
  USING (auth.uid() = athlete_id);

-- 3. BADGES_CATALOG — global catalog
CREATE TABLE public.badges_catalog (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text,                        -- icon name (lucide) or url
  category text NOT NULL DEFAULT 'general',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  xp_reward integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_catalog public read"
  ON public.badges_catalog FOR SELECT
  USING (active = true);

-- 4. ATHLETE_BADGES — earned badges
CREATE TABLE public.athlete_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  badge_code text NOT NULL REFERENCES public.badges_catalog(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, badge_code)
);

CREATE INDEX idx_athlete_badges_athlete ON public.athlete_badges (athlete_id, earned_at DESC);

ALTER TABLE public.athlete_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_badges public read"
  ON public.athlete_badges FOR SELECT
  USING (true);

-- 5. ATHLETE_STREAKS — unified streak (any activity counts)
CREATE TABLE public.athlete_streaks (
  athlete_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_streaks public read"
  ON public.athlete_streaks FOR SELECT
  USING (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- award_xp: idempotent XP grant
CREATE OR REPLACE FUNCTION public.award_xp(
  _athlete uuid,
  _source text,
  _source_id uuid,
  _delta integer,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted boolean := false;
  _new_total integer;
  _new_level integer;
BEGIN
  IF _athlete IS NULL OR _delta IS NULL OR _delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_input');
  END IF;

  -- Idempotent insert
  INSERT INTO public.xp_events (athlete_id, source, source_id, delta, reason)
  VALUES (_athlete, _source, _source_id, _delta, _reason)
  ON CONFLICT (athlete_id, source, source_id) DO NOTHING
  RETURNING true INTO _inserted;

  IF _inserted IS NULL OR _inserted = false THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Upsert balance
  INSERT INTO public.athlete_xp (athlete_id, current_xp, lifetime_xp, updated_at)
  VALUES (_athlete, _delta, GREATEST(_delta, 0), now())
  ON CONFLICT (athlete_id) DO UPDATE
    SET current_xp = public.athlete_xp.current_xp + _delta,
        lifetime_xp = public.athlete_xp.lifetime_xp + GREATEST(_delta, 0),
        level = GREATEST(1, FLOOR(SQRT((public.athlete_xp.lifetime_xp + GREATEST(_delta,0))::numeric / 100))::int + 1),
        updated_at = now()
  RETURNING lifetime_xp, level INTO _new_total, _new_level;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'lifetime_xp', _new_total, 'level', _new_level);
END;
$$;

-- update_streak: unified streak (any activity)
CREATE OR REPLACE FUNCTION public.update_streak(
  _athlete uuid,
  _activity_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last date;
  _current int;
  _longest int;
BEGIN
  IF _athlete IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT last_activity_date, current_streak, longest_streak
    INTO _last, _current, _longest
    FROM public.athlete_streaks WHERE athlete_id = _athlete;

  IF _last IS NULL THEN
    INSERT INTO public.athlete_streaks (athlete_id, current_streak, longest_streak, last_activity_date)
    VALUES (_athlete, 1, 1, _activity_date)
    ON CONFLICT (athlete_id) DO UPDATE
      SET current_streak = 1, longest_streak = GREATEST(public.athlete_streaks.longest_streak, 1),
          last_activity_date = _activity_date, updated_at = now();
    RETURN jsonb_build_object('success', true, 'current', 1);
  END IF;

  IF _activity_date = _last THEN
    -- same day, no change
    RETURN jsonb_build_object('success', true, 'current', _current, 'noop', true);
  ELSIF _activity_date = _last + 1 THEN
    _current := _current + 1;
  ELSE
    _current := 1;
  END IF;

  _longest := GREATEST(_longest, _current);

  UPDATE public.athlete_streaks
     SET current_streak = _current,
         longest_streak = _longest,
         last_activity_date = _activity_date,
         updated_at = now()
   WHERE athlete_id = _athlete;

  RETURN jsonb_build_object('success', true, 'current', _current, 'longest', _longest);
END;
$$;

-- evaluate_badges: check catalog and award eligible badges
CREATE OR REPLACE FUNCTION public.evaluate_badges(_athlete uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Aggregate stats
  SELECT COUNT(*) FILTER (WHERE mm.winner_entry_id = mem.entry_id) INTO _wins
    FROM public.modality_entry_members mem
    JOIN public.modality_matches mm
      ON mm.entry_a_id = mem.entry_id OR mm.entry_b_id = mem.entry_id
   WHERE mem.athlete_id = _athlete AND mm.status = 'completed';

  SELECT COUNT(*) INTO _matches
    FROM public.modality_entry_members mem
    JOIN public.modality_matches mm
      ON mm.entry_a_id = mem.entry_id OR mm.entry_b_id = mem.entry_id
   WHERE mem.athlete_id = _athlete AND mm.status = 'completed';

  SELECT COUNT(*) INTO _attendances FROM public.arena_attendance WHERE athlete_id = _athlete AND status = 'present';
  SELECT COUNT(*) INTO _posts FROM public.posts WHERE author_id = _athlete;
  SELECT COUNT(*) INTO _enrollments FROM public.enrollments WHERE athlete_id = _athlete;
  SELECT COALESCE(longest_streak, 0) INTO _streak FROM public.athlete_streaks WHERE athlete_id = _athlete;

  -- Iterate active badges and check criteria
  FOR _b IN SELECT code, criteria, xp_reward FROM public.badges_catalog WHERE active = true LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = _athlete AND badge_code = _b.code) THEN
      CONTINUE;
    END IF;

    _eligible := false;

    -- Criteria evaluation (simple JSON keys)
    IF (_b.criteria ? 'min_wins') AND _wins >= (_b.criteria->>'min_wins')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_matches') AND _matches >= (_b.criteria->>'min_matches')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_attendances') AND _attendances >= (_b.criteria->>'min_attendances')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_posts') AND _posts >= (_b.criteria->>'min_posts')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_enrollments') AND _enrollments >= (_b.criteria->>'min_enrollments')::int THEN _eligible := true; END IF;
    IF (_b.criteria ? 'min_streak') AND _streak >= (_b.criteria->>'min_streak')::int THEN _eligible := true; END IF;

    IF _eligible THEN
      INSERT INTO public.athlete_badges (athlete_id, badge_code) VALUES (_athlete, _b.code)
      ON CONFLICT DO NOTHING;
      _awarded := array_append(_awarded, _b.code);

      IF _b.xp_reward > 0 THEN
        PERFORM public.award_xp(_athlete, 'badge', NULL, _b.xp_reward, 'Badge: ' || _b.code);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'awarded', _awarded);
END;
$$;

-- ============================================================
-- TRIGGERS — auto-grant XP and update streaks
-- ============================================================

-- Trigger on modality_matches: when a match is completed
CREATE OR REPLACE FUNCTION public.trg_xp_from_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _athlete uuid;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    -- Grant XP to all participants of both entries
    FOR _athlete IN
      SELECT DISTINCT mem.athlete_id
        FROM public.modality_entry_members mem
       WHERE mem.entry_id IN (NEW.entry_a_id, NEW.entry_b_id)
    LOOP
      IF NEW.winner_entry_id IS NOT NULL AND _athlete IN (
        SELECT athlete_id FROM public.modality_entry_members WHERE entry_id = NEW.winner_entry_id
      ) THEN
        PERFORM public.award_xp(_athlete, 'match_win', NEW.id, 50, 'Match win');
      ELSE
        PERFORM public.award_xp(_athlete, 'match_played', NEW.id, 10, 'Match played');
      END IF;
      PERFORM public.update_streak(_athlete, CURRENT_DATE);
      PERFORM public.evaluate_badges(_athlete);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_match ON public.modality_matches;
CREATE TRIGGER trg_xp_from_match
  AFTER INSERT OR UPDATE OF status ON public.modality_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_xp_from_match();

-- Trigger on arena_attendance: check-in/present
CREATE OR REPLACE FUNCTION public.trg_xp_from_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'present' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'present') THEN
    PERFORM public.award_xp(NEW.athlete_id, 'attendance', NEW.id, 10, 'Class check-in');
    PERFORM public.update_streak(NEW.athlete_id, CURRENT_DATE);
    PERFORM public.evaluate_badges(NEW.athlete_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_attendance ON public.arena_attendance;
CREATE TRIGGER trg_xp_from_attendance
  AFTER INSERT OR UPDATE OF status ON public.arena_attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_xp_from_attendance();

-- Trigger on enrollments
CREATE OR REPLACE FUNCTION public.trg_xp_from_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_xp(NEW.athlete_id, 'enrollment', NEW.id, 20, 'Tournament enrollment');
  PERFORM public.update_streak(NEW.athlete_id, CURRENT_DATE);
  PERFORM public.evaluate_badges(NEW.athlete_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_enrollment ON public.enrollments;
CREATE TRIGGER trg_xp_from_enrollment
  AFTER INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_xp_from_enrollment();

-- Trigger on posts
CREATE OR REPLACE FUNCTION public.trg_xp_from_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_xp(NEW.author_id, 'post', NEW.id, 5, 'Post published');
  PERFORM public.update_streak(NEW.author_id, CURRENT_DATE);
  PERFORM public.evaluate_badges(NEW.author_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_post ON public.posts;
CREATE TRIGGER trg_xp_from_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_xp_from_post();

-- ============================================================
-- SEED INITIAL BADGE CATALOG
-- ============================================================
INSERT INTO public.badges_catalog (code, name, description, icon, category, criteria, xp_reward) VALUES
  ('first_win',           'Primeira Vitória',     'Vença sua primeira partida.',                'Trophy',   'matches',    '{"min_wins":1}'::jsonb,         25),
  ('veteran_10_matches',  'Veterano',             'Dispute 10 partidas.',                        'Swords',   'matches',    '{"min_matches":10}'::jsonb,     50),
  ('champion_10_wins',    'Campeão',              'Vença 10 partidas.',                          'Crown',    'matches',    '{"min_wins":10}'::jsonb,       100),
  ('dedicated_athlete',   'Atleta Dedicado',      'Compareça a 5 aulas.',                        'Calendar', 'arena',      '{"min_attendances":5}'::jsonb,  30),
  ('marathoner',          'Maratonista',          'Compareça a 20 aulas.',                       'Activity', 'arena',      '{"min_attendances":20}'::jsonb, 80),
  ('social_butterfly',    'Borboleta Social',     'Publique 10 posts.',                          'Heart',    'social',     '{"min_posts":10}'::jsonb,       20),
  ('tournament_rookie',   'Estreante',            'Inscreva-se em seu primeiro torneio.',        'Flag',     'tournaments','{"min_enrollments":1}'::jsonb,  15),
  ('streak_7_days',       'Constância',           'Mantenha uma ofensiva de 7 dias.',            'Flame',    'streaks',    '{"min_streak":7}'::jsonb,       50)
ON CONFLICT (code) DO NOTHING;
