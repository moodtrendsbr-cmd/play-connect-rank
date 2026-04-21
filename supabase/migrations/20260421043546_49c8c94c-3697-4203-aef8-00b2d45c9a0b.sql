-- ============================================================
-- FASE 9: AUTONOMY POLICIES
-- ============================================================

-- 1.1 autonomy_policies
CREATE TABLE public.autonomy_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_level text NOT NULL CHECK (scope_level IN ('global','tenant','arena')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE CASCADE,
  domain text,
  action_type text,
  execution_mode text NOT NULL DEFAULT 'approve' CHECK (execution_mode IN ('suggest','approve','auto')),
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  is_enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority int NOT NULL DEFAULT 100,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autonomy_policies_scope_check CHECK (
    (scope_level = 'global' AND tenant_id IS NULL AND arena_id IS NULL) OR
    (scope_level = 'tenant' AND tenant_id IS NOT NULL AND arena_id IS NULL) OR
    (scope_level = 'arena'  AND tenant_id IS NOT NULL AND arena_id IS NOT NULL)
  )
);

CREATE INDEX idx_autonomy_policies_lookup ON public.autonomy_policies(tenant_id, arena_id, domain, action_type) WHERE is_enabled;
CREATE INDEX idx_autonomy_policies_scope_priority ON public.autonomy_policies(scope_level, priority);

CREATE TRIGGER trg_autonomy_policies_updated_at
  BEFORE UPDATE ON public.autonomy_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.2 autonomy_kill_switches
CREATE TABLE public.autonomy_kill_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_level text NOT NULL CHECK (scope_level IN ('global','tenant','arena','domain','action_type')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE CASCADE,
  domain text,
  action_type text,
  is_active boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  activated_by uuid,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_by uuid,
  deactivated_at timestamptz
);

CREATE INDEX idx_autonomy_kill_switches_active ON public.autonomy_kill_switches(scope_level, tenant_id, arena_id, domain, action_type) WHERE is_active;

-- 1.3 autonomy_policy_logs
CREATE TABLE public.autonomy_policy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.orkym_action_proposals(id) ON DELETE SET NULL,
  tenant_id uuid,
  arena_id uuid,
  domain text,
  action_type text,
  resolved_mode text NOT NULL CHECK (resolved_mode IN ('suggest','approve','auto')),
  policy_id uuid REFERENCES public.autonomy_policies(id) ON DELETE SET NULL,
  policy_source text NOT NULL,
  guardrail_blocked text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_autonomy_policy_logs_tenant ON public.autonomy_policy_logs(tenant_id, created_at DESC);
CREATE INDEX idx_autonomy_policy_logs_mode ON public.autonomy_policy_logs(resolved_mode, created_at DESC);

-- 1.4 ALTER orkym_action_proposals
ALTER TABLE public.orkym_action_proposals
  ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'approve' CHECK (execution_mode IN ('suggest','approve','auto')),
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.autonomy_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_source text,
  ADD COLUMN IF NOT EXISTS auto_executed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_status text;

-- backfill legacy
UPDATE public.orkym_action_proposals
   SET execution_mode = COALESCE(execution_mode, 'approve'),
       policy_source = COALESCE(policy_source, 'legacy'),
       initial_status = COALESCE(initial_status, status)
 WHERE execution_mode IS NULL OR policy_source IS NULL OR initial_status IS NULL;

-- ============================================================
-- 1.5 RPCs
-- ============================================================

-- Risk classifier (hardcoded)
CREATE OR REPLACE FUNCTION public.autonomy_action_risk(_action_type text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
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
    ELSE 'critical'
  END
$$;

-- Resolver
CREATE OR REPLACE FUNCTION public.autonomy_resolve_policy(
  _tenant_id uuid,
  _arena_id uuid,
  _domain text,
  _action_type text
) RETURNS TABLE(execution_mode text, policy_id uuid, policy_source text, risk_level text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_policy record;
  v_risk text := public.autonomy_action_risk(_action_type);
BEGIN
  -- 1. Kill switch
  IF EXISTS (
    SELECT 1 FROM public.autonomy_kill_switches
     WHERE is_active = true
       AND (
         (scope_level = 'global') OR
         (scope_level = 'tenant'      AND tenant_id = _tenant_id) OR
         (scope_level = 'arena'       AND arena_id  = _arena_id) OR
         (scope_level = 'domain'      AND domain    = _domain
            AND (tenant_id IS NULL OR tenant_id = _tenant_id)) OR
         (scope_level = 'action_type' AND action_type = _action_type
            AND (tenant_id IS NULL OR tenant_id = _tenant_id))
       )
  ) THEN
    RETURN QUERY SELECT 'suggest'::text, NULL::uuid, 'kill_switch'::text, v_risk;
    RETURN;
  END IF;

  -- 2. arena + action_type
  IF _arena_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='arena' AND arena_id=_arena_id AND action_type=_action_type
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'arena_action'::text, v_risk;
      RETURN;
    END IF;

    -- 3. arena + domain
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='arena' AND arena_id=_arena_id
        AND domain=_domain AND action_type IS NULL
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'arena_domain'::text, v_risk;
      RETURN;
    END IF;
  END IF;

  -- 4. tenant + action_type
  IF _tenant_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id AND action_type=_action_type
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'tenant_action'::text, v_risk;
      RETURN;
    END IF;

    -- 5. tenant + domain
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id
        AND domain=_domain AND action_type IS NULL
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'tenant_domain'::text, v_risk;
      RETURN;
    END IF;

    -- 6. tenant catch-all
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id
        AND domain IS NULL AND action_type IS NULL
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'tenant_catchall'::text, v_risk;
      RETURN;
    END IF;
  END IF;

  -- 7. global + action_type
  SELECT * INTO v_policy FROM public.autonomy_policies
    WHERE is_enabled AND scope_level='global' AND action_type=_action_type
    ORDER BY priority ASC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'global_action'::text, v_risk;
    RETURN;
  END IF;

  -- 8. global + domain
  SELECT * INTO v_policy FROM public.autonomy_policies
    WHERE is_enabled AND scope_level='global' AND domain=_domain AND action_type IS NULL
    ORDER BY priority ASC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_policy.execution_mode, v_policy.id, 'global_domain'::text, v_risk;
    RETURN;
  END IF;

  -- 9/10. fallback seguro
  RETURN QUERY SELECT 'approve'::text, NULL::uuid, 'fallback'::text, v_risk;
END $$;

-- Guardrails
CREATE OR REPLACE FUNCTION public.autonomy_check_guardrails(
  _tenant_id uuid,
  _arena_id uuid,
  _action_type text,
  _payload jsonb,
  _conditions jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_risk text := public.autonomy_action_risk(_action_type);
  v_count_action int;
  v_count_tenant int;
  v_last_exec timestamptz;
  v_max_amount numeric;
  v_amount numeric;
  v_hours jsonb;
  v_h_start int;
  v_h_end int;
  v_now_hour int := EXTRACT(HOUR FROM now())::int;
  v_blocklist text[] := ARRAY['refund','cancel_payment','change_split','delete_user','delete_arena','delete_tenant','suspend_user','automatic_charge','force_block'];
  v_entity_id text;
BEGIN
  -- Risk gate
  IF v_risk IN ('high','critical') THEN
    RETURN QUERY SELECT false, 'risk_too_high'::text; RETURN;
  END IF;

  -- Blocklist
  IF _action_type = ANY(v_blocklist) THEN
    RETURN QUERY SELECT false, 'action_blocklisted'::text; RETURN;
  END IF;

  -- Rate limit per (tenant, action_type)
  SELECT count(*) INTO v_count_action
    FROM public.orkym_action_proposals
   WHERE tenant_id = _tenant_id
     AND action_type = _action_type
     AND auto_executed = true
     AND executed_at > now() - interval '1 hour';
  IF v_count_action >= 10 THEN
    RETURN QUERY SELECT false, 'rate_limit_action_type'::text; RETURN;
  END IF;

  -- Rate limit per tenant
  SELECT count(*) INTO v_count_tenant
    FROM public.orkym_action_proposals
   WHERE tenant_id = _tenant_id
     AND auto_executed = true
     AND executed_at > now() - interval '1 hour';
  IF v_count_tenant >= 30 THEN
    RETURN QUERY SELECT false, 'rate_limit_tenant'::text; RETURN;
  END IF;

  -- Cooldown 60s same action_type + entity
  v_entity_id := _payload->>'related_entity_id';
  IF v_entity_id IS NOT NULL THEN
    SELECT MAX(executed_at) INTO v_last_exec
      FROM public.orkym_action_proposals
     WHERE tenant_id = _tenant_id
       AND action_type = _action_type
       AND related_entity_id = v_entity_id::uuid
       AND auto_executed = true;
    IF v_last_exec IS NOT NULL AND v_last_exec > now() - interval '60 seconds' THEN
      RETURN QUERY SELECT false, 'cooldown_active'::text; RETURN;
    END IF;
  END IF;

  -- max_amount
  v_max_amount := NULLIF(_conditions->>'max_amount','')::numeric;
  v_amount := NULLIF(_payload->>'amount','')::numeric;
  IF v_max_amount IS NOT NULL AND v_amount IS NOT NULL AND v_amount > v_max_amount THEN
    RETURN QUERY SELECT false, 'amount_exceeds_max'::text; RETURN;
  END IF;

  -- allowed_hours [start,end]
  v_hours := _conditions->'allowed_hours';
  IF v_hours IS NOT NULL AND jsonb_typeof(v_hours) = 'array' AND jsonb_array_length(v_hours) = 2 THEN
    v_h_start := (v_hours->>0)::int;
    v_h_end   := (v_hours->>1)::int;
    IF v_now_hour < v_h_start OR v_now_hour >= v_h_end THEN
      RETURN QUERY SELECT false, 'outside_allowed_hours'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- Log decision
CREATE OR REPLACE FUNCTION public.autonomy_log_decision(
  _proposal_id uuid,
  _tenant_id uuid,
  _arena_id uuid,
  _domain text,
  _action_type text,
  _resolved_mode text,
  _policy_id uuid,
  _policy_source text,
  _guardrail_blocked text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.autonomy_policy_logs (
    proposal_id, tenant_id, arena_id, domain, action_type,
    resolved_mode, policy_id, policy_source, guardrail_blocked, metadata
  ) VALUES (
    _proposal_id, _tenant_id, _arena_id, _domain, _action_type,
    _resolved_mode, _policy_id, _policy_source, _guardrail_blocked, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Cleanup logs > 90d
CREATE OR REPLACE FUNCTION public.autonomy_purge_old_logs()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  WITH del AS (
    DELETE FROM public.autonomy_policy_logs WHERE created_at < now() - interval '90 days' RETURNING 1
  ) SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END $$;

-- ============================================================
-- 1.6 RLS
-- ============================================================
ALTER TABLE public.autonomy_policies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_kill_switches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_policy_logs     ENABLE ROW LEVEL SECURITY;

-- autonomy_policies SELECT
CREATE POLICY "autonomy_policies_select" ON public.autonomy_policies FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR (scope_level = 'global')
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (arena_id  IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);

-- autonomy_policies INSERT
CREATE POLICY "autonomy_policies_insert" ON public.autonomy_policies FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    scope_level IN ('tenant','arena')
    AND tenant_id IS NOT NULL
    AND public.is_tenant_admin(tenant_id, auth.uid())
  )
  OR (
    scope_level = 'arena'
    AND arena_id IS NOT NULL
    AND public.is_arena_owner(arena_id, auth.uid())
    AND NOT (execution_mode = 'auto' AND risk_level IN ('high','critical'))
  )
);

CREATE POLICY "autonomy_policies_update" ON public.autonomy_policies FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR (scope_level IN ('tenant','arena') AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (scope_level = 'arena' AND public.is_arena_owner(arena_id, auth.uid()))
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (scope_level IN ('tenant','arena') AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (
    scope_level = 'arena' AND public.is_arena_owner(arena_id, auth.uid())
    AND NOT (execution_mode = 'auto' AND risk_level IN ('high','critical'))
  )
);

CREATE POLICY "autonomy_policies_delete" ON public.autonomy_policies FOR DELETE
USING (
  public.is_admin(auth.uid())
  OR (scope_level IN ('tenant','arena') AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (scope_level = 'arena' AND public.is_arena_owner(arena_id, auth.uid()))
);

-- autonomy_kill_switches
CREATE POLICY "autonomy_kill_switches_select" ON public.autonomy_kill_switches FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR (scope_level = 'global')
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (arena_id  IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);

CREATE POLICY "autonomy_kill_switches_insert" ON public.autonomy_kill_switches FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (scope_level = 'arena' AND arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);

CREATE POLICY "autonomy_kill_switches_update" ON public.autonomy_kill_switches FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (scope_level = 'arena' AND public.is_arena_owner(arena_id, auth.uid()))
);

-- autonomy_policy_logs SELECT only
CREATE POLICY "autonomy_policy_logs_select" ON public.autonomy_policy_logs FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (arena_id  IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);

-- ============================================================
-- 1.7 View v_autonomy_metrics
-- ============================================================
CREATE OR REPLACE VIEW public.v_autonomy_metrics AS
SELECT
  date_trunc('day', l.created_at)::date AS day,
  l.tenant_id,
  l.action_type,
  l.resolved_mode,
  count(*) AS total,
  count(*) FILTER (WHERE l.resolved_mode = 'auto') AS auto_count,
  count(*) FILTER (WHERE l.resolved_mode = 'approve') AS approve_count,
  count(*) FILTER (WHERE l.resolved_mode = 'suggest') AS suggest_count,
  count(*) FILTER (WHERE l.guardrail_blocked IS NOT NULL) AS blocked_by_guardrail,
  count(*) FILTER (WHERE l.policy_source = 'kill_switch') AS blocked_by_kill_switch,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.orkym_action_proposals p
    WHERE p.id = l.proposal_id AND p.auto_executed = true
  )) AS auto_executed_count
FROM public.autonomy_policy_logs l
GROUP BY 1, 2, 3, 4;

-- ============================================================
-- 1.8 Seed default policies (global, mode=approve)
-- ============================================================
INSERT INTO public.autonomy_policies (scope_level, domain, action_type, execution_mode, risk_level, priority, conditions)
VALUES
  ('global','arena_operations','create_followup','approve','low',100,'{}'),
  ('global','arena_operations','create_reminder','approve','low',100,'{}'),
  ('global','arena_operations','schedule_operational_review','approve','low',100,'{}'),
  ('global','arena_operations','open_communication_thread','approve','low',100,'{}'),
  ('global','arena_operations','create_occurrence','approve','medium',100,'{}'),
  ('global','arena_operations','flag_enrollment_attention','approve','medium',100,'{}'),
  ('global','arena_operations','recovery_campaign_draft','approve','medium',100,'{}'),
  ('global','finance','propose_manual_charge','approve','medium',100,'{}'),
  ('global','growth','propose_promotion','approve','high',100,'{}')
ON CONFLICT DO NOTHING;