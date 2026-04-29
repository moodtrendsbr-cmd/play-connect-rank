
-- =========================================================
-- Phase 13 — Conversational Revenue Engine
-- =========================================================

-- 1) Attribution table
CREATE TABLE IF NOT EXISTS public.orkym_revenue_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid NULL,
  user_id uuid NULL,
  profile_type text NULL,
  trigger_id uuid NULL REFERENCES public.orkym_triggers_queue(id) ON DELETE SET NULL,
  command_id uuid NULL REFERENCES public.conversational_commands(id) ON DELETE SET NULL,
  message_id uuid NULL REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  session_id uuid NULL REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('booking','enrollment','marketplace_order','arena_billing_cycle','sponsorship')),
  entity_id uuid NOT NULL,
  financial_transaction_id uuid NULL REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  revenue_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  attribution_type text NOT NULL CHECK (attribution_type IN ('proactive','assisted','reactive')),
  attribution_confidence numeric(3,2) NOT NULL DEFAULT 0.50,
  conversion_window_seconds int NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orkym_rev_entity
  ON public.orkym_revenue_attribution (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_orkym_rev_tenant
  ON public.orkym_revenue_attribution (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orkym_rev_arena
  ON public.orkym_revenue_attribution (arena_id, created_at DESC) WHERE arena_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orkym_rev_trigger
  ON public.orkym_revenue_attribution (trigger_id) WHERE trigger_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orkym_rev_type
  ON public.orkym_revenue_attribution (attribution_type, created_at DESC);

ALTER TABLE public.orkym_revenue_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rev_attr scoped read" ON public.orkym_revenue_attribution;
CREATE POLICY "rev_attr scoped read"
  ON public.orkym_revenue_attribution FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND is_arena_owner(arena_id, auth.uid()))
  );

-- 2) Attribution resolver
CREATE OR REPLACE FUNCTION public.orkym_attribute_revenue(_source_type text, _source_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ftx record;
  v_entity_type text;
  v_entity_id uuid;
  v_user_id uuid;
  v_arena_id uuid;
  v_paid_at timestamptz;
  v_window_start timestamptz;
  v_trigger record;
  v_attribution_type text;
  v_confidence numeric(3,2);
  v_message_id uuid;
  v_command_id uuid;
  v_trigger_id uuid;
  v_session_id uuid;
  v_attr_id uuid;
BEGIN
  SELECT * INTO v_ftx FROM public.financial_transactions
   WHERE source_type = _source_type AND source_id = _source_id
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR v_ftx.status <> 'paid' THEN RETURN NULL; END IF;

  v_entity_type := CASE _source_type
    WHEN 'booking' THEN 'booking'
    WHEN 'enrollment' THEN 'enrollment'
    WHEN 'marketplace_order' THEN 'marketplace_order'
    WHEN 'arena_billing_cycle' THEN 'arena_billing_cycle'
    WHEN 'sponsorship' THEN 'sponsorship'
    ELSE NULL END;
  IF v_entity_type IS NULL THEN RETURN NULL; END IF;
  v_entity_id := v_ftx.source_id;
  v_paid_at := COALESCE(v_ftx.paid_at, v_ftx.updated_at, now());
  v_window_start := v_paid_at - interval '24 hours';
  v_arena_id := v_ftx.arena_id;

  IF v_entity_type = 'booking' THEN
    SELECT user_id, arena_id INTO v_user_id, v_arena_id FROM public.bookings WHERE id = v_entity_id;
  ELSIF v_entity_type = 'enrollment' THEN
    SELECT COALESCE(user_id, payer_id) INTO v_user_id FROM public.enrollments WHERE id = v_entity_id;
  ELSIF v_entity_type = 'marketplace_order' THEN
    SELECT buyer_user_id INTO v_user_id FROM public.marketplace_orders WHERE id = v_entity_id;
  END IF;

  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT q.id AS trigger_id, q.tenant_id, q.arena_id, q.profile_type
    INTO v_trigger
    FROM public.orkym_triggers_queue q
   WHERE q.user_id = v_user_id
     AND q.tenant_id = v_ftx.tenant_id
     AND q.status = 'processed'
     AND q.processed_at >= v_window_start
     AND q.processed_at <= v_paid_at
     AND EXISTS (
       SELECT 1 FROM public.orkym_trigger_feedback f
        WHERE f.trigger_id = q.id AND f.event = 'message_sent'
     )
   ORDER BY q.processed_at DESC
   LIMIT 1;

  IF FOUND THEN
    v_trigger_id := v_trigger.trigger_id;
    v_attribution_type := 'proactive';
    v_confidence := 1.00;

    SELECT wm.id, wm.command_id INTO v_message_id, v_command_id
      FROM public.whatsapp_messages wm
     WHERE wm.user_id = v_user_id
       AND wm.direction = 'outbound'
       AND wm.initiated_by = 'orkym'
       AND wm.created_at >= v_window_start
       AND wm.created_at <= v_paid_at
     ORDER BY wm.created_at DESC LIMIT 1;
  ELSE
    SELECT cs.id INTO v_session_id
      FROM public.conversation_sessions cs
     WHERE cs.user_id = v_user_id
       AND cs.tenant_id = v_ftx.tenant_id
       AND cs.last_message_at >= v_window_start
       AND cs.last_message_at <= v_paid_at
     ORDER BY cs.last_message_at DESC LIMIT 1;

    IF v_session_id IS NOT NULL THEN
      v_attribution_type := 'assisted';
      v_confidence := 0.75;

      SELECT cc.id INTO v_command_id
        FROM public.conversational_commands cc
       WHERE cc.user_id = v_user_id
         AND cc.created_at >= v_window_start
         AND cc.created_at <= v_paid_at
       ORDER BY cc.created_at DESC LIMIT 1;
    ELSE
      SELECT cc.id INTO v_command_id
        FROM public.conversational_commands cc
       WHERE cc.user_id = v_user_id
         AND cc.direction = 'inbound'
         AND cc.created_at >= v_window_start
         AND cc.created_at <= v_paid_at
       ORDER BY cc.created_at DESC LIMIT 1;

      IF v_command_id IS NOT NULL THEN
        v_attribution_type := 'reactive';
        v_confidence := 0.50;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.orkym_revenue_attribution (
    tenant_id, arena_id, user_id, profile_type,
    trigger_id, command_id, message_id, session_id,
    entity_type, entity_id, financial_transaction_id,
    revenue_amount, currency, attribution_type, attribution_confidence,
    conversion_window_seconds, metadata
  ) VALUES (
    v_ftx.tenant_id, v_arena_id, v_user_id,
    COALESCE(v_trigger.profile_type, 'athlete'),
    v_trigger_id, v_command_id, v_message_id, v_session_id,
    v_entity_type, v_entity_id, v_ftx.id,
    v_ftx.total_amount, COALESCE(v_ftx.currency,'BRL'),
    v_attribution_type, v_confidence,
    EXTRACT(EPOCH FROM (v_paid_at - v_window_start))::int,
    jsonb_build_object('source_type', _source_type, 'paid_at', v_paid_at)
  )
  ON CONFLICT (entity_type, entity_id) DO NOTHING
  RETURNING id INTO v_attr_id;

  IF v_attribution_type = 'proactive' AND v_trigger_id IS NOT NULL AND v_attr_id IS NOT NULL THEN
    INSERT INTO public.orkym_trigger_feedback (trigger_id, event, metadata)
    VALUES (v_trigger_id, 'converted',
            jsonb_build_object('amount', v_ftx.total_amount, 'currency', COALESCE(v_ftx.currency,'BRL'), 'attribution_id', v_attr_id));
  END IF;

  RETURN v_attr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.orkym_attribute_revenue(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orkym_attribute_revenue(text, uuid) TO service_role;

-- 3) Trigger
CREATE OR REPLACE FUNCTION public.tg_orkym_attribute_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.orkym_attribute_revenue(NEW.source_type, NEW.source_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attribute_revenue ON public.financial_transactions;
CREATE TRIGGER trg_attribute_revenue
AFTER INSERT OR UPDATE OF status ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_orkym_attribute_revenue();

-- 4) KPI helpers
CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_arena(_arena_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE arena_id = _arena_id AND status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND created_at BETWEEN _from AND _to), 0),
    'bookings_total', COALESCE((SELECT COUNT(*) FROM bookings WHERE arena_id = _arena_id AND created_at BETWEEN _from AND _to), 0),
    'bookings_via_wa', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND entity_type='booking' AND created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE arena_id = _arena_id AND direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_tenant(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE tenant_id = _tenant_id AND status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE tenant_id = _tenant_id AND direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE tenant_id = _tenant_id AND attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0),
    'arenas', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT a.id AS arena_id, a.name,
               COALESCE(SUM(r.revenue_amount), 0) AS revenue_orkym,
               COUNT(r.id) AS conversions
          FROM arenas a
          LEFT JOIN orkym_revenue_attribution r
            ON r.arena_id = a.id AND r.created_at BETWEEN _from AND _to
         WHERE a.tenant_id = _tenant_id
         GROUP BY a.id, a.name
         ORDER BY revenue_orkym DESC
         LIMIT 20
      ) t), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_company(_company_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH product_orders AS (
    SELECT mo.* FROM marketplace_orders mo
    JOIN products p ON p.id = mo.product_id
    WHERE p.company_id = _company_id
      AND mo.created_at BETWEEN _from AND _to
  )
  SELECT jsonb_build_object(
    'orders_total', (SELECT COUNT(*) FROM product_orders),
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM product_orders WHERE status='paid'), 0),
    'orders_via_wa', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution r
                                JOIN product_orders po ON po.id = r.entity_id
                                WHERE r.entity_type='marketplace_order'), 0),
    'revenue_orkym', COALESCE((SELECT SUM(r.revenue_amount) FROM orkym_revenue_attribution r
                                JOIN product_orders po ON po.id = r.entity_id
                                WHERE r.entity_type='marketplace_order'), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_admin(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.orkym_message_performance(_scope_type text, _scope_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  trigger_type text,
  sent bigint,
  delivered bigint,
  responded bigint,
  converted bigint,
  revenue numeric,
  conversion_rate numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH triggers AS (
    SELECT q.id, q.trigger_type, q.tenant_id, q.arena_id
      FROM orkym_triggers_queue q
     WHERE q.created_at BETWEEN _from AND _to
       AND (
         (_scope_type = 'tenant' AND q.tenant_id = _scope_id)
         OR (_scope_type = 'arena' AND q.arena_id = _scope_id)
         OR (_scope_type = 'admin')
       )
  ),
  agg AS (
    SELECT t.trigger_type,
           COUNT(*) FILTER (WHERE f.event='message_sent') AS sent,
           COUNT(*) FILTER (WHERE f.event='delivered') AS delivered,
           COUNT(*) FILTER (WHERE f.event='responded') AS responded,
           COUNT(*) FILTER (WHERE f.event='converted') AS converted
      FROM triggers t
      LEFT JOIN orkym_trigger_feedback f ON f.trigger_id = t.id
     GROUP BY t.trigger_type
  ),
  rev AS (
    SELECT q.trigger_type, COALESCE(SUM(r.revenue_amount),0) AS revenue
      FROM triggers q
      LEFT JOIN orkym_revenue_attribution r ON r.trigger_id = q.id
     GROUP BY q.trigger_type
  )
  SELECT a.trigger_type, a.sent, a.delivered, a.responded, a.converted,
         COALESCE(rev.revenue, 0) AS revenue,
         CASE WHEN a.sent > 0 THEN ROUND((a.converted::numeric / a.sent::numeric), 4) ELSE 0 END AS conversion_rate
    FROM agg a LEFT JOIN rev ON rev.trigger_type = a.trigger_type
   ORDER BY a.sent DESC;
$$;

-- 5) Optimization signals
CREATE OR REPLACE FUNCTION public.orkym_generate_optimization_triggers()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_count int := 0;
  v_dedup text;
  v_week text;
BEGIN
  v_week := to_char(date_trunc('week', now()), 'IYYY-IW');

  FOR rec IN
    WITH stats AS (
      SELECT q.tenant_id, q.trigger_type,
             COUNT(*) FILTER (WHERE f.event='message_sent') AS sent,
             COUNT(*) FILTER (WHERE f.event='converted') AS converted
        FROM orkym_triggers_queue q
        LEFT JOIN orkym_trigger_feedback f ON f.trigger_id = q.id
       WHERE q.created_at >= now() - interval '14 days'
       GROUP BY q.tenant_id, q.trigger_type
    )
    SELECT * FROM stats
     WHERE sent >= 30
       AND (converted::numeric / NULLIF(sent,0)::numeric) < 0.05
  LOOP
    v_dedup := 'opt|' || rec.tenant_id || '|' || rec.trigger_type || '|' || v_week;
    BEGIN
      PERFORM public.orkym_trigger_enqueue(
        rec.tenant_id, NULL, NULL, 'tenant',
        'low_message_performance',
        'trigger_type', NULL,
        jsonb_build_object('target_trigger_type', rec.trigger_type, 'sent', rec.sent, 'converted', rec.converted),
        'low', v_dedup, now()
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.orkym_generate_optimization_triggers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orkym_generate_optimization_triggers() TO service_role;

-- 6) ROI multiplier + adaptive eligibility
CREATE OR REPLACE FUNCTION public.orkym_roi_multiplier(_tenant_id uuid, _trigger_type text)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT COUNT(*) FILTER (WHERE f.event='message_sent') AS sent,
           COUNT(*) FILTER (WHERE f.event='converted') AS conv
      FROM orkym_triggers_queue q
      LEFT JOIN orkym_trigger_feedback f ON f.trigger_id = q.id
     WHERE q.tenant_id = _tenant_id
       AND q.trigger_type = _trigger_type
       AND q.created_at >= now() - interval '14 days'
  )
  SELECT CASE
    WHEN sent < 20 THEN 1.0
    WHEN (conv::numeric / NULLIF(sent,0)::numeric) >= 0.15 THEN 2.0
    WHEN (conv::numeric / NULLIF(sent,0)::numeric) < 0.03 THEN 0.5
    ELSE 1.0
  END FROM s;
$$;

CREATE OR REPLACE FUNCTION public.orkym_proactive_check_eligibility(
  _user_id uuid, _tenant_id uuid, _category text, _trigger_type text,
  _scope_type text DEFAULT 'user'::text, _scope_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  v_roi numeric := 1.0;
  v_eff_user_cap int;
BEGIN
  IF _user_id IS NOT NULL THEN
    SELECT opted_in, metadata INTO v_opt, v_meta
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

    IF _tenant_id IS NOT NULL AND _trigger_type IS NOT NULL THEN
      v_roi := COALESCE(public.orkym_roi_multiplier(_tenant_id, _trigger_type), 1.0);
    END IF;
    v_eff_user_cap := GREATEST(1, FLOOR(v_user_cap * GREATEST(0.5, LEAST(2.0, v_roi)))::int);

    SELECT COUNT(*) INTO v_user_count
      FROM public.whatsapp_messages
     WHERE user_id = _user_id
       AND direction = 'outbound'
       AND initiated_by = 'orkym'
       AND created_at >= now() - interval '24 hours';

    IF v_user_count >= v_eff_user_cap THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'user_cap', 'cap', v_eff_user_cap, 'roi_multiplier', v_roi);
    END IF;
  END IF;

  IF _tenant_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_tenant_count
      FROM public.whatsapp_messages
     WHERE tenant_id = _tenant_id
       AND direction = 'outbound'
       AND initiated_by = 'orkym'
       AND created_at >= now() - interval '24 hours';
    IF v_tenant_count >= v_tenant_cap THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'tenant_cap');
    END IF;
  END IF;

  v_cooldown := CASE _trigger_type
    WHEN 'subscription_overdue' THEN interval '4 hours'
    WHEN 'idle_slot' THEN interval '72 hours'
    WHEN 'low_enrollment' THEN interval '48 hours'
    ELSE interval '24 hours'
  END;

  SELECT last_sent_at INTO v_last
    FROM public.orkym_proactive_cooldowns
   WHERE scope_type = v_scope_type AND scope_id = v_scope_id AND trigger_type = _trigger_type;

  IF v_last IS NOT NULL AND v_last + v_cooldown > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'cooldown');
  END IF;

  RETURN jsonb_build_object('eligible', true, 'roi_multiplier', v_roi);
END;
$$;

REVOKE ALL ON FUNCTION public.orkym_proactive_check_eligibility(uuid, uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orkym_proactive_check_eligibility(uuid, uuid, text, text, text, uuid) TO service_role;

-- 7) Backfill last 30d
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT source_type, source_id FROM public.financial_transactions
     WHERE status='paid' AND COALESCE(paid_at, created_at) >= now() - interval '30 days'
  LOOP
    BEGIN
      PERFORM public.orkym_attribute_revenue(r.source_type, r.source_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
