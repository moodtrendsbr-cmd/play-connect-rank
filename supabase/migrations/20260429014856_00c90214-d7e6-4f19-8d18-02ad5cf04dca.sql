
-- =========================================================
-- Phase 12.9 — Proactive ORKYM Operations
-- =========================================================

-- 1) Triggers queue
CREATE TABLE IF NOT EXISTS public.orkym_triggers_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid NULL,
  user_id uuid NULL,
  profile_type text NOT NULL CHECK (profile_type IN ('athlete','arena','organizer','company','tenant')),
  trigger_type text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','processed','skipped','failed')),
  dedup_key text NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz NULL,
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_orkym_tq_pick
  ON public.orkym_triggers_queue (status, priority, scheduled_for)
  WHERE status IN ('pending','claimed');

CREATE INDEX IF NOT EXISTS idx_orkym_tq_tenant
  ON public.orkym_triggers_queue (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orkym_tq_user
  ON public.orkym_triggers_queue (user_id, trigger_type, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orkym_tq_dedup
  ON public.orkym_triggers_queue (dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('pending','claimed','processed');

ALTER TABLE public.orkym_triggers_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tq scoped read"
  ON public.orkym_triggers_queue FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND is_arena_owner(arena_id, auth.uid()))
  );

-- 2) Trigger feedback
CREATE TABLE IF NOT EXISTS public.orkym_trigger_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid NOT NULL REFERENCES public.orkym_triggers_queue(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('message_sent','delivered','read','responded','ignored','converted')),
  correlation_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orkym_tf_trigger ON public.orkym_trigger_feedback (trigger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orkym_tf_event ON public.orkym_trigger_feedback (event, created_at DESC);

ALTER TABLE public.orkym_trigger_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tf scoped read"
  ON public.orkym_trigger_feedback FOR SELECT
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orkym_triggers_queue q
      WHERE q.id = orkym_trigger_feedback.trigger_id
        AND (
          (q.tenant_id IS NOT NULL AND is_tenant_admin(q.tenant_id, auth.uid()))
          OR (q.arena_id IS NOT NULL AND is_arena_owner(q.arena_id, auth.uid()))
        )
    )
  );

-- 3) Cooldowns
CREATE TABLE IF NOT EXISTS public.orkym_proactive_cooldowns (
  scope_type text NOT NULL CHECK (scope_type IN ('user','arena','tenant','organizer','company')),
  scope_id uuid NOT NULL,
  trigger_type text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  count_24h int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_type, scope_id, trigger_type)
);

ALTER TABLE public.orkym_proactive_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cooldowns admin read"
  ON public.orkym_proactive_cooldowns FOR SELECT
  USING (is_admin(auth.uid()));

-- =========================================================
-- 4) RPCs
-- =========================================================

CREATE OR REPLACE FUNCTION public.orkym_trigger_default_cooldown(_trigger_type text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _trigger_type
    WHEN 'subscription_due'        THEN interval '24 hours'
    WHEN 'subscription_overdue'    THEN interval '4 hours'
    WHEN 'attendance_drop'         THEN interval '48 hours'
    WHEN 'idle_slot'               THEN interval '72 hours'
    WHEN 'low_enrollment'          THEN interval '48 hours'
    WHEN 'top_product'             THEN interval '72 hours'
    WHEN 'low_campaign_performance' THEN interval '48 hours'
    WHEN 'revenue_drop'            THEN interval '24 hours'
    WHEN 'relevant_tournament'     THEN interval '72 hours'
    WHEN 'favorite_slot_available' THEN interval '24 hours'
    ELSE interval '24 hours'
  END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_trigger_enqueue(
  p_tenant_id uuid,
  p_arena_id uuid,
  p_user_id uuid,
  p_profile_type text,
  p_trigger_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
  p_priority text,
  p_dedup_key text,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.orkym_triggers_queue (
    tenant_id, arena_id, user_id, profile_type, trigger_type,
    entity_type, entity_id, payload, priority, dedup_key, scheduled_for
  ) VALUES (
    p_tenant_id, p_arena_id, p_user_id, p_profile_type, p_trigger_type,
    p_entity_type, p_entity_id, COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 'medium'),
    p_dedup_key, COALESCE(p_scheduled_for, now())
  )
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL AND status IN ('pending','claimed','processed')
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_trigger_claim_batch(_limit int DEFAULT 100)
RETURNS SETOF public.orkym_triggers_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.orkym_triggers_queue
    WHERE status = 'pending'
      AND scheduled_for <= now()
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      scheduled_for
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.orkym_triggers_queue q
     SET status = 'claimed',
         claimed_at = now(),
         attempts = q.attempts + 1
    FROM picked
   WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_trigger_complete(
  _id uuid,
  _status text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('processed','skipped','failed','pending') THEN
    RAISE EXCEPTION 'invalid_status: %', _status;
  END IF;
  UPDATE public.orkym_triggers_queue
     SET status = _status,
         processed_at = CASE WHEN _status IN ('processed','skipped','failed') THEN now() ELSE processed_at END,
         last_error = _error
   WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_proactive_check_eligibility(
  _user_id uuid,
  _tenant_id uuid,
  _category text,
  _trigger_type text,
  _scope_type text DEFAULT 'user',
  _scope_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt boolean := false;
  v_user_count int := 0;
  v_tenant_count int := 0;
  v_last timestamptz;
  v_cooldown interval;
  v_user_cap int := 3;
  v_tenant_cap int := 200;
  v_meta jsonb;
  v_scope_type text := COALESCE(_scope_type, 'user');
  v_scope_id uuid := COALESCE(_scope_id, _user_id);
BEGIN
  -- opt-in check (only enforced when there is a user; tenant-scope triggers without user skip this)
  IF _user_id IS NOT NULL THEN
    SELECT opted_in, metadata
      INTO v_opt, v_meta
      FROM public.orkym_proactive_eligibility
     WHERE user_id = _user_id
       AND (tenant_id = _tenant_id OR (tenant_id IS NULL AND _tenant_id IS NULL))
       AND category = _category
       AND channel = 'whatsapp'
     LIMIT 1;

    IF NOT COALESCE(v_opt, false) THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'opt_out');
    END IF;

    IF v_meta ? 'daily_cap' THEN
      v_user_cap := COALESCE((v_meta->>'daily_cap')::int, v_user_cap);
    END IF;

    SELECT COUNT(*)
      INTO v_user_count
      FROM public.whatsapp_messages
     WHERE user_id = _user_id
       AND direction = 'outbound'
       AND initiated_by = 'orkym'
       AND created_at >= now() - interval '24 hours';

    IF v_user_count >= v_user_cap THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'user_daily_cap');
    END IF;
  END IF;

  -- tenant cap
  IF _tenant_id IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_tenant_count
      FROM public.whatsapp_messages
     WHERE tenant_id = _tenant_id
       AND direction = 'outbound'
       AND initiated_by = 'orkym'
       AND created_at >= now() - interval '24 hours';
    IF v_tenant_count >= v_tenant_cap THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'tenant_daily_cap');
    END IF;
  END IF;

  -- cooldown
  v_cooldown := public.orkym_trigger_default_cooldown(_trigger_type);

  SELECT last_sent_at INTO v_last
    FROM public.orkym_proactive_cooldowns
   WHERE scope_type = v_scope_type
     AND scope_id = v_scope_id
     AND trigger_type = _trigger_type;

  IF v_last IS NOT NULL AND v_last + v_cooldown > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'cooldown', 'next_eligible_at', v_last + v_cooldown);
  END IF;

  RETURN jsonb_build_object('eligible', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.orkym_proactive_record_send(
  _scope_type text,
  _scope_id uuid,
  _trigger_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.orkym_proactive_cooldowns (scope_type, scope_id, trigger_type, last_sent_at, count_24h, updated_at)
  VALUES (_scope_type, _scope_id, _trigger_type, now(), 1, now())
  ON CONFLICT (scope_type, scope_id, trigger_type)
  DO UPDATE SET
    last_sent_at = now(),
    count_24h = CASE
      WHEN public.orkym_proactive_cooldowns.last_sent_at >= now() - interval '24 hours'
        THEN public.orkym_proactive_cooldowns.count_24h + 1
      ELSE 1
    END,
    updated_at = now();
END;
$$;

-- =========================================================
-- 5) Periodic generator (called by cron)
-- =========================================================
CREATE OR REPLACE FUNCTION public.orkym_generate_periodic_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low_enroll int := 0;
  v_subs int := 0;
BEGIN
  -- Subscriptions due in next 5 days (in case the AFTER trigger missed historical rows)
  WITH due AS (
    SELECT s.id, s.tenant_id, s.arena_id, s.student_id, s.next_due_at, s.status
      FROM public.arena_student_subscriptions s
     WHERE s.status = 'active'
       AND s.next_due_at IS NOT NULL
       AND s.next_due_at <= now() + interval '5 days'
       AND s.next_due_at >= now() - interval '7 days'
  ), ins AS (
    SELECT public.orkym_trigger_enqueue(
      d.tenant_id, d.arena_id, NULL, 'arena',
      CASE WHEN d.next_due_at < now() THEN 'subscription_overdue' ELSE 'subscription_due' END,
      'subscription', d.id,
      jsonb_build_object('next_due_at', d.next_due_at, 'student_id', d.student_id),
      CASE WHEN d.next_due_at < now() THEN 'high' ELSE 'medium' END,
      'subscription_due|' || d.id::text || '|' || to_char(d.next_due_at, 'YYYYMMDD'),
      now()
    ) AS new_id
    FROM due d
  )
  SELECT COUNT(*) INTO v_subs FROM ins WHERE new_id IS NOT NULL;

  -- Low enrollment within 7 days
  WITH low AS (
    SELECT t.id AS tournament_id, t.organizer_id, t.tenant_id, t.start_date,
           COUNT(e.id) AS cnt,
           COALESCE(t.max_participants, 0) AS cap
      FROM public.tournaments t
      LEFT JOIN public.enrollments e ON e.tournament_id = t.id AND e.status IN ('paid','confirmed','approved')
     WHERE t.start_date IS NOT NULL
       AND t.start_date <= (now() + interval '7 days')
       AND t.start_date > now()
     GROUP BY t.id, t.organizer_id, t.tenant_id, t.start_date, t.max_participants
    HAVING COALESCE(t.max_participants, 0) > 0
       AND COUNT(e.id)::numeric / COALESCE(t.max_participants, 1) < 0.30
  ), ins2 AS (
    SELECT public.orkym_trigger_enqueue(
      l.tenant_id, NULL, l.organizer_id, 'organizer',
      'low_enrollment',
      'tournament', l.tournament_id,
      jsonb_build_object('current', l.cnt, 'capacity', l.cap, 'start_date', l.start_date),
      'high',
      'low_enrollment|' || l.tournament_id::text || '|' || to_char(l.start_date, 'YYYYMMDD'),
      now()
    ) AS new_id
    FROM low l
  )
  SELECT COUNT(*) INTO v_low_enroll FROM ins2 WHERE new_id IS NOT NULL;

  RETURN jsonb_build_object('subscriptions', v_subs, 'low_enrollment', v_low_enroll);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- =========================================================
-- 6) Table triggers (deterministic enqueue)
-- =========================================================

-- 6a) arena_student_subscriptions
CREATE OR REPLACE FUNCTION public.trg_proactive_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active'
     AND NEW.next_due_at IS NOT NULL
     AND NEW.next_due_at <= now() + interval '5 days' THEN
    PERFORM public.orkym_trigger_enqueue(
      NEW.tenant_id, NEW.arena_id, NULL, 'arena',
      CASE WHEN NEW.next_due_at < now() THEN 'subscription_overdue' ELSE 'subscription_due' END,
      'subscription', NEW.id,
      jsonb_build_object('next_due_at', NEW.next_due_at, 'student_id', NEW.student_id),
      CASE WHEN NEW.next_due_at < now() THEN 'high' ELSE 'medium' END,
      'subscription_due|' || NEW.id::text || '|' || to_char(NEW.next_due_at, 'YYYYMMDD'),
      now()
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proactive_subscription_aiu ON public.arena_student_subscriptions;
CREATE TRIGGER proactive_subscription_aiu
  AFTER INSERT OR UPDATE OF status, next_due_at ON public.arena_student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_proactive_subscription();

-- 6b) arena_attendance — drop pattern
CREATE OR REPLACE FUNCTION public.trg_proactive_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_absent int;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_absent
    FROM public.arena_attendance
   WHERE student_id = NEW.student_id
     AND status = 'absent'
     AND created_at >= now() - interval '28 days';

  IF v_absent >= 3 THEN
    PERFORM public.orkym_trigger_enqueue(
      NEW.tenant_id, NEW.arena_id, NULL, 'arena',
      'attendance_drop',
      'student', NEW.student_id,
      jsonb_build_object('absences_28d', v_absent),
      'medium',
      'attendance_drop|' || NEW.student_id::text || '|' || to_char(date_trunc('week', now()), 'IYYYIW'),
      now()
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proactive_attendance_ai ON public.arena_attendance;
CREATE TRIGGER proactive_attendance_ai
  AFTER INSERT ON public.arena_attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_proactive_attendance();

-- 6c) marketplace_orders — top product
CREATE OR REPLACE FUNCTION public.trg_proactive_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  -- Only enqueue with a tenant; company-scoped trigger handled via tenant + payload company hint.
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.orkym_trigger_enqueue(
    NEW.tenant_id, NULL, NEW.buyer_user_id, 'company',
    'top_product',
    'order', NEW.id,
    jsonb_build_object('product_id', NEW.product_id, 'amount', NEW.total_amount),
    'low',
    'top_product|' || COALESCE(NEW.product_id::text, NEW.id::text) || '|' || to_char(date_trunc('day', now()), 'YYYYMMDD'),
    now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proactive_order_au ON public.marketplace_orders;
CREATE TRIGGER proactive_order_au
  AFTER INSERT OR UPDATE OF status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_proactive_order();

-- 6d) enrollments — fill rate handled in periodic generator (cross-row aggregate)
