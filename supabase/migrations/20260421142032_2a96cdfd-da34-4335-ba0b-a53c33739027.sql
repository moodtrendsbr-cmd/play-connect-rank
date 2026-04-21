-- ============================================================
-- PHASE 10 — AI CONTROL TOWER: AUTONOMY MONETIZATION
-- ============================================================

-- 1.1 ALTER company_plans
ALTER TABLE public.company_plans
  ADD COLUMN IF NOT EXISTS autonomy_tier text NOT NULL DEFAULT 'free'
    CHECK (autonomy_tier IN ('free','growth','pro','business','enterprise')),
  ADD COLUMN IF NOT EXISTS orkym_calls_limit int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orkym_suggestions_limit int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orkym_auto_actions_limit int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orkym_allowed_domains text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill existing 3 plans
UPDATE public.company_plans SET
  autonomy_tier='free', orkym_calls_limit=20, orkym_suggestions_limit=10,
  orkym_auto_actions_limit=0, orkym_allowed_domains=ARRAY['arena_operations']
WHERE name='free';

UPDATE public.company_plans SET
  autonomy_tier='pro', orkym_calls_limit=500, orkym_suggestions_limit=200,
  orkym_auto_actions_limit=50, orkym_allowed_domains=ARRAY['arena_operations','growth']
WHERE name='pro';

UPDATE public.company_plans SET
  autonomy_tier='business', orkym_calls_limit=5000, orkym_suggestions_limit=2000,
  orkym_auto_actions_limit=1000,
  orkym_allowed_domains=ARRAY['arena_operations','growth','finance','tournaments']
WHERE name='elite';

-- 1.2 orkym_usage table
CREATE TABLE IF NOT EXISTS public.orkym_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  total_calls int NOT NULL DEFAULT 0,
  total_suggestions int NOT NULL DEFAULT 0,
  total_actions_proposed int NOT NULL DEFAULT 0,
  total_auto_executed int NOT NULL DEFAULT 0,
  total_approved int NOT NULL DEFAULT 0,
  total_rejected int NOT NULL DEFAULT 0,
  total_blocked_by_quota int NOT NULL DEFAULT 0,
  estimated_time_saved_minutes int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_orkym_usage_period_tenant
  ON public.orkym_usage (period_month DESC, tenant_id);

ALTER TABLE public.orkym_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view all usage"
  ON public.orkym_usage FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Tenant admin view tenant usage"
  ON public.orkym_usage FOR SELECT
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "Arena owner view tenant usage"
  ON public.orkym_usage FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.arenas a
    WHERE a.tenant_id = orkym_usage.tenant_id
      AND a.owner_user_id = auth.uid()
  ));

CREATE TRIGGER update_orkym_usage_updated_at
  BEFORE UPDATE ON public.orkym_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 RPC: orkym_get_tenant_tier
CREATE OR REPLACE FUNCTION public.orkym_get_tenant_tier(_tenant uuid)
RETURNS TABLE(
  tier text,
  plan_id uuid,
  calls_limit int,
  suggestions_limit int,
  auto_limit int,
  allowed_domains text[],
  source text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_override text;
  v_plan record;
  v_owner uuid;
BEGIN
  -- 1. Override em tenant_settings.metadata
  SELECT (ts.metadata->>'autonomy_tier_override') INTO v_override
    FROM public.tenant_settings ts
    WHERE ts.tenant_id = _tenant LIMIT 1;

  IF v_override IS NOT NULL AND v_override IN ('free','growth','pro','business','enterprise') THEN
    SELECT cp.* INTO v_plan FROM public.company_plans cp
      WHERE cp.autonomy_tier = v_override
      ORDER BY cp.monthly_price DESC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT
        v_override,
        v_plan.id,
        v_plan.orkym_calls_limit,
        v_plan.orkym_suggestions_limit,
        v_plan.orkym_auto_actions_limit,
        v_plan.orkym_allowed_domains,
        'override'::text;
      RETURN;
    END IF;
  END IF;

  -- 2. Subscription do owner do tenant
  SELECT t.owner_user_id INTO v_owner FROM public.tenants t WHERE t.id = _tenant;
  IF v_owner IS NOT NULL THEN
    SELECT cp.* INTO v_plan
      FROM public.subscriptions s
      JOIN public.companies c ON c.id = s.company_id
      JOIN public.company_plans cp ON cp.id = s.plan_id
      WHERE c.owner_user_id = v_owner AND s.status = 'active'
      ORDER BY cp.monthly_price DESC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT
        v_plan.autonomy_tier,
        v_plan.id,
        v_plan.orkym_calls_limit,
        v_plan.orkym_suggestions_limit,
        v_plan.orkym_auto_actions_limit,
        v_plan.orkym_allowed_domains,
        'subscription'::text;
      RETURN;
    END IF;
  END IF;

  -- 3. Fallback free
  SELECT cp.* INTO v_plan FROM public.company_plans cp
    WHERE cp.name = 'free' LIMIT 1;
  RETURN QUERY SELECT
    'free'::text,
    v_plan.id,
    COALESCE(v_plan.orkym_calls_limit, 20),
    COALESCE(v_plan.orkym_suggestions_limit, 10),
    COALESCE(v_plan.orkym_auto_actions_limit, 0),
    COALESCE(v_plan.orkym_allowed_domains, ARRAY['arena_operations']),
    'fallback'::text;
END $$;

-- 1.3 RPC: orkym_check_quota
CREATE OR REPLACE FUNCTION public.orkym_check_quota(_tenant uuid, _kind text)
RETURNS TABLE(
  allowed boolean,
  current_value int,
  limit_value int,
  tier text,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tier record;
  v_usage record;
  v_curr int := 0;
  v_lim int := 0;
  v_period date := date_trunc('month', now())::date;
BEGIN
  SELECT * INTO v_tier FROM public.orkym_get_tenant_tier(_tenant) LIMIT 1;
  IF v_tier IS NULL THEN
    RETURN QUERY SELECT true, 0, -1, 'free'::text, 'no_tier_resolved'::text;
    RETURN;
  END IF;

  SELECT * INTO v_usage FROM public.orkym_usage
    WHERE tenant_id = _tenant AND period_month = v_period LIMIT 1;

  IF _kind = 'calls' THEN
    v_curr := COALESCE(v_usage.total_calls, 0);
    v_lim := v_tier.calls_limit;
  ELSIF _kind = 'suggestions' THEN
    v_curr := COALESCE(v_usage.total_suggestions, 0);
    v_lim := v_tier.suggestions_limit;
  ELSIF _kind = 'auto_actions' THEN
    v_curr := COALESCE(v_usage.total_auto_executed, 0);
    v_lim := v_tier.auto_limit;
  ELSE
    RETURN QUERY SELECT true, 0, -1, v_tier.tier, 'unknown_kind'::text;
    RETURN;
  END IF;

  -- -1 = ilimitado
  IF v_lim = -1 THEN
    RETURN QUERY SELECT true, v_curr, -1, v_tier.tier, 'unlimited'::text;
    RETURN;
  END IF;

  IF v_curr >= v_lim THEN
    RETURN QUERY SELECT false, v_curr, v_lim, v_tier.tier, 'quota_exceeded'::text;
  ELSE
    RETURN QUERY SELECT true, v_curr, v_lim, v_tier.tier, 'within_limit'::text;
  END IF;
END $$;

-- 1.3 RPC: orkym_check_domain_allowed
CREATE OR REPLACE FUNCTION public.orkym_check_domain_allowed(_tenant uuid, _domain text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tier record;
BEGIN
  IF _domain = 'arena_operations' THEN RETURN true; END IF;
  SELECT * INTO v_tier FROM public.orkym_get_tenant_tier(_tenant) LIMIT 1;
  IF v_tier IS NULL THEN RETURN _domain = 'arena_operations'; END IF;
  RETURN _domain = ANY(v_tier.allowed_domains);
END $$;

-- 1.3 RPC: orkym_increment_usage
CREATE OR REPLACE FUNCTION public.orkym_increment_usage(
  _tenant uuid,
  _calls int DEFAULT 0,
  _suggestions int DEFAULT 0,
  _proposed int DEFAULT 0,
  _auto int DEFAULT 0,
  _approved int DEFAULT 0,
  _rejected int DEFAULT 0,
  _blocked int DEFAULT 0,
  _time_saved int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
  v_time int;
BEGIN
  -- Heurística: 5min/auto + 2min/sugg se _time_saved não fornecido
  v_time := COALESCE(NULLIF(_time_saved, 0), _auto * 5 + _suggestions * 2);

  INSERT INTO public.orkym_usage (
    tenant_id, period_month,
    total_calls, total_suggestions, total_actions_proposed,
    total_auto_executed, total_approved, total_rejected,
    total_blocked_by_quota, estimated_time_saved_minutes
  ) VALUES (
    _tenant, v_period,
    GREATEST(_calls,0), GREATEST(_suggestions,0), GREATEST(_proposed,0),
    GREATEST(_auto,0), GREATEST(_approved,0), GREATEST(_rejected,0),
    GREATEST(_blocked,0), GREATEST(v_time,0)
  )
  ON CONFLICT (tenant_id, period_month) DO UPDATE
    SET total_calls = orkym_usage.total_calls + GREATEST(EXCLUDED.total_calls,0),
        total_suggestions = orkym_usage.total_suggestions + GREATEST(EXCLUDED.total_suggestions,0),
        total_actions_proposed = orkym_usage.total_actions_proposed + GREATEST(EXCLUDED.total_actions_proposed,0),
        total_auto_executed = orkym_usage.total_auto_executed + GREATEST(EXCLUDED.total_auto_executed,0),
        total_approved = orkym_usage.total_approved + GREATEST(EXCLUDED.total_approved,0),
        total_rejected = orkym_usage.total_rejected + GREATEST(EXCLUDED.total_rejected,0),
        total_blocked_by_quota = orkym_usage.total_blocked_by_quota + GREATEST(EXCLUDED.total_blocked_by_quota,0),
        estimated_time_saved_minutes = orkym_usage.estimated_time_saved_minutes + GREATEST(EXCLUDED.estimated_time_saved_minutes,0),
        updated_at = now();
END $$;

-- 1.4 EXTENDER autonomy_resolve_policy com gating de tier
CREATE OR REPLACE FUNCTION public.autonomy_resolve_policy(
  _tenant_id uuid, _arena_id uuid, _domain text, _action_type text
)
RETURNS TABLE(execution_mode text, policy_id uuid, policy_source text, risk_level text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_policy record;
  v_risk text := public.autonomy_action_risk(_action_type);
  v_mode text;
  v_pid uuid;
  v_src text;
  v_tier record;
  v_qauto record;
  v_qsugg record;
  v_tier_auto_allowed_risks text[];
BEGIN
  -- 1. Kill switch (precedência absoluta)
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

  -- 2-9. Resolução clássica de policies
  v_mode := NULL; v_pid := NULL; v_src := NULL;

  IF _arena_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='arena' AND arena_id=_arena_id AND action_type=_action_type
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='arena_action'; END IF;

    IF v_mode IS NULL THEN
      SELECT * INTO v_policy FROM public.autonomy_policies
        WHERE is_enabled AND scope_level='arena' AND arena_id=_arena_id
          AND domain=_domain AND action_type IS NULL
        ORDER BY priority ASC LIMIT 1;
      IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='arena_domain'; END IF;
    END IF;
  END IF;

  IF v_mode IS NULL AND _tenant_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id AND action_type=_action_type
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='tenant_action'; END IF;

    IF v_mode IS NULL THEN
      SELECT * INTO v_policy FROM public.autonomy_policies
        WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id
          AND domain=_domain AND action_type IS NULL
        ORDER BY priority ASC LIMIT 1;
      IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='tenant_domain'; END IF;
    END IF;

    IF v_mode IS NULL THEN
      SELECT * INTO v_policy FROM public.autonomy_policies
        WHERE is_enabled AND scope_level='tenant' AND tenant_id=_tenant_id
          AND domain IS NULL AND action_type IS NULL
        ORDER BY priority ASC LIMIT 1;
      IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='tenant_catchall'; END IF;
    END IF;
  END IF;

  IF v_mode IS NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='global' AND action_type=_action_type
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='global_action'; END IF;
  END IF;

  IF v_mode IS NULL THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
      WHERE is_enabled AND scope_level='global' AND domain=_domain AND action_type IS NULL
      ORDER BY priority ASC LIMIT 1;
    IF FOUND THEN v_mode:=v_policy.execution_mode; v_pid:=v_policy.id; v_src:='global_domain'; END IF;
  END IF;

  -- Fallback hardcoded = approve
  IF v_mode IS NULL THEN
    v_mode := 'approve';
    v_src := 'fallback_hardcoded';
    v_pid := NULL;
  END IF;

  -- ============================================================
  -- FASE 10 — TIER GATING (defensivo)
  -- ============================================================
  BEGIN
    SELECT * INTO v_tier FROM public.orkym_get_tenant_tier(_tenant_id) LIMIT 1;

    -- Domain gating
    IF v_tier IS NOT NULL AND _domain IS NOT NULL THEN
      IF _domain <> 'arena_operations' AND NOT (_domain = ANY(v_tier.allowed_domains)) THEN
        v_mode := 'suggest';
        v_src := 'tier_domain_block';
      END IF;
    END IF;

    -- Tier risk-level gating para auto
    IF v_mode = 'auto' AND v_tier IS NOT NULL THEN
      v_tier_auto_allowed_risks := CASE v_tier.tier
        WHEN 'free' THEN ARRAY[]::text[]
        WHEN 'growth' THEN ARRAY[]::text[]
        WHEN 'pro' THEN ARRAY['low']
        WHEN 'business' THEN ARRAY['low','medium']
        WHEN 'enterprise' THEN ARRAY['low','medium','high']
        ELSE ARRAY[]::text[]
      END;
      IF NOT (v_risk = ANY(v_tier_auto_allowed_risks)) THEN
        v_mode := 'approve';
        v_src := 'tier_no_auto';
      END IF;
    END IF;

    -- Quota auto
    IF v_mode = 'auto' THEN
      SELECT * INTO v_qauto FROM public.orkym_check_quota(_tenant_id, 'auto_actions') LIMIT 1;
      IF v_qauto IS NOT NULL AND v_qauto.allowed = false THEN
        v_mode := 'approve';
        v_src := 'quota_auto';
      END IF;
    END IF;

    -- Quota suggestions (rebaixa approve→suggest se sugg estourou)
    IF v_mode = 'approve' THEN
      SELECT * INTO v_qsugg FROM public.orkym_check_quota(_tenant_id, 'suggestions') LIMIT 1;
      IF v_qsugg IS NOT NULL AND v_qsugg.allowed = false THEN
        v_mode := 'suggest';
        v_src := 'quota_suggestions';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Defensivo: gating não pode quebrar resolver
    NULL;
  END;

  RETURN QUERY SELECT v_mode, v_pid, v_src, v_risk;
END $$;

-- 1.5 View v_orkym_usage_summary
CREATE OR REPLACE VIEW public.v_orkym_usage_summary
WITH (security_invoker=true)
AS
SELECT
  u.tenant_id,
  t.name as tenant_name,
  COALESCE(tier.tier, 'free') as tier,
  u.period_month,
  u.total_calls,
  u.total_suggestions,
  u.total_actions_proposed,
  u.total_auto_executed,
  u.total_approved,
  u.total_rejected,
  u.total_blocked_by_quota,
  u.estimated_time_saved_minutes,
  COALESCE(tier.calls_limit, 0) as calls_limit,
  COALESCE(tier.suggestions_limit, 0) as suggestions_limit,
  COALESCE(tier.auto_limit, 0) as auto_limit,
  CASE WHEN COALESCE(tier.calls_limit,0) > 0
    THEN LEAST(100, ROUND(100.0 * u.total_calls / tier.calls_limit))
    ELSE 0 END as pct_calls,
  CASE WHEN COALESCE(tier.suggestions_limit,0) > 0
    THEN LEAST(100, ROUND(100.0 * u.total_suggestions / tier.suggestions_limit))
    ELSE 0 END as pct_suggestions,
  CASE WHEN COALESCE(tier.auto_limit,0) > 0
    THEN LEAST(100, ROUND(100.0 * u.total_auto_executed / tier.auto_limit))
    ELSE 0 END as pct_auto,
  CASE
    WHEN u.period_month = date_trunc('month', now())::date THEN
      ROUND(u.total_calls::numeric * 30.0 /
        GREATEST(EXTRACT(day FROM now())::int, 1))
    ELSE u.total_calls
  END as projected_calls_eom,
  u.updated_at as last_activity
FROM public.orkym_usage u
LEFT JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN LATERAL public.orkym_get_tenant_tier(u.tenant_id) tier ON true;

GRANT SELECT ON public.v_orkym_usage_summary TO authenticated, anon;
