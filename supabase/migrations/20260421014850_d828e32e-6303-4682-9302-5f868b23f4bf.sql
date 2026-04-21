-- ============================================================
-- FASE 6 — Marketplace + Ads + Social Graph
-- ============================================================

-- =========================================
-- BLOCO A — Social Graph
-- =========================================

CREATE TABLE IF NOT EXISTS public.athlete_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  tenant_id uuid,
  arena_id uuid,
  activity_type text NOT NULL CHECK (activity_type IN (
    'tournament.enrolled','tournament.checked_in','tournament.match_won','tournament.match_lost','tournament.placed',
    'class.attended','class.enrolled',
    'social.posted','social.clip_posted'
  )),
  reference_type text,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_activities_athlete ON public.athlete_activities (athlete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_athlete_activities_type ON public.athlete_activities (activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_athlete_activities_tenant ON public.athlete_activities (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_activities_dedup ON public.athlete_activities (athlete_id, activity_type, reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.athlete_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_activities_admin_select" ON public.athlete_activities;
CREATE POLICY "athlete_activities_admin_select" ON public.athlete_activities
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR athlete_id = auth.uid());

-- ----- Triggers de população -----

CREATE OR REPLACE FUNCTION public.trg_activity_from_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid; v_tenant uuid;
BEGIN
  v_user := COALESCE(NEW.user_id, NEW.payer_id);
  IF v_user IS NULL THEN RETURN NEW; END IF;
  SELECT tenant_id INTO v_tenant FROM public.tournaments WHERE id = NEW.tournament_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
    VALUES (v_user, v_tenant, 'tournament.enrolled', 'tournament', NEW.tournament_id,
            jsonb_build_object('enrollment_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.checked_in_at IS NOT NULL AND (OLD.checked_in_at IS NULL OR OLD.checked_in_at IS DISTINCT FROM NEW.checked_in_at) THEN
    INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
    VALUES (v_user, v_tenant, 'tournament.checked_in', 'tournament', NEW.tournament_id,
            jsonb_build_object('enrollment_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_enrollment_ins ON public.enrollments;
CREATE TRIGGER trg_activity_enrollment_ins AFTER INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_enrollment();
DROP TRIGGER IF EXISTS trg_activity_enrollment_upd ON public.enrollments;
CREATE TRIGGER trg_activity_enrollment_upd AFTER UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_enrollment();

CREATE OR REPLACE FUNCTION public.trg_activity_from_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_winner_user uuid; v_loser_user uuid; v_loser_entry uuid; v_tenant uuid;
BEGIN
  IF NEW.winner_entry_id IS NULL OR NEW.winner_entry_id IS NOT DISTINCT FROM OLD.winner_entry_id THEN
    RETURN NEW;
  END IF;

  v_loser_entry := CASE WHEN NEW.winner_entry_id = NEW.entry_a_id THEN NEW.entry_b_id ELSE NEW.entry_a_id END;
  v_tenant := NEW.tenant_id;

  SELECT em.user_id INTO v_winner_user
    FROM public.modality_entry_members em
    WHERE em.entry_id = NEW.winner_entry_id LIMIT 1;
  IF v_winner_user IS NOT NULL THEN
    INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
    VALUES (v_winner_user, v_tenant, 'tournament.match_won', 'modality_match', NEW.id,
            jsonb_build_object('modality_id', NEW.modality_id, 'score_a', NEW.score_a, 'score_b', NEW.score_b))
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_loser_entry IS NOT NULL THEN
    SELECT em.user_id INTO v_loser_user
      FROM public.modality_entry_members em
      WHERE em.entry_id = v_loser_entry LIMIT 1;
    IF v_loser_user IS NOT NULL THEN
      INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
      VALUES (v_loser_user, v_tenant, 'tournament.match_lost', 'modality_match', NEW.id,
              jsonb_build_object('modality_id', NEW.modality_id, 'score_a', NEW.score_a, 'score_b', NEW.score_b))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_match ON public.modality_matches;
CREATE TRIGGER trg_activity_match AFTER UPDATE ON public.modality_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_match();

CREATE OR REPLACE FUNCTION public.trg_activity_from_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid;
BEGIN
  IF NEW.status <> 'present' THEN RETURN NEW; END IF;
  SELECT profile_user_id INTO v_user FROM public.arena_students WHERE id = NEW.student_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.athlete_activities (athlete_id, tenant_id, arena_id, activity_type, reference_type, reference_id, metadata)
  VALUES (v_user, NEW.tenant_id, NEW.arena_id, 'class.attended', 'class', NEW.class_id,
          jsonb_build_object('attendance_id', NEW.id))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_attendance ON public.arena_attendance;
CREATE TRIGGER trg_activity_attendance AFTER INSERT ON public.arena_attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_attendance();

CREATE OR REPLACE FUNCTION public.trg_activity_from_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
  VALUES (NEW.author_id, NEW.tenant_id, 'social.posted', 'post', NEW.id,
          jsonb_build_object('type', NEW.type))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_post ON public.posts;
CREATE TRIGGER trg_activity_post AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_post();

CREATE OR REPLACE FUNCTION public.trg_activity_from_clip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
  VALUES (NEW.author_id, NEW.tenant_id, 'social.clip_posted', 'clip', NEW.id, '{}'::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_clip ON public.clips;
CREATE TRIGGER trg_activity_clip AFTER INSERT ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_clip();

-- ----- Backfill -----
DO $$
BEGIN
  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata, created_at)
  SELECT COALESCE(e.user_id, e.payer_id), t.tenant_id, 'tournament.enrolled', 'tournament', e.tournament_id,
         jsonb_build_object('enrollment_id', e.id), e.created_at
    FROM public.enrollments e JOIN public.tournaments t ON t.id = e.tournament_id
   WHERE COALESCE(e.user_id, e.payer_id) IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata, created_at)
  SELECT COALESCE(e.user_id, e.payer_id), t.tenant_id, 'tournament.checked_in', 'tournament', e.tournament_id,
         jsonb_build_object('enrollment_id', e.id), e.checked_in_at
    FROM public.enrollments e JOIN public.tournaments t ON t.id = e.tournament_id
   WHERE COALESCE(e.user_id, e.payer_id) IS NOT NULL AND e.checked_in_at IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO public.athlete_activities (athlete_id, tenant_id, arena_id, activity_type, reference_type, reference_id, metadata, created_at)
  SELECT s.profile_user_id, a.tenant_id, a.arena_id, 'class.attended', 'class', a.class_id,
         jsonb_build_object('attendance_id', a.id), a.checked_in_at
    FROM public.arena_attendance a JOIN public.arena_students s ON s.id = a.student_id
   WHERE a.status = 'present' AND s.profile_user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata, created_at)
  SELECT p.author_id, p.tenant_id, 'social.posted', 'post', p.id, jsonb_build_object('type', p.type), p.created_at
    FROM public.posts p
  ON CONFLICT DO NOTHING;

  INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata, created_at)
  SELECT c.author_id, c.tenant_id, 'social.clip_posted', 'clip', c.id, '{}'::jsonb, c.created_at
    FROM public.clips c
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ----- Views públicas (Bloco A) -----

DROP VIEW IF EXISTS public.athletes_public CASCADE;
CREATE VIEW public.athletes_public WITH (security_invoker=on) AS
SELECT p.user_id, p.full_name, p.avatar_url, p.bio, p.city, p.state, p.team, p.titles,
       COALESCE(s.wins, 0) AS wins,
       COALESCE(s.participations, 0) AS participations,
       COALESCE(s.attendances, 0) AS attendances,
       COALESCE(s.last_activity_at, p.created_at) AS last_activity_at,
       p.created_at
FROM public.profiles_public p
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE activity_type='tournament.match_won') AS wins,
    count(*) FILTER (WHERE activity_type='tournament.enrolled') AS participations,
    count(*) FILTER (WHERE activity_type='class.attended') AS attendances,
    max(created_at) AS last_activity_at
  FROM public.athlete_activities WHERE athlete_id = p.user_id
) s ON true;

GRANT SELECT ON public.athletes_public TO anon, authenticated;

DROP VIEW IF EXISTS public.athlete_activities_public CASCADE;
CREATE VIEW public.athlete_activities_public WITH (security_invoker=on) AS
SELECT aa.id, aa.athlete_id, aa.activity_type, aa.reference_type, aa.reference_id,
       aa.metadata, aa.created_at, aa.tenant_id, aa.arena_id
FROM public.athlete_activities aa
WHERE aa.activity_type IN (
  'tournament.match_won','tournament.match_lost','tournament.placed',
  'tournament.checked_in','tournament.enrolled','social.posted','social.clip_posted'
);

GRANT SELECT ON public.athlete_activities_public TO anon, authenticated;

-- =========================================
-- BLOCO B — Marketplace extension
-- =========================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kind text DEFAULT 'physical';
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_kind_chk CHECK (kind IN ('physical','service','class_pass','event_ticket'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS service_arena_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS service_duration_minutes int;

DROP VIEW IF EXISTS public.marketplace_public CASCADE;
CREATE VIEW public.marketplace_public WITH (security_invoker=on) AS
SELECT p.id, p.name, p.description, p.price, p.image_urls, p.kind, p.featured,
       p.company_id, c.name AS company_name, c.logo_url AS company_logo,
       c.city, c.state,
       p.service_arena_id, p.service_duration_minutes, p.created_at
FROM public.products p
JOIN public.companies c ON c.id = p.company_id
WHERE p.status = 'approved' AND c.status = 'approved';

GRANT SELECT ON public.marketplace_public TO anon, authenticated;

-- =========================================
-- BLOCO C — Ads / Patrocínio interno
-- =========================================

CREATE TABLE IF NOT EXISTS public.ad_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  max_active int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_slots_admin_all" ON public.ad_slots;
CREATE POLICY "ad_slots_admin_all" ON public.ad_slots
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "ad_slots_select_all" ON public.ad_slots;
CREATE POLICY "ad_slots_select_all" ON public.ad_slots
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.ad_slots (code, name, description, max_active) VALUES
  ('home.hero', 'Home — Hero', 'Banner principal da landing', 1),
  ('feed.inline', 'Feed — Inline', 'Card patrocinado no feed', 3),
  ('tournaments.list_top', 'Torneios — Topo', 'Destaque acima da lista de torneios', 1),
  ('arena.banner', 'Arena — Banner', 'Banner em página de arena', 2),
  ('marketplace.featured', 'Marketplace — Destaque', 'Destaque no marketplace', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('feed_highlight','tournament_highlight','arena_highlight','marketplace_highlight')),
  target_type text,
  target_id uuid,
  title text,
  image_url text,
  link text,
  cta_label text,
  budget numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','ended','rejected')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.ad_campaigns (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_company ON public.ad_campaigns (company_id);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_campaigns_admin_all" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_admin_all" ON public.ad_campaigns
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "ad_campaigns_company_owner_select" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_company_owner_select" ON public.ad_campaigns
  FOR SELECT TO authenticated USING (public.is_company_owner(company_id, auth.uid()));
DROP POLICY IF EXISTS "ad_campaigns_company_owner_insert" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_company_owner_insert" ON public.ad_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_company_owner(company_id, auth.uid()) AND status = 'pending');
DROP POLICY IF EXISTS "ad_campaigns_company_owner_update" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_company_owner_update" ON public.ad_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_company_owner(company_id, auth.uid()) AND status IN ('pending','paused'))
  WITH CHECK (public.is_company_owner(company_id, auth.uid()) AND status IN ('pending','paused'));

DROP TRIGGER IF EXISTS trg_ad_campaigns_updated ON public.ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_updated BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.ad_slots(id) ON DELETE CASCADE,
  weight int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, slot_id)
);

ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_placements_admin_all" ON public.ad_placements;
CREATE POLICY "ad_placements_admin_all" ON public.ad_placements
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "ad_placements_company_select" ON public.ad_placements;
CREATE POLICY "ad_placements_company_select" ON public.ad_placements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ad_campaigns ac
            WHERE ac.id = campaign_id AND public.is_company_owner(ac.company_id, auth.uid()))
  );
DROP POLICY IF EXISTS "ad_placements_company_insert" ON public.ad_placements;
CREATE POLICY "ad_placements_company_insert" ON public.ad_placements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.ad_campaigns ac
            WHERE ac.id = campaign_id AND public.is_company_owner(ac.company_id, auth.uid()))
  );
DROP POLICY IF EXISTS "ad_placements_company_delete" ON public.ad_placements;
CREATE POLICY "ad_placements_company_delete" ON public.ad_placements
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ad_campaigns ac
            WHERE ac.id = campaign_id AND public.is_company_owner(ac.company_id, auth.uid()))
  );

CREATE TABLE IF NOT EXISTS public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.ad_slots(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  viewer_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ad_events_campaign ON public.ad_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_type ON public.ad_events (event_type, occurred_at DESC);

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_events_admin_select" ON public.ad_events;
CREATE POLICY "ad_events_admin_select" ON public.ad_events
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.ad_campaigns ac
            WHERE ac.id = campaign_id AND public.is_company_owner(ac.company_id, auth.uid()))
  );

DROP VIEW IF EXISTS public.ads_public CASCADE;
CREATE VIEW public.ads_public WITH (security_invoker=on) AS
SELECT ac.id, ac.kind, ac.target_type, ac.target_id, ac.title, ac.image_url, ac.link, ac.cta_label,
       ac.priority, asl.code AS slot_code, asl.id AS slot_id,
       c.name AS company_name, c.logo_url AS company_logo
FROM public.ad_campaigns ac
JOIN public.ad_placements ap ON ap.campaign_id = ac.id
JOIN public.ad_slots asl ON asl.id = ap.slot_id
JOIN public.companies c ON c.id = ac.company_id
WHERE ac.status='active'
  AND now() BETWEEN ac.starts_at AND ac.ends_at
  AND c.status='approved';

GRANT SELECT ON public.ads_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ad_record_event(_campaign_id uuid, _slot_id uuid, _event_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_camp record;
BEGIN
  IF _event_type NOT IN ('impression','click') THEN RAISE EXCEPTION 'invalid_event_type'; END IF;
  SELECT id, target_type, target_id, tenant_id INTO v_camp FROM public.ad_campaigns WHERE id = _campaign_id;
  IF v_camp IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  INSERT INTO public.ad_events (campaign_id, slot_id, event_type, viewer_id)
  VALUES (_campaign_id, _slot_id, _event_type, auth.uid())
  RETURNING id INTO v_id;

  IF v_camp.target_type = 'arena' AND v_camp.target_id IS NOT NULL THEN
    INSERT INTO public.arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
    VALUES (v_camp.tenant_id, v_camp.target_id, 'ad_campaign', _campaign_id,
            'ads.' || _event_type || '_recorded',
            jsonb_build_object('slot_id', _slot_id, 'viewer_id', auth.uid()), 'system');
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.ad_record_event(uuid, uuid, text) TO authenticated, anon;

-- =========================================
-- BLOCO D — Discovery / Feed global
-- =========================================

DROP VIEW IF EXISTS public.social_feed_public CASCADE;
CREATE VIEW public.social_feed_public WITH (security_invoker=on) AS
SELECT 'post'::text AS item_type, p.id AS item_id, p.author_id AS actor_id,
       NULL::uuid AS arena_id, p.tenant_id, p.created_at,
       jsonb_build_object('content', p.content, 'type', p.type) AS payload
FROM public.posts p
UNION ALL
SELECT 'activity', aa.id, aa.athlete_id, aa.arena_id, aa.tenant_id, aa.created_at,
       jsonb_build_object('activity_type', aa.activity_type, 'metadata', aa.metadata, 'reference_type', aa.reference_type, 'reference_id', aa.reference_id)
FROM public.athlete_activities aa
WHERE aa.activity_type IN ('tournament.match_won','tournament.placed','tournament.checked_in')
UNION ALL
SELECT 'ad', ac.id, NULL::uuid, NULL::uuid, ac.tenant_id, ac.created_at,
       jsonb_build_object('title', ac.title, 'image_url', ac.image_url, 'link', ac.link, 'kind', ac.kind, 'company_id', ac.company_id)
FROM public.ad_campaigns ac
WHERE ac.status='active' AND now() BETWEEN ac.starts_at AND ac.ends_at
UNION ALL
SELECT 'tournament', t.id, t.organizer_id, NULL::uuid, t.tenant_id, t.created_at,
       jsonb_build_object('name', t.name, 'start_date', t.start_date, 'image_url', t.image_url)
FROM public.tournaments t
WHERE COALESCE(t.is_public, true) = true;

GRANT SELECT ON public.social_feed_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_global(_term text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_term text; v_result jsonb;
BEGIN
  v_term := '%' || lower(trim(coalesce(_term,''))) || '%';
  IF length(trim(coalesce(_term,''))) < 2 THEN
    RETURN jsonb_build_object('athletes','[]'::jsonb,'arenas','[]'::jsonb,'tournaments','[]'::jsonb,'products','[]'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'athletes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'full_name', full_name, 'avatar_url', avatar_url, 'wins', wins, 'city', city))
      FROM (SELECT * FROM public.athletes_public WHERE lower(coalesce(full_name,'')) LIKE v_term ORDER BY wins DESC NULLS LAST LIMIT 5) a
    ), '[]'::jsonb),
    'arenas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug, 'city', city, 'cover_image_url', cover_image_url))
      FROM (SELECT * FROM public.arenas_public WHERE lower(coalesce(name,'')) LIKE v_term LIMIT 5) ar
    ), '[]'::jsonb),
    'tournaments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'start_date', start_date, 'image_url', image_url))
      FROM (SELECT * FROM public.tournaments WHERE COALESCE(is_public,true)=true AND lower(coalesce(name,'')) LIKE v_term ORDER BY start_date DESC NULLS LAST LIMIT 5) t
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price, 'image_urls', image_urls, 'company_name', company_name))
      FROM (SELECT * FROM public.marketplace_public WHERE lower(coalesce(name,'')) LIKE v_term OR lower(coalesce(company_name,'')) LIKE v_term LIMIT 5) p
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.search_global(text) TO anon, authenticated;