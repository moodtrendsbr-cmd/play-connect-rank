
-- ============================================================
-- FASE SOCIAL-1 — Identity + Social Profile + Global Feed
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ===== social_identities =====
CREATE TABLE IF NOT EXISTS public.social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  source text NOT NULL DEFAULT 'signup' CHECK (source IN ('whatsapp','qr','booking','enrollment','signup','seed','system')),
  first_tenant_id uuid,
  first_arena_id uuid,
  user_id uuid UNIQUE,
  wa_identity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user ON public.social_identities (user_id);
CREATE INDEX IF NOT EXISTS idx_social_identities_wa ON public.social_identities (wa_identity_id);

ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_identities_owner_select" ON public.social_identities;
CREATE POLICY "social_identities_owner_select" ON public.social_identities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "social_identities_admin_all" ON public.social_identities;
CREATE POLICY "social_identities_admin_all" ON public.social_identities
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ===== social_profiles =====
CREATE TABLE IF NOT EXISTS public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL UNIQUE REFERENCES public.social_identities(id) ON DELETE CASCADE,
  username citext UNIQUE,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  level text CHECK (level IN ('iniciante','intermediario','avancado')),
  main_sport text,
  city text,
  state text,
  notif_opt_in boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_profiles_visibility ON public.social_profiles (visibility);

ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_profiles_public_select" ON public.social_profiles;
CREATE POLICY "social_profiles_public_select" ON public.social_profiles
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

DROP POLICY IF EXISTS "social_profiles_owner_select" ON public.social_profiles;
CREATE POLICY "social_profiles_owner_select" ON public.social_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.social_identities si WHERE si.id = identity_id AND si.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "social_profiles_owner_update" ON public.social_profiles;
CREATE POLICY "social_profiles_owner_update" ON public.social_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.social_identities si WHERE si.id = identity_id AND si.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.social_identities si WHERE si.id = identity_id AND si.user_id = auth.uid()));

DROP POLICY IF EXISTS "social_profiles_admin_all" ON public.social_profiles;
CREATE POLICY "social_profiles_admin_all" ON public.social_profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ===== social_events =====
CREATE TABLE IF NOT EXISTS public.social_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  arena_id uuid,
  profile_id uuid NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'checkin','tournament_join','match_win','match_loss','booking',
    'class_attendance','ranking_update','tournament_created','payment_completed'
  )),
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','tenant','private')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_events_profile ON public.social_events (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_events_tenant ON public.social_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_events_type ON public.social_events (event_type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_events_dedup
  ON public.social_events (profile_id, event_type, entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE public.social_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_events_public_select" ON public.social_events;
CREATE POLICY "social_events_public_select" ON public.social_events
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

DROP POLICY IF EXISTS "social_events_owner_select" ON public.social_events;
CREATE POLICY "social_events_owner_select" ON public.social_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_profiles sp
      JOIN public.social_identities si ON si.id = sp.identity_id
      WHERE sp.id = profile_id AND si.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "social_events_admin_all" ON public.social_events;
CREATE POLICY "social_events_admin_all" ON public.social_events
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================
-- Helpers
-- =========================================

CREATE OR REPLACE FUNCTION public._social_normalize_phone(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_phone, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public._social_username_generate(_base text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_slug text;
  v_candidate text;
  v_i int := 0;
BEGIN
  v_slug := lower(regexp_replace(unaccent_safe(COALESCE(_base, 'user')), '[^a-zA-Z0-9]+', '_', 'g'));
  v_slug := regexp_replace(v_slug, '^_+|_+$', '', 'g');
  IF v_slug IS NULL OR length(v_slug) < 2 THEN v_slug := 'user'; END IF;
  v_candidate := v_slug;
  WHILE EXISTS (SELECT 1 FROM public.social_profiles WHERE username = v_candidate::citext) LOOP
    v_i := v_i + 1;
    v_candidate := v_slug || '_' || (floor(random()*9000)+1000)::text;
    IF v_i > 8 THEN
      v_candidate := v_slug || '_' || replace(gen_random_uuid()::text, '-', '');
      EXIT;
    END IF;
  END LOOP;
  RETURN v_candidate;
END $$;

-- Fallback for unaccent if extension missing
CREATE OR REPLACE FUNCTION public.unaccent_safe(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(_s, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇñÑ',
                       'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUCnN');
$$;

-- =========================================
-- social_identity_upsert
-- =========================================
CREATE OR REPLACE FUNCTION public.social_identity_upsert(
  _phone text,
  _name text DEFAULT NULL,
  _source text DEFAULT 'system',
  _tenant_id uuid DEFAULT NULL,
  _arena_id uuid DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _wa_identity_id uuid DEFAULT NULL,
  _avatar_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text;
  v_id uuid;
  v_profile_id uuid;
  v_username text;
  v_name text;
BEGIN
  v_phone := public._social_normalize_phone(_phone);
  IF v_phone IS NULL OR length(v_phone) < 8 THEN RETURN NULL; END IF;
  v_name := COALESCE(NULLIF(trim(_name), ''), 'Atleta');

  INSERT INTO public.social_identities (phone_e164, display_name, avatar_url, source, first_tenant_id, first_arena_id, user_id, wa_identity_id)
  VALUES (v_phone, v_name, _avatar_url, COALESCE(_source, 'system'), _tenant_id, _arena_id, _user_id, _wa_identity_id)
  ON CONFLICT (phone_e164) DO UPDATE SET
    display_name = COALESCE(public.social_identities.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.social_identities.avatar_url, EXCLUDED.avatar_url),
    user_id = COALESCE(public.social_identities.user_id, EXCLUDED.user_id),
    wa_identity_id = COALESCE(public.social_identities.wa_identity_id, EXCLUDED.wa_identity_id),
    first_tenant_id = COALESCE(public.social_identities.first_tenant_id, EXCLUDED.first_tenant_id),
    first_arena_id = COALESCE(public.social_identities.first_arena_id, EXCLUDED.first_arena_id),
    updated_at = now()
  RETURNING id INTO v_id;

  -- ensure profile exists
  SELECT id INTO v_profile_id FROM public.social_profiles WHERE identity_id = v_id;
  IF v_profile_id IS NULL THEN
    v_username := public._social_username_generate(v_name);
    INSERT INTO public.social_profiles (identity_id, username, display_name, avatar_url)
    VALUES (v_id, v_username, v_name, _avatar_url);
  END IF;

  RETURN v_id;
END $$;

-- =========================================
-- social_identity_for_user — resolve/create identity for an auth user
-- =========================================
CREATE OR REPLACE FUNCTION public.social_identity_for_user(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_phone text;
  v_name text;
  v_avatar text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.social_identities WHERE user_id = _user_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT public._social_normalize_phone(whatsapp), full_name, avatar_url
    INTO v_phone, v_name, v_avatar
    FROM public.profiles WHERE user_id = _user_id;

  IF v_phone IS NULL THEN
    v_phone := 'u_' || replace(_user_id::text, '-', '');
  END IF;

  RETURN public.social_identity_upsert(v_phone, v_name, 'signup', NULL, NULL, _user_id, NULL, v_avatar);
END $$;

-- =========================================
-- Description generator
-- =========================================
CREATE OR REPLACE FUNCTION public.social_event_description(
  _event_type text, _payload jsonb, _name text, _arena_name text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _event_type
    WHEN 'checkin' THEN COALESCE(_name,'Atleta') || ' fez check-in' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_join' THEN COALESCE(_name,'Atleta') || ' entrou em ' || COALESCE(_payload->>'tournament_name', 'um torneio')
    WHEN 'match_win' THEN COALESCE(_name,'Atleta') || ' venceu sua partida'
    WHEN 'match_loss' THEN COALESCE(_name,'Atleta') || ' disputou sua partida'
    WHEN 'booking' THEN COALESCE(_name,'Atleta') || ' reservou uma quadra' || COALESCE(' em ' || _arena_name, '')
    WHEN 'class_attendance' THEN COALESCE(_name,'Atleta') || ' treinou' || COALESCE(' em ' || _arena_name, '')
    WHEN 'tournament_created' THEN 'Novo torneio: ' || COALESCE(_payload->>'tournament_name', 'evento')
    WHEN 'ranking_update' THEN COALESCE(_name,'Atleta') || ' atualizou seu ranking'
    WHEN 'payment_completed' THEN COALESCE(_name,'Atleta') || ' completou um pagamento'
    ELSE COALESCE(_name,'Atleta') || ' tem novidades'
  END;
$$;

-- =========================================
-- Insert helper used by triggers
-- =========================================
CREATE OR REPLACE FUNCTION public._social_insert_event(
  _profile_id uuid, _tenant_id uuid, _arena_id uuid,
  _event_type text, _entity_type text, _entity_id uuid,
  _payload jsonb, _visibility text DEFAULT 'public'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _profile_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.social_events (profile_id, tenant_id, arena_id, event_type, entity_type, entity_id, payload, visibility)
  VALUES (_profile_id, _tenant_id, _arena_id, _event_type, _entity_type, _entity_id, COALESCE(_payload,'{}'::jsonb), _visibility)
  ON CONFLICT DO NOTHING;
END $$;

-- =========================================
-- Trigger: athlete_activities -> social_events
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_social_from_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    WHEN 'class.attended' THEN 'class_attendance'
    ELSE NULL
  END;
  IF v_event IS NULL THEN RETURN NEW; END IF;

  v_identity := public.social_identity_for_user(NEW.athlete_id);
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF NEW.reference_type = 'tournament' AND NEW.reference_id IS NOT NULL THEN
    SELECT name INTO v_t_name FROM public.tournaments WHERE id = NEW.reference_id;
    IF v_t_name IS NOT NULL THEN v_payload := v_payload || jsonb_build_object('tournament_name', v_t_name); END IF;
  END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NEW.arena_id, v_event,
    NEW.reference_type, NEW.reference_id, v_payload, 'public'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_social_from_activity ON public.athlete_activities;
CREATE TRIGGER trg_social_from_activity AFTER INSERT ON public.athlete_activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_activity();

-- =========================================
-- Trigger: bookings -> social_events
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_social_from_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_identity uuid;
  v_profile uuid;
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
  SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NEW.arena_id, 'booking',
    'booking', NEW.id,
    jsonb_build_object('booking_date', NEW.booking_date, 'start_time', NEW.start_time),
    'public'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_social_from_booking_ins ON public.bookings;
CREATE TRIGGER trg_social_from_booking_ins AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_booking();
DROP TRIGGER IF EXISTS trg_social_from_booking_upd ON public.bookings;
CREATE TRIGGER trg_social_from_booking_upd AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_booking();

-- =========================================
-- Trigger: financial_transactions -> social_events (private)
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_social_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_identity uuid;
  v_profile uuid;
  v_user uuid;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') THEN RETURN NEW; END IF;

  -- best-effort: try to resolve a user via source
  IF NEW.source_type = 'enrollment' THEN
    SELECT COALESCE(user_id, payer_id) INTO v_user FROM public.enrollments WHERE id = NEW.source_id;
  ELSIF NEW.source_type = 'booking' THEN
    SELECT user_id INTO v_user FROM public.bookings WHERE id = NEW.source_id;
  END IF;

  IF v_user IS NOT NULL THEN
    v_identity := public.social_identity_for_user(v_user);
    IF v_identity IS NULL THEN RETURN NEW; END IF;
    SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
    IF v_profile IS NULL THEN RETURN NEW; END IF;

    PERFORM public._social_insert_event(
      v_profile, NEW.tenant_id, NEW.arena_id, 'payment_completed',
      NEW.source_type, NEW.source_id,
      jsonb_build_object('source_type', NEW.source_type),
      'private'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_social_from_payment ON public.financial_transactions;
CREATE TRIGGER trg_social_from_payment AFTER INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_payment();

-- =========================================
-- Trigger: tournaments -> social_events
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_social_from_tournament()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_identity uuid;
  v_profile uuid;
BEGIN
  IF NEW.is_public IS NOT TRUE OR NEW.organizer_id IS NULL THEN RETURN NEW; END IF;
  v_identity := public.social_identity_for_user(NEW.organizer_id);
  IF v_identity IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_profile FROM public.social_profiles WHERE identity_id = v_identity;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  PERFORM public._social_insert_event(
    v_profile, NEW.tenant_id, NEW.arena_id, 'tournament_created',
    'tournament', NEW.id,
    jsonb_build_object('tournament_name', NEW.name, 'city', NEW.city, 'state', NEW.state),
    'public'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_social_from_tournament ON public.tournaments;
CREATE TRIGGER trg_social_from_tournament AFTER INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_from_tournament();

-- =========================================
-- updated_at triggers
-- =========================================
DROP TRIGGER IF EXISTS trg_social_identities_updated ON public.social_identities;
CREATE TRIGGER trg_social_identities_updated BEFORE UPDATE ON public.social_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_social_profiles_updated ON public.social_profiles;
CREATE TRIGGER trg_social_profiles_updated BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- User-facing RPCs
-- =========================================
CREATE OR REPLACE FUNCTION public.social_profile_set_visibility(_visibility text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _visibility NOT IN ('public','private') THEN RAISE EXCEPTION 'invalid visibility'; END IF;
  UPDATE public.social_profiles sp
     SET visibility = _visibility, updated_at = now()
   FROM public.social_identities si
   WHERE sp.identity_id = si.id AND si.user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.social_event_hide(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.social_events se
     SET visibility = 'private'
   FROM public.social_profiles sp
   JOIN public.social_identities si ON si.id = sp.identity_id
   WHERE se.id = _event_id AND se.profile_id = sp.id AND si.user_id = auth.uid();
END $$;

-- =========================================
-- Public views
-- =========================================
DROP VIEW IF EXISTS public.social_profiles_public CASCADE;
CREATE VIEW public.social_profiles_public WITH (security_invoker=on) AS
SELECT sp.id, sp.username, sp.display_name, sp.avatar_url, sp.bio,
       sp.level, sp.main_sport, sp.city, sp.state, sp.created_at
FROM public.social_profiles sp
WHERE sp.visibility = 'public';

GRANT SELECT ON public.social_profiles_public TO anon, authenticated;

DROP VIEW IF EXISTS public.social_feed_public_v2 CASCADE;
CREATE VIEW public.social_feed_public_v2 WITH (security_invoker=on) AS
SELECT
  e.id              AS event_id,
  e.event_type,
  e.created_at      AS occurred_at,
  e.tenant_id, e.arena_id,
  sp.id             AS profile_id,
  sp.username, sp.display_name, sp.avatar_url,
  a.name            AS arena_name,
  t.name            AS tenant_name,
  public.social_event_description(e.event_type, e.payload, sp.display_name, a.name) AS description,
  e.payload
FROM public.social_events e
JOIN public.social_profiles sp ON sp.id = e.profile_id AND sp.visibility = 'public'
LEFT JOIN public.arenas a ON a.id = e.arena_id
LEFT JOIN public.tenants t ON t.id = e.tenant_id
WHERE e.visibility = 'public';

GRANT SELECT ON public.social_feed_public_v2 TO anon, authenticated;

-- =========================================
-- Backfill
-- =========================================
DO $$
DECLARE r record;
BEGIN
  -- 1) identidades para todos profiles com whatsapp
  FOR r IN SELECT user_id, full_name, whatsapp, avatar_url FROM public.profiles WHERE whatsapp IS NOT NULL AND length(whatsapp) >= 8 LOOP
    PERFORM public.social_identity_upsert(r.whatsapp, r.full_name, 'signup', NULL, NULL, r.user_id, NULL, r.avatar_url);
  END LOOP;

  -- 2) identidades para wa_identities verificadas sem profile vinculado
  FOR r IN SELECT id, wa_phone, user_id FROM public.wa_identities WHERE verified_at IS NOT NULL LOOP
    PERFORM public.social_identity_upsert(r.wa_phone, NULL, 'whatsapp', NULL, NULL, r.user_id, r.id, NULL);
  END LOOP;

  -- 3) projetar histórico de athlete_activities (apenas tipos relevantes)
  INSERT INTO public.social_events (profile_id, tenant_id, arena_id, event_type, entity_type, entity_id, payload, visibility, created_at)
  SELECT sp.id, aa.tenant_id, aa.arena_id,
         CASE aa.activity_type
           WHEN 'tournament.enrolled' THEN 'tournament_join'
           WHEN 'tournament.checked_in' THEN 'checkin'
           WHEN 'tournament.match_won' THEN 'match_win'
           WHEN 'tournament.match_lost' THEN 'match_loss'
           WHEN 'class.attended' THEN 'class_attendance'
         END,
         aa.reference_type, aa.reference_id, COALESCE(aa.metadata, '{}'::jsonb), 'public', aa.created_at
    FROM public.athlete_activities aa
    JOIN public.social_identities si ON si.user_id = aa.athlete_id
    JOIN public.social_profiles sp ON sp.identity_id = si.id
   WHERE aa.activity_type IN ('tournament.enrolled','tournament.checked_in','tournament.match_won','tournament.match_lost','class.attended')
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
