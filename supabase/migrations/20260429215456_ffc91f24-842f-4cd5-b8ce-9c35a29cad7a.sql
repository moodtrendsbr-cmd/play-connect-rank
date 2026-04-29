-- Phase G — Autonomous Growth Engine (corrigido: owner_user_id)

CREATE OR REPLACE FUNCTION public.autonomy_action_risk(_action_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _action_type
    WHEN 'create_followup'              THEN 'low'
    WHEN 'create_reminder'              THEN 'low'
    WHEN 'schedule_operational_review'  THEN 'low'
    WHEN 'open_communication_thread'    THEN 'low'
    WHEN 'create_occurrence'            THEN 'medium'
    WHEN 'flag_enrollment_attention'    THEN 'medium'
    WHEN 'recovery_campaign_draft'      THEN 'medium'
    WHEN 'propose_manual_charge'        THEN 'medium'
    WHEN 'propose_promotion'            THEN 'high'
    WHEN 'send_proactive_message'       THEN 'low'
    WHEN 'recommend_product'            THEN 'low'
    WHEN 'reactivation_message'         THEN 'low'
    WHEN 'fill_idle_slots'              THEN 'medium'
    WHEN 'upsell_plan'                  THEN 'medium'
    WHEN 'tournament_boost'             THEN 'high'
    WHEN 'create_campaign'              THEN 'high'
    ELSE 'critical'
  END
$$;

CREATE TABLE IF NOT EXISTS public.growth_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('global','tenant','arena','company','campaign')),
  scope_id uuid,
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  budget_brl numeric(12,2) NOT NULL DEFAULT 0,
  spent_brl numeric(12,2) NOT NULL DEFAULT 0,
  boost_count_limit int,
  boost_count_used int NOT NULL DEFAULT 0,
  period_started_at timestamptz NOT NULL DEFAULT date_trunc('day', now()),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_budgets_scope_period_uniq
  ON public.growth_budgets (scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period)
  WHERE active = true;
CREATE INDEX IF NOT EXISTS growth_budgets_scope_idx
  ON public.growth_budgets (scope_type, scope_id) WHERE active = true;

ALTER TABLE public.growth_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "growth_budgets admin all" ON public.growth_budgets;
CREATE POLICY "growth_budgets admin all" ON public.growth_budgets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "growth_budgets tenant_admin" ON public.growth_budgets;
CREATE POLICY "growth_budgets tenant_admin" ON public.growth_budgets FOR ALL TO authenticated
  USING (
    scope_type IN ('tenant','arena','company') AND scope_id IS NOT NULL AND (
      (scope_type='tenant' AND public.is_tenant_admin(auth.uid(), scope_id))
      OR (scope_type='arena' AND EXISTS (SELECT 1 FROM public.arenas a WHERE a.id=scope_id AND public.is_tenant_admin(auth.uid(), a.tenant_id)))
      OR (scope_type='company' AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id=scope_id AND c.tenant_id IS NOT NULL AND public.is_tenant_admin(auth.uid(), c.tenant_id)))
    )
  )
  WITH CHECK (
    scope_type IN ('tenant','arena','company') AND scope_id IS NOT NULL AND (
      (scope_type='tenant' AND public.is_tenant_admin(auth.uid(), scope_id))
      OR (scope_type='arena' AND EXISTS (SELECT 1 FROM public.arenas a WHERE a.id=scope_id AND public.is_tenant_admin(auth.uid(), a.tenant_id)))
      OR (scope_type='company' AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id=scope_id AND c.tenant_id IS NOT NULL AND public.is_tenant_admin(auth.uid(), c.tenant_id)))
    )
  );

DROP POLICY IF EXISTS "growth_budgets arena_owner" ON public.growth_budgets;
CREATE POLICY "growth_budgets arena_owner" ON public.growth_budgets FOR ALL TO authenticated
  USING (scope_type='arena' AND scope_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.arenas a WHERE a.id=scope_id AND a.owner_user_id=auth.uid()))
  WITH CHECK (scope_type='arena' AND scope_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.arenas a WHERE a.id=scope_id AND a.owner_user_id=auth.uid()));

DROP POLICY IF EXISTS "growth_budgets company_owner" ON public.growth_budgets;
CREATE POLICY "growth_budgets company_owner" ON public.growth_budgets FOR ALL TO authenticated
  USING (scope_type='company' AND scope_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id=scope_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (scope_type='company' AND scope_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id=scope_id AND c.owner_user_id=auth.uid()));

DROP TRIGGER IF EXISTS trg_growth_budgets_updated_at ON public.growth_budgets;
CREATE TRIGGER trg_growth_budgets_updated_at BEFORE UPDATE ON public.growth_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.growth_check_budget(_scope_type text, _scope_id uuid, _amount_brl numeric DEFAULT 0)
RETURNS TABLE(allowed boolean, reason text, remaining_brl numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant_id uuid; v_b record;
BEGIN
  IF _scope_type='arena' AND _scope_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.arenas WHERE id=_scope_id;
  ELSIF _scope_type='company' AND _scope_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.companies WHERE id=_scope_id;
  ELSIF _scope_type='tenant' THEN v_tenant_id := _scope_id;
  END IF;

  IF _scope_type IN ('arena','company','campaign') AND _scope_id IS NOT NULL THEN
    SELECT * INTO v_b FROM public.growth_budgets
      WHERE scope_type=_scope_type AND scope_id=_scope_id AND active=true
      ORDER BY period_started_at DESC LIMIT 1;
    IF v_b.id IS NOT NULL THEN
      IF v_b.boost_count_limit IS NOT NULL AND v_b.boost_count_used >= v_b.boost_count_limit THEN
        RETURN QUERY SELECT false, 'budget_count_exhausted_'||_scope_type, 0::numeric; RETURN;
      END IF;
      IF (v_b.spent_brl + _amount_brl) > v_b.budget_brl THEN
        RETURN QUERY SELECT false, 'budget_exceeded_'||_scope_type, GREATEST(v_b.budget_brl - v_b.spent_brl, 0); RETURN;
      END IF;
    END IF;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    SELECT * INTO v_b FROM public.growth_budgets WHERE scope_type='tenant' AND scope_id=v_tenant_id AND active=true ORDER BY period_started_at DESC LIMIT 1;
    IF v_b.id IS NOT NULL AND (v_b.spent_brl + _amount_brl) > v_b.budget_brl THEN
      RETURN QUERY SELECT false, 'budget_exceeded_tenant', GREATEST(v_b.budget_brl - v_b.spent_brl, 0); RETURN;
    END IF;
  END IF;

  SELECT * INTO v_b FROM public.growth_budgets WHERE scope_type='global' AND active=true ORDER BY period_started_at DESC LIMIT 1;
  IF v_b.id IS NOT NULL AND (v_b.spent_brl + _amount_brl) > v_b.budget_brl THEN
    RETURN QUERY SELECT false, 'budget_exceeded_global', GREATEST(v_b.budget_brl - v_b.spent_brl, 0); RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, NULL::numeric;
END $$;

REVOKE ALL ON FUNCTION public.growth_check_budget(text,uuid,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.growth_check_budget(text,uuid,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.growth_record_spend(_scope_type text, _scope_id uuid, _amount_brl numeric, _is_boost boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.growth_budgets
     SET spent_brl = spent_brl + COALESCE(_amount_brl,0),
         boost_count_used = boost_count_used + CASE WHEN _is_boost THEN 1 ELSE 0 END,
         updated_at = now()
   WHERE scope_type=_scope_type
     AND (scope_id=_scope_id OR (_scope_type='global' AND scope_id IS NULL))
     AND active=true;
END $$;

REVOKE ALL ON FUNCTION public.growth_record_spend(text,uuid,numeric,boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_record_spend(text,uuid,numeric,boolean) TO service_role;

-- Guardrail estendido com budget
CREATE OR REPLACE FUNCTION public.autonomy_check_guardrails(_tenant_id uuid, _arena_id uuid, _action_type text, _payload jsonb, _conditions jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_risk text := public.autonomy_action_risk(_action_type);
  v_count_action int; v_count_tenant int; v_last_exec timestamptz;
  v_max_amount numeric; v_amount numeric;
  v_hours jsonb; v_h_start int; v_h_end int;
  v_now_hour int := EXTRACT(HOUR FROM now())::int;
  v_blocklist text[] := ARRAY['refund','cancel_payment','change_split','delete_user','delete_arena','delete_tenant','suspend_user','automatic_charge','force_block'];
  v_growth_actions text[] := ARRAY['tournament_boost','create_campaign','fill_idle_slots','upsell_plan'];
  v_entity_id text; v_budget record; v_scope_type text; v_scope_id uuid;
BEGIN
  IF v_risk IN ('high','critical') THEN
    RETURN QUERY SELECT false, 'risk_too_high'::text; RETURN;
  END IF;
  IF _action_type = ANY(v_blocklist) THEN
    RETURN QUERY SELECT false, 'action_blocklisted'::text; RETURN;
  END IF;

  SELECT count(*) INTO v_count_action FROM public.orkym_action_proposals
   WHERE tenant_id=_tenant_id AND action_type=_action_type AND auto_executed=true AND executed_at > now() - interval '1 hour';
  IF v_count_action >= 10 THEN RETURN QUERY SELECT false, 'rate_limit_action_type'::text; RETURN; END IF;

  SELECT count(*) INTO v_count_tenant FROM public.orkym_action_proposals
   WHERE tenant_id=_tenant_id AND auto_executed=true AND executed_at > now() - interval '1 hour';
  IF v_count_tenant >= 30 THEN RETURN QUERY SELECT false, 'rate_limit_tenant'::text; RETURN; END IF;

  v_entity_id := _payload->>'related_entity_id';
  IF v_entity_id IS NOT NULL THEN
    BEGIN
      SELECT MAX(executed_at) INTO v_last_exec FROM public.orkym_action_proposals
       WHERE tenant_id=_tenant_id AND action_type=_action_type AND related_entity_id=v_entity_id::uuid AND auto_executed=true;
      IF v_last_exec IS NOT NULL AND v_last_exec > now() - interval '60 seconds' THEN
        RETURN QUERY SELECT false, 'cooldown_active'::text; RETURN;
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  v_max_amount := NULLIF(_conditions->>'max_amount','')::numeric;
  v_amount := NULLIF(_payload->>'amount','')::numeric;
  IF v_max_amount IS NOT NULL AND v_amount IS NOT NULL AND v_amount > v_max_amount THEN
    RETURN QUERY SELECT false, 'amount_exceeds_max'::text; RETURN;
  END IF;

  v_hours := _conditions->'allowed_hours';
  IF v_hours IS NOT NULL AND jsonb_typeof(v_hours)='array' AND jsonb_array_length(v_hours)=2 THEN
    v_h_start := (v_hours->>0)::int; v_h_end := (v_hours->>1)::int;
    IF v_now_hour < v_h_start OR v_now_hour >= v_h_end THEN
      RETURN QUERY SELECT false, 'outside_allowed_hours'::text; RETURN;
    END IF;
  END IF;

  IF _action_type = ANY(v_growth_actions) THEN
    IF _arena_id IS NOT NULL THEN v_scope_type:='arena'; v_scope_id:=_arena_id;
    ELSE v_scope_type:='tenant'; v_scope_id:=_tenant_id;
    END IF;
    SELECT * INTO v_budget FROM public.growth_check_budget(v_scope_type, v_scope_id, COALESCE(v_amount,0));
    IF NOT v_budget.allowed THEN
      RETURN QUERY SELECT false, COALESCE(v_budget.reason, 'budget_block'); RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- Allowlist estendida
CREATE OR REPLACE FUNCTION public.orkym_ingest_actions(_payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := (_payload->>'tenant_id')::uuid;
  v_arena  uuid := NULLIF(_payload->>'arena_id','')::uuid;
  v_req text := _payload->>'request_id';
  v_corr text := _payload->>'correlation_id';
  v_actions jsonb := COALESCE(_payload->'actions','[]'::jsonb);
  v_action jsonb; v_count int := 0; v_atype text; v_domain text;
  v_allowed text[] := ARRAY[
    'create_followup','create_reminder','create_occurrence',
    'propose_manual_charge','flag_enrollment_attention','propose_promotion',
    'schedule_operational_review','open_communication_thread','recovery_campaign_draft',
    'tournament_boost','send_proactive_message','create_campaign',
    'recommend_product','reactivation_message','fill_idle_slots','upsell_plan'
  ];
  v_blocked text[] := ARRAY['refund','cancel_payment','change_split','delete_user','delete_arena','delete_tenant','suspend_user','automatic_charge','force_block'];
  v_human jsonb; v_proposed jsonb; v_resolved record; v_guardrail record;
  v_final_mode text; v_final_source text; v_guardrail_block text;
  v_policy_id uuid; v_initial_status text; v_status text; v_proposal_id uuid;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_id_required'; END IF;
  FOR v_action IN SELECT * FROM jsonb_array_elements(v_actions) LOOP
    v_atype := v_action->>'action_type';
    v_domain := COALESCE(v_action->>'domain','arena_operations');
    IF v_atype IS NULL OR NOT (v_atype = ANY(v_allowed)) OR (v_atype = ANY(v_blocked)) THEN CONTINUE; END IF;
    v_proposed := COALESCE(v_action->'proposed_payload','{}'::jsonb);
    v_human := jsonb_build_object(
      'title', v_action->>'title','description', v_action->>'description',
      'related_entity_type', v_action->>'related_entity_type',
      'related_entity_id', v_action->>'related_entity_id',
      'priority', COALESCE(v_action->>'priority','medium'),
      'expected_impact_brl', v_action->>'expected_impact_brl',
      'confidence', v_action->>'confidence'
    );
    SELECT * INTO v_resolved FROM public.autonomy_resolve_policy(v_tenant, v_arena, v_domain, v_atype);
    v_final_mode := v_resolved.execution_mode;
    v_final_source := v_resolved.policy_source;
    v_policy_id := v_resolved.policy_id;
    v_guardrail_block := NULL;
    IF v_final_mode = 'auto' THEN
      SELECT * INTO v_guardrail FROM public.autonomy_check_guardrails(
        v_tenant, v_arena, v_atype, v_proposed,
        COALESCE((SELECT conditions FROM public.autonomy_policies WHERE id = v_policy_id), '{}'::jsonb)
      );
      IF NOT v_guardrail.allowed THEN
        v_final_mode := 'approve'; v_final_source := 'guardrail_block'; v_guardrail_block := v_guardrail.reason;
      END IF;
    END IF;
    IF v_final_mode='suggest' THEN v_status:='canceled'; v_initial_status:='suggest';
    ELSIF v_final_mode='auto' THEN v_status:='approved'; v_initial_status:='auto';
    ELSE v_status:='proposed'; v_initial_status:='approve'; END IF;
    INSERT INTO public.orkym_action_proposals (
      tenant_id, arena_id, domain, action_type, title, description,
      priority, status, related_entity_type, related_entity_id,
      proposed_payload, human_summary, source, orkym_request_id, correlation_id,
      execution_mode, policy_id, policy_source, initial_status, auto_executed
    ) VALUES (
      v_tenant, v_arena, v_domain, v_atype, v_action->>'title', v_action->>'description',
      COALESCE(v_action->>'priority','medium'), v_status,
      v_action->>'related_entity_type', NULLIF(v_action->>'related_entity_id','')::uuid,
      v_proposed, v_human, 'orkym', v_req, v_corr,
      v_final_mode, v_policy_id, v_final_source, v_initial_status, false
    ) ON CONFLICT (orkym_request_id, action_type, related_entity_id) DO NOTHING
    RETURNING id INTO v_proposal_id;
    IF v_proposal_id IS NOT NULL THEN
      v_count := v_count + 1;
      PERFORM public.autonomy_log_decision(v_proposal_id, v_tenant, v_arena, v_domain, v_atype,
        v_final_mode, v_policy_id, v_final_source, v_guardrail_block,
        jsonb_build_object('correlation_id', v_corr, 'request_id', v_req));
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

-- Detector de oportunidades
CREATE OR REPLACE FUNCTION public.growth_generate_opportunity_triggers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN
    SELECT t.id, t.tenant_id, t.title, t.max_participants AS slots, t.start_date,
           (SELECT count(*) FROM public.tournament_enrollments te WHERE te.tournament_id = t.id AND te.status IN ('paid','confirmed')) AS enrolled
      FROM public.tournaments t
     WHERE t.status IN ('published','active')
       AND t.start_date BETWEEN now() + interval '3 days' AND now() + interval '7 days'
       AND t.max_participants IS NOT NULL AND t.max_participants > 0
  LOOP
    IF r.enrolled::numeric / NULLIF(r.slots,0) < 0.30 THEN
      PERFORM public.orkym_trigger_enqueue(jsonb_build_object(
        'tenant_id', r.tenant_id, 'profile_type', 'organizer',
        'trigger_type', 'tournament_low_enrollment', 'priority', 'high',
        'entity_type', 'tournament', 'entity_id', r.id,
        'payload', jsonb_build_object('tournament_id', r.id, 'enrolled', r.enrolled, 'slots', r.slots, 'title', r.title),
        'dedup_key', 'growth:low_enroll:'||r.id::text||':'||to_char(now(),'YYYYMMDD')
      ));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT DISTINCT pe.user_id, pe.tenant_id FROM public.orkym_proactive_eligibility pe
     WHERE pe.opt_in = true
       AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.user_id = pe.user_id AND b.created_at > now() - interval '30 days')
       AND NOT EXISTS (SELECT 1 FROM public.tournament_enrollments te WHERE te.user_id = pe.user_id AND te.created_at > now() - interval '30 days')
       AND NOT EXISTS (SELECT 1 FROM public.orkym_triggers_queue q WHERE q.trigger_type='inactive_athlete' AND q.user_id = pe.user_id AND q.created_at > now() - interval '14 days')
     LIMIT 500
  LOOP
    PERFORM public.orkym_trigger_enqueue(jsonb_build_object(
      'tenant_id', r.tenant_id, 'user_id', r.user_id, 'profile_type', 'athlete',
      'trigger_type', 'inactive_athlete', 'priority', 'low',
      'entity_type', 'user', 'entity_id', r.user_id,
      'payload', jsonb_build_object('inactive_days', 30),
      'dedup_key', 'growth:inactive:'||r.user_id::text||':'||to_char(now(),'YYYYWW')
    ));
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.growth_generate_opportunity_triggers() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_generate_opportunity_triggers() TO service_role;

-- Trigger registra spend ao pagar boost
CREATE OR REPLACE FUNCTION public.trg_growth_record_boost_spend()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_camp record; v_scope_type text; v_scope_id uuid;
BEGIN
  IF NEW.status <> 'paid' OR NEW.source_type <> 'boost' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status = 'paid' THEN RETURN NEW; END IF;
  SELECT id, tenant_id, target_type, target_id, kind INTO v_camp FROM public.ad_campaigns WHERE id = NEW.source_id;
  IF v_camp.id IS NULL THEN RETURN NEW; END IF;
  IF v_camp.target_type='tournament' THEN
    SELECT (CASE WHEN t.arena_id IS NOT NULL THEN 'arena' ELSE 'tenant' END), COALESCE(t.arena_id, t.tenant_id)
      INTO v_scope_type, v_scope_id FROM public.tournaments t WHERE t.id = v_camp.target_id;
  ELSIF v_camp.target_type='company' THEN v_scope_type:='company'; v_scope_id:=v_camp.target_id;
  ELSIF v_camp.target_type='product' THEN
    SELECT 'company', p.company_id INTO v_scope_type, v_scope_id FROM public.products p WHERE p.id = v_camp.target_id;
  ELSE v_scope_type:='tenant'; v_scope_id:=v_camp.tenant_id; END IF;
  IF v_scope_id IS NOT NULL THEN
    PERFORM public.growth_record_spend(v_scope_type, v_scope_id, NEW.total_amount, true);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_growth_record_boost_spend ON public.financial_transactions;
CREATE TRIGGER trg_growth_record_boost_spend
  AFTER INSERT OR UPDATE OF status ON public.financial_transactions
  FOR EACH ROW WHEN (NEW.source_type='boost' AND NEW.status='paid')
  EXECUTE FUNCTION public.trg_growth_record_boost_spend();

-- Dashboard view
CREATE OR REPLACE VIEW public.v_growth_dashboard
WITH (security_invoker = true) AS
SELECT
  p.tenant_id, p.arena_id, p.action_type, p.execution_mode, p.policy_source,
  count(*) FILTER (WHERE p.created_at > now() - interval '30 days') AS total_30d,
  count(*) FILTER (WHERE p.execution_mode='suggest' AND p.created_at > now() - interval '30 days') AS suggested_30d,
  count(*) FILTER (WHERE p.execution_mode='approve' AND p.created_at > now() - interval '30 days') AS approve_30d,
  count(*) FILTER (WHERE p.auto_executed=true AND p.created_at > now() - interval '30 days') AS auto_30d,
  count(*) FILTER (WHERE p.policy_source IN ('guardrail_block','kill_switch','tier_no_auto','tier_domain_block','quota_auto','quota_suggestions') AND p.created_at > now() - interval '30 days') AS blocked_30d,
  COALESCE(SUM(ra.revenue_amount) FILTER (WHERE ra.created_at > now() - interval '30 days'), 0) AS revenue_30d
FROM public.orkym_action_proposals p
LEFT JOIN public.orkym_revenue_attribution ra
  ON ra.entity_type = p.related_entity_type AND ra.entity_id = p.related_entity_id
WHERE p.action_type IN ('tournament_boost','send_proactive_message','create_campaign',
                        'recommend_product','reactivation_message','fill_idle_slots','upsell_plan')
GROUP BY p.tenant_id, p.arena_id, p.action_type, p.execution_mode, p.policy_source;

GRANT SELECT ON public.v_growth_dashboard TO authenticated;