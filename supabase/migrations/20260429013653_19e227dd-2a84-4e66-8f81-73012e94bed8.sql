
-- ============================================================
-- Phase 12.8 — Memory + Personalization Layer
-- ============================================================

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.conversational_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid NULL,
  user_id uuid NULL,
  profile_type text NOT NULL CHECK (profile_type IN ('athlete','arena','organizer','company','tenant')),
  entity_type text NOT NULL CHECK (entity_type IN ('user','arena','organizer','company','tenant')),
  entity_id uuid NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN ('preference','pattern','history','behavior','insight')),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL,
  sample_size int NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversational_memory_unique_key UNIQUE (entity_type, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_cmem_tenant_profile ON public.conversational_memory (tenant_id, profile_type);
CREATE INDEX IF NOT EXISTS idx_cmem_entity ON public.conversational_memory (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cmem_arena_key ON public.conversational_memory (arena_id, key) WHERE arena_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cmem_expires ON public.conversational_memory (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cmem_user ON public.conversational_memory (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.conversational_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  memory_id uuid NULL REFERENCES public.conversational_memory(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','expired','used','decayed')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cmem_evt_tenant ON public.conversational_memory_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmem_evt_memory ON public.conversational_memory_events (memory_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_cmem_updated_at ON public.conversational_memory;
CREATE TRIGGER trg_cmem_updated_at
  BEFORE UPDATE ON public.conversational_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. RLS
ALTER TABLE public.conversational_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversational_memory_events ENABLE ROW LEVEL SECURITY;

-- conversational_memory SELECT
DROP POLICY IF EXISTS cmem_select ON public.conversational_memory;
CREATE POLICY cmem_select ON public.conversational_memory
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_tenant_admin(tenant_id, auth.uid())
    OR (entity_type = 'user' AND entity_id = auth.uid())
    OR (entity_type = 'arena' AND public.is_arena_owner(entity_id, auth.uid()))
    OR (entity_type = 'company' AND public.is_company_owner(entity_id, auth.uid()))
    OR (entity_type = 'organizer' AND entity_id = auth.uid())
    OR (entity_type = 'tenant' AND public.is_tenant_admin(entity_id, auth.uid()))
  );

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER functions can write.

-- conversational_memory_events SELECT
DROP POLICY IF EXISTS cmem_evt_select ON public.conversational_memory_events;
CREATE POLICY cmem_evt_select ON public.conversational_memory_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_tenant_admin(tenant_id, auth.uid())
  );

-- 3. memory_upsert
CREATE OR REPLACE FUNCTION public.memory_upsert(
  _entity_type text,
  _entity_id uuid,
  _tenant uuid,
  _arena uuid,
  _user uuid,
  _profile_type text,
  _memory_type text,
  _key text,
  _value jsonb,
  _confidence numeric DEFAULT NULL,
  _source text DEFAULT 'manual',
  _sample_size int DEFAULT 1,
  _ttl_days int DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing record;
  v_new_sample int;
  v_new_conf numeric;
  v_event text;
  v_expires timestamptz;
BEGIN
  IF _tenant IS NULL OR _entity_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_expires := CASE WHEN _ttl_days IS NOT NULL
                    THEN now() + make_interval(days => _ttl_days)
                    ELSE NULL END;

  SELECT * INTO v_existing
    FROM public.conversational_memory
   WHERE entity_type = _entity_type AND entity_id = _entity_id AND key = _key
   LIMIT 1;

  IF v_existing.id IS NULL THEN
    v_new_sample := GREATEST(1, _sample_size);
    v_new_conf := COALESCE(_confidence, LEAST(0.99, 0.30 + ln(v_new_sample + 1) * 0.15));
    INSERT INTO public.conversational_memory (
      tenant_id, arena_id, user_id, profile_type, entity_type, entity_id,
      memory_type, key, value, confidence, source, sample_size,
      last_seen_at, expires_at
    ) VALUES (
      _tenant, _arena, _user, _profile_type, _entity_type, _entity_id,
      _memory_type, _key, COALESCE(_value, '{}'::jsonb), v_new_conf, _source, v_new_sample,
      now(), v_expires
    ) RETURNING id INTO v_id;
    v_event := 'created';
  ELSE
    v_new_sample := v_existing.sample_size + GREATEST(0, _sample_size);
    v_new_conf := COALESCE(_confidence, LEAST(0.99, 0.30 + ln(v_new_sample + 1) * 0.15));
    UPDATE public.conversational_memory
       SET value = COALESCE(_value, value),
           confidence = v_new_conf,
           sample_size = v_new_sample,
           source = COALESCE(_source, source),
           memory_type = COALESCE(_memory_type, memory_type),
           tenant_id = COALESCE(_tenant, tenant_id),
           arena_id = COALESCE(_arena, arena_id),
           user_id = COALESCE(_user, user_id),
           profile_type = COALESCE(_profile_type, profile_type),
           last_seen_at = now(),
           expires_at = COALESCE(v_expires, expires_at),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING id INTO v_id;
    v_event := 'updated';
  END IF;

  INSERT INTO public.conversational_memory_events (tenant_id, memory_id, event_type, context)
  VALUES (_tenant, v_id, v_event, jsonb_build_object('source', _source, 'key', _key));

  RETURN v_id;
END $$;

-- 4. Athlete extractor
CREATE OR REPLACE FUNCTION public.memory_extract_athlete(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_tenant uuid;
  r record;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  -- preferred sport (from enrollments → tournaments.modality, last 180d)
  FOR r IN
    SELECT t.modality AS sport, count(*) AS c, e.tenant_id
      FROM public.enrollments e
      JOIN public.tournaments t ON t.id = e.tournament_id
     WHERE COALESCE(e.user_id, e.payer_id) = _user_id
       AND e.created_at >= now() - interval '180 days'
       AND t.modality IS NOT NULL
     GROUP BY t.modality, e.tenant_id
     HAVING count(*) >= 2
     ORDER BY c DESC
     LIMIT 1
  LOOP
    v_tenant := r.tenant_id;
    PERFORM public.memory_upsert(
      'user', _user_id, v_tenant, NULL, _user_id, 'athlete',
      'preference', 'preferred_sport',
      jsonb_build_object('value', r.sport, 'count', r.c),
      NULL, 'enrollments', r.c::int, NULL
    );
    v_count := v_count + 1;
  END LOOP;

  -- preferred time window (from bookings.start_time, last 180d)
  FOR r IN
    SELECT
      CASE
        WHEN substring(b.start_time from 1 for 2)::int < 12 THEN 'morning'
        WHEN substring(b.start_time from 1 for 2)::int < 18 THEN 'afternoon'
        ELSE 'night'
      END AS window,
      count(*) AS c,
      b.tenant_id
    FROM public.bookings b
    WHERE b.user_id = _user_id
      AND b.created_at >= now() - interval '180 days'
      AND b.start_time IS NOT NULL
      AND b.start_time ~ '^[0-9]{2}'
    GROUP BY 1, b.tenant_id
    HAVING count(*) >= 2
    ORDER BY c DESC
    LIMIT 1
  LOOP
    PERFORM public.memory_upsert(
      'user', _user_id, r.tenant_id, NULL, _user_id, 'athlete',
      'preference', 'preferred_time_window',
      jsonb_build_object('value', r.window, 'count', r.c),
      NULL, 'bookings', r.c::int, NULL
    );
    v_count := v_count + 1;
  END LOOP;

  -- preferred arena
  FOR r IN
    SELECT b.arena_id, count(*) AS c, b.tenant_id
      FROM public.bookings b
     WHERE b.user_id = _user_id
       AND b.created_at >= now() - interval '180 days'
     GROUP BY b.arena_id, b.tenant_id
     ORDER BY c DESC
     LIMIT 1
  LOOP
    PERFORM public.memory_upsert(
      'user', _user_id, r.tenant_id, r.arena_id, _user_id, 'athlete',
      'preference', 'preferred_arena',
      jsonb_build_object('arena_id', r.arena_id, 'count', r.c),
      NULL, 'bookings', r.c::int, NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

-- 5. Arena extractor
CREATE OR REPLACE FUNCTION public.memory_extract_arena(_arena_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_tenant uuid;
  v_payload jsonb;
  r record;
BEGIN
  IF _arena_id IS NULL THEN RETURN 0; END IF;
  SELECT tenant_id INTO v_tenant FROM public.arenas WHERE id = _arena_id;
  IF v_tenant IS NULL THEN RETURN 0; END IF;

  -- recurring students (top 10 by attendance, last 90d)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('student_id', s.student_id, 'count', s.c) ORDER BY s.c DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT a.student_id, count(*)::int AS c
        FROM public.arena_attendance a
       WHERE a.arena_id = _arena_id
         AND a.checked_in_at >= now() - interval '90 days'
         AND a.status = 'present'
       GROUP BY a.student_id
       ORDER BY c DESC
       LIMIT 10
    ) s;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'arena', _arena_id, v_tenant, _arena_id, NULL, 'arena',
      'pattern', 'recurring_students',
      jsonb_build_object('top', v_payload), NULL, 'attendance',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  -- chronic overdue students (>= 2 overdue cycles)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('subscription_id', x.subscription_id, 'overdue_count', x.c) ORDER BY x.c DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT bc.subscription_id, count(*)::int AS c
        FROM public.arena_billing_cycles bc
       WHERE bc.arena_id = _arena_id AND bc.status = 'overdue'
       GROUP BY bc.subscription_id
       HAVING count(*) >= 2
       ORDER BY c DESC
       LIMIT 20
    ) x;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'arena', _arena_id, v_tenant, _arena_id, NULL, 'arena',
      'pattern', 'chronic_overdue_subscriptions',
      jsonb_build_object('top', v_payload), NULL, 'billing',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  -- top instructor (by classes scheduled last 90d)
  FOR r IN
    SELECT c.instructor_id, count(*)::int AS cnt
      FROM public.arena_classes c
     WHERE c.arena_id = _arena_id
       AND c.start_at >= now() - interval '90 days'
       AND c.instructor_id IS NOT NULL
     GROUP BY c.instructor_id
     ORDER BY cnt DESC
     LIMIT 1
  LOOP
    PERFORM public.memory_upsert(
      'arena', _arena_id, v_tenant, _arena_id, NULL, 'arena',
      'insight', 'top_instructor',
      jsonb_build_object('instructor_id', r.instructor_id, 'classes', r.cnt),
      NULL, 'classes', r.cnt, NULL
    );
    v_count := v_count + 1;
  END LOOP;

  -- low occupancy classes (< 30% in last 90d)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'class_id', x.class_id, 'title', x.title,
    'capacity', x.capacity, 'enrolled', x.enrolled
  )), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT c.id AS class_id, c.title, c.capacity,
             (SELECT count(*) FROM public.arena_class_enrollments e
                WHERE e.class_id = c.id AND e.status = 'active')::int AS enrolled
        FROM public.arena_classes c
       WHERE c.arena_id = _arena_id
         AND c.status = 'active'
         AND c.start_at >= now() - interval '90 days'
    ) x
   WHERE x.capacity > 0 AND x.enrolled::numeric / x.capacity::numeric < 0.30
   LIMIT 15;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'arena', _arena_id, v_tenant, _arena_id, NULL, 'arena',
      'insight', 'low_occupancy_classes',
      jsonb_build_object('classes', v_payload), NULL, 'classes',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END $$;

-- 6. Organizer extractor
CREATE OR REPLACE FUNCTION public.memory_extract_organizer(_organizer_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_tenant uuid;
  v_payload jsonb;
  r record;
BEGIN
  IF _organizer_user_id IS NULL THEN RETURN 0; END IF;
  SELECT tenant_id INTO v_tenant FROM public.tournaments
   WHERE organizer_id = _organizer_user_id ORDER BY created_at DESC LIMIT 1;
  IF v_tenant IS NULL THEN RETURN 0; END IF;

  -- frequent categories
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', x.cat, 'count', x.c) ORDER BY x.c DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT t.category::text AS cat, count(*)::int AS c
        FROM public.tournaments t
       WHERE t.organizer_id = _organizer_user_id
         AND t.created_at >= now() - interval '365 days'
       GROUP BY t.category
       ORDER BY c DESC
       LIMIT 5
    ) x;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'organizer', _organizer_user_id, v_tenant, NULL, _organizer_user_id, 'organizer',
      'pattern', 'frequent_categories',
      jsonb_build_object('top', v_payload), NULL, 'tournaments',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  -- frequent modality
  FOR r IN
    SELECT t.modality, count(*)::int AS c
      FROM public.tournaments t
     WHERE t.organizer_id = _organizer_user_id
       AND t.created_at >= now() - interval '365 days'
       AND t.modality IS NOT NULL
     GROUP BY t.modality
     ORDER BY c DESC
     LIMIT 1
  LOOP
    PERFORM public.memory_upsert(
      'organizer', _organizer_user_id, v_tenant, NULL, _organizer_user_id, 'organizer',
      'preference', 'frequent_tournament_modality',
      jsonb_build_object('value', r.modality, 'count', r.c),
      NULL, 'tournaments', r.c, NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

-- 7. Company extractor
CREATE OR REPLACE FUNCTION public.memory_extract_company(_company_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_tenant uuid;
  v_payload jsonb;
BEGIN
  IF _company_id IS NULL THEN RETURN 0; END IF;
  SELECT tenant_id INTO v_tenant FROM public.companies WHERE id = _company_id;
  IF v_tenant IS NULL THEN RETURN 0; END IF;

  -- top products by units sold (last 180d, status paid/delivered)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', x.product_id, 'name', x.name, 'units', x.units
  ) ORDER BY x.units DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT p.id AS product_id, p.name, sum(o.quantity)::int AS units
        FROM public.marketplace_orders o
        JOIN public.products p ON p.id = o.product_id
       WHERE p.company_id = _company_id
         AND o.created_at >= now() - interval '180 days'
         AND o.status IN ('paid','delivered','shipped','completed')
       GROUP BY p.id, p.name
       ORDER BY units DESC
       LIMIT 5
    ) x;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'company', _company_id, v_tenant, NULL, NULL, 'company',
      'insight', 'top_products',
      jsonb_build_object('top', v_payload), NULL, 'orders',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END $$;

-- 8. Tenant extractor
CREATE OR REPLACE FUNCTION public.memory_extract_tenant(_tenant_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_payload jsonb;
BEGIN
  IF _tenant_id IS NULL THEN RETURN 0; END IF;

  -- top arenas in tenant by booking count last 90d
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'arena_id', x.arena_id, 'bookings', x.c
  ) ORDER BY x.c DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT b.arena_id, count(*)::int AS c
        FROM public.bookings b
       WHERE b.tenant_id = _tenant_id
         AND b.created_at >= now() - interval '90 days'
       GROUP BY b.arena_id
       ORDER BY c DESC
       LIMIT 5
    ) x;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'tenant', _tenant_id, _tenant_id, NULL, NULL, 'tenant',
      'insight', 'top_arenas',
      jsonb_build_object('top', v_payload), NULL, 'bookings',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  -- recurring operational issues (last 30d)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_type', x.event_type, 'count', x.c
  ) ORDER BY x.c DESC), '[]'::jsonb)
    INTO v_payload
    FROM (
      SELECT e.event_type, count(*)::int AS c
        FROM public.arena_operational_events e
       WHERE e.tenant_id = _tenant_id
         AND e.created_at >= now() - interval '30 days'
         AND e.event_type LIKE '%alert%'
       GROUP BY e.event_type
       ORDER BY c DESC
       LIMIT 5
    ) x;
  IF jsonb_array_length(v_payload) > 0 THEN
    PERFORM public.memory_upsert(
      'tenant', _tenant_id, _tenant_id, NULL, NULL, 'tenant',
      'pattern', 'recurring_issues',
      jsonb_build_object('top', v_payload), NULL, 'events',
      jsonb_array_length(v_payload), NULL
    );
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END $$;

-- 9. Orchestrator
CREATE OR REPLACE FUNCTION public.memory_extract_all(_batch_size int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athletes int := 0; v_arenas int := 0; v_organizers int := 0;
  v_companies int := 0; v_tenants int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT u.id AS user_id
      FROM auth.users u
      JOIN public.bookings b ON b.user_id = u.id
     WHERE b.created_at >= now() - interval '60 days'
     LIMIT _batch_size
  LOOP
    PERFORM public.memory_extract_athlete(r.user_id);
    v_athletes := v_athletes + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM public.arenas LIMIT _batch_size
  LOOP
    PERFORM public.memory_extract_arena(r.id);
    v_arenas := v_arenas + 1;
  END LOOP;

  FOR r IN
    SELECT DISTINCT organizer_id AS uid FROM public.tournaments
     WHERE created_at >= now() - interval '365 days'
     LIMIT _batch_size
  LOOP
    PERFORM public.memory_extract_organizer(r.uid);
    v_organizers := v_organizers + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM public.companies LIMIT _batch_size
  LOOP
    PERFORM public.memory_extract_company(r.id);
    v_companies := v_companies + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM public.tenants LIMIT _batch_size
  LOOP
    PERFORM public.memory_extract_tenant(r.id);
    v_tenants := v_tenants + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'athletes', v_athletes, 'arenas', v_arenas,
    'organizers', v_organizers, 'companies', v_companies,
    'tenants', v_tenants, 'completed_at', now()
  );
END $$;

-- 10. Decay
CREATE OR REPLACE FUNCTION public.memory_apply_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decayed int := 0;
  v_expired int := 0;
BEGIN
  -- Decay confidence by 0.05 if not seen for 60d (not yet expired)
  WITH upd AS (
    UPDATE public.conversational_memory
       SET confidence = GREATEST(0.05, confidence - 0.05),
           updated_at = now()
     WHERE last_seen_at < now() - interval '60 days'
       AND (expires_at IS NULL OR expires_at > now())
       AND confidence > 0.05
    RETURNING id, tenant_id
  )
  SELECT count(*) INTO v_decayed FROM upd;

  -- Expire memories untouched for 180d
  WITH exp AS (
    UPDATE public.conversational_memory
       SET expires_at = now(),
           updated_at = now()
     WHERE last_seen_at < now() - interval '180 days'
       AND (expires_at IS NULL OR expires_at > now())
    RETURNING id, tenant_id
  )
  INSERT INTO public.conversational_memory_events (tenant_id, memory_id, event_type, context)
  SELECT tenant_id, id, 'expired', '{}'::jsonb FROM exp;
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  RETURN jsonb_build_object('decayed', v_decayed, 'expired', v_expired, 'completed_at', now());
END $$;

-- 11. Triggers (incremental memory)
CREATE OR REPLACE FUNCTION public.trg_memory_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window text;
  v_hour int;
BEGIN
  IF NEW.user_id IS NULL OR NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('confirmed','paid','completed') THEN RETURN NEW; END IF;
  IF NEW.start_time IS NULL OR NEW.start_time !~ '^[0-9]{2}' THEN RETURN NEW; END IF;

  v_hour := substring(NEW.start_time from 1 for 2)::int;
  v_window := CASE WHEN v_hour < 12 THEN 'morning'
                   WHEN v_hour < 18 THEN 'afternoon'
                   ELSE 'night' END;

  PERFORM public.memory_upsert(
    'user', NEW.user_id, NEW.tenant_id, NEW.arena_id, NEW.user_id, 'athlete',
    'preference', 'preferred_time_window',
    jsonb_build_object('value', v_window),
    NULL, 'bookings', 1, NULL
  );
  PERFORM public.memory_upsert(
    'user', NEW.user_id, NEW.tenant_id, NEW.arena_id, NEW.user_id, 'athlete',
    'preference', 'preferred_arena',
    jsonb_build_object('arena_id', NEW.arena_id),
    NULL, 'bookings', 1, NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_memory_booking ON public.bookings;
CREATE TRIGGER trg_memory_booking
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_memory_from_booking();

CREATE OR REPLACE FUNCTION public.trg_memory_from_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_modality text;
  v_tenant uuid;
BEGIN
  v_user := COALESCE(NEW.user_id, NEW.payer_id);
  IF v_user IS NULL THEN RETURN NEW; END IF;
  SELECT t.modality, t.tenant_id INTO v_modality, v_tenant
    FROM public.tournaments t WHERE t.id = NEW.tournament_id LIMIT 1;
  IF v_modality IS NULL OR v_tenant IS NULL THEN RETURN NEW; END IF;

  PERFORM public.memory_upsert(
    'user', v_user, v_tenant, NULL, v_user, 'athlete',
    'preference', 'preferred_sport',
    jsonb_build_object('value', v_modality),
    NULL, 'enrollments', 1, NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_memory_enrollment ON public.enrollments;
CREATE TRIGGER trg_memory_enrollment
  AFTER INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_memory_from_enrollment();

CREATE OR REPLACE FUNCTION public.trg_memory_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_tenant uuid;
  v_name text;
BEGIN
  IF NEW.status NOT IN ('paid','delivered','shipped','completed') THEN RETURN NEW; END IF;
  SELECT p.company_id, p.tenant_id, p.name INTO v_company, v_tenant, v_name
    FROM public.products p WHERE p.id = NEW.product_id LIMIT 1;
  IF v_company IS NULL OR v_tenant IS NULL THEN RETURN NEW; END IF;

  PERFORM public.memory_upsert(
    'company', v_company, v_tenant, NULL, NULL, 'company',
    'insight', 'top_products',
    jsonb_build_object('last_product_id', NEW.product_id, 'last_product_name', v_name),
    NULL, 'orders', NEW.quantity, NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_memory_order ON public.marketplace_orders;
CREATE TRIGGER trg_memory_order
  AFTER INSERT OR UPDATE OF status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_memory_from_order();
