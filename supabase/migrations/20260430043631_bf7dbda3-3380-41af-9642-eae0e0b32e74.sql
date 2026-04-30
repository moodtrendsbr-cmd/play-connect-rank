
-- Add metadata + last_seen to identity tables
ALTER TABLE public.social_identities ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.wa_identities ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.arenas ADD COLUMN IF NOT EXISTS checkin_enabled boolean NOT NULL DEFAULT true;

-- arena_checkins: frictionless arena entries (separate from class-only arena_attendance)
CREATE TABLE IF NOT EXISTS public.arena_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  tenant_id uuid,
  social_identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE CASCADE,
  user_id uuid,
  phone_e164 text,
  display_name text,
  sport text,
  court_id uuid,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  qr_token uuid,
  source text NOT NULL DEFAULT 'qr',
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_arena_checkins_arena_day ON public.arena_checkins(arena_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arena_checkins_identity ON public.arena_checkins(social_identity_id);
CREATE INDEX IF NOT EXISTS idx_arena_checkins_booking ON public.arena_checkins(booking_id) WHERE booking_id IS NOT NULL;

ALTER TABLE public.arena_checkins ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_checkins;

-- Owner / admin / arena_staff can read; tenant can read across own arenas
CREATE POLICY "arena_checkins_arena_owner_read"
  ON public.arena_checkins FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_checkins.arena_id AND a.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.arena_staff s WHERE s.arena_id = arena_checkins.arena_id AND s.user_id = auth.uid() AND s.is_active = true)
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_checkins.arena_id AND a.tenant_id IS NOT NULL AND a.tenant_id = auth.uid())
  );

CREATE POLICY "arena_checkins_arena_owner_insert"
  ON public.arena_checkins FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_checkins.arena_id AND a.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- booking_checkin_links
CREATE TABLE IF NOT EXISTS public.booking_checkin_links (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  shortcode text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_checkin_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_checkin_links_owner_read"
  ON public.booking_checkin_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.arenas a ON a.id = b.arena_id
      WHERE b.id = booking_checkin_links.booking_id
        AND (a.owner_user_id = auth.uid() OR b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- helper: short code generator
CREATE OR REPLACE FUNCTION public.gen_shortcode(_len int DEFAULT 8)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
BEGIN
  FOR i IN 1.._len LOOP
    out := out || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.booking_checkin_link_get_or_create(_booking_id uuid)
RETURNS public.booking_checkin_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec public.booking_checkin_links;
  b_date date;
  code text;
  tries int := 0;
BEGIN
  SELECT * INTO rec FROM public.booking_checkin_links WHERE booking_id = _booking_id;
  IF FOUND THEN RETURN rec; END IF;
  SELECT booking_date INTO b_date FROM public.bookings WHERE id = _booking_id;
  IF b_date IS NULL THEN RAISE EXCEPTION 'booking_not_found'; END IF;
  LOOP
    code := public.gen_shortcode(8);
    BEGIN
      INSERT INTO public.booking_checkin_links(booking_id, shortcode, expires_at)
      VALUES (_booking_id, code, (b_date + interval '2 days')::timestamptz)
      RETURNING * INTO rec;
      RETURN rec;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.booking_checkin_resolve(_shortcode text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'booking_id', b.id,
    'arena_id', a.id,
    'arena_name', a.name,
    'arena_slug', a.slug,
    'arena_logo', a.logo_url,
    'modalities', a.modalities,
    'court_id', b.court_id,
    'booking_date', b.booking_date,
    'start_time', b.start_time,
    'end_time', b.end_time,
    'expires_at', l.expires_at,
    'checkin_enabled', a.checkin_enabled
  ) INTO result
  FROM public.booking_checkin_links l
  JOIN public.bookings b ON b.id = l.booking_id
  JOIN public.arenas a ON a.id = b.arena_id
  WHERE l.shortcode = upper(_shortcode)
    AND l.expires_at > now();
  IF result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  END IF;
  RETURN jsonb_build_object('success', true, 'data', result);
END $$;

-- arena_checkin_complete: upsert identity + create checkin + social_event + crm metadata
CREATE OR REPLACE FUNCTION public.arena_checkin_complete(
  _arena_id uuid,
  _phone text,
  _name text,
  _sport text,
  _court_id uuid DEFAULT NULL,
  _booking_id uuid DEFAULT NULL,
  _qr_token uuid DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _source text DEFAULT 'qr',
  _visibility text DEFAULT 'arena'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_arena public.arenas;
  v_identity_id uuid;
  v_existing public.social_identities;
  v_checkin_id uuid;
  v_phone text;
  v_visit_count int;
BEGIN
  SELECT * INTO v_arena FROM public.arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'arena_not_found'); END IF;
  IF NOT v_arena.checkin_enabled THEN RETURN jsonb_build_object('success', false, 'error', 'checkin_disabled'); END IF;

  v_phone := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF length(v_phone) < 8 AND _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  -- find identity by phone
  SELECT * INTO v_existing FROM public.social_identities WHERE phone_e164 = v_phone LIMIT 1;
  IF FOUND THEN
    v_identity_id := v_existing.id;
    v_visit_count := coalesce((v_existing.metadata->>'visit_count')::int, 0) + 1;
    UPDATE public.social_identities SET
      display_name = coalesce(nullif(_name,''), display_name),
      first_arena_id = coalesce(first_arena_id, _arena_id),
      first_tenant_id = coalesce(first_tenant_id, v_arena.tenant_id),
      user_id = coalesce(user_id, _user_id),
      metadata = metadata
        || jsonb_build_object('visit_count', v_visit_count)
        || jsonb_build_object('last_sport', _sport)
        || jsonb_build_object('last_arena_id', _arena_id::text)
        || jsonb_build_object('last_seen_at', now()),
      updated_at = now()
    WHERE id = v_identity_id;
  ELSE
    INSERT INTO public.social_identities(phone_e164, display_name, source, first_arena_id, first_tenant_id, user_id, metadata)
    VALUES (
      v_phone, nullif(_name,''), _source, _arena_id, v_arena.tenant_id, _user_id,
      jsonb_build_object('visit_count', 1, 'last_sport', _sport, 'last_arena_id', _arena_id::text, 'last_seen_at', now())
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- insert checkin
  INSERT INTO public.arena_checkins(
    arena_id, tenant_id, social_identity_id, user_id, phone_e164, display_name,
    sport, court_id, booking_id, qr_token, source
  ) VALUES (
    _arena_id, v_arena.tenant_id, v_identity_id, _user_id, v_phone, _name,
    _sport, _court_id, _booking_id, _qr_token, _source
  ) RETURNING id INTO v_checkin_id;

  -- social event (feed)
  INSERT INTO public.social_events(tenant_id, arena_id, profile_id, event_type, entity_type, entity_id, payload, visibility)
  VALUES (
    v_arena.tenant_id, _arena_id, _user_id, 'checkin', 'arena_checkin', v_checkin_id,
    jsonb_build_object(
      'name', coalesce(nullif(_name,''), v_existing.display_name, 'Visitante'),
      'arena_name', v_arena.name,
      'sport', _sport
    ),
    coalesce(_visibility, 'arena')
  );

  -- update wa_identities.last_seen_at if exists
  UPDATE public.wa_identities SET last_seen_at = now() WHERE wa_phone = v_phone;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'identity_id', v_identity_id,
    'arena_name', v_arena.name
  );
END $$;
