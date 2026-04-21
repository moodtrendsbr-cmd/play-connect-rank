-- Phase 8: ORKYM Action Proposals (Controlled Autonomy)

-- ============================================================
-- 1. Tabela orkym_action_proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orkym_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid,
  domain text NOT NULL CHECK (domain IN ('arena_operations','finance','tournaments','growth')),
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','executing','executed','failed','expired','canceled')),

  related_entity_type text,
  related_entity_id uuid,

  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  human_summary jsonb NOT NULL DEFAULT '{}'::jsonb,

  source text NOT NULL DEFAULT 'orkym',
  orkym_request_id text,
  correlation_id text,

  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,

  executed_at timestamptz,
  execution_result jsonb,
  failed_at timestamptz,
  failure_reason text,

  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orkym_action_proposals_tenant_status_created
  ON public.orkym_action_proposals (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orkym_action_proposals_arena_status
  ON public.orkym_action_proposals (arena_id, status);
CREATE INDEX IF NOT EXISTS idx_orkym_action_proposals_request_id
  ON public.orkym_action_proposals (orkym_request_id);
CREATE INDEX IF NOT EXISTS idx_orkym_action_proposals_proposed_partial
  ON public.orkym_action_proposals (created_at DESC) WHERE status = 'proposed';

-- Idempotência: mesma proposta da ORKYM não pode duplicar
CREATE UNIQUE INDEX IF NOT EXISTS uq_orkym_action_proposals_dedup
  ON public.orkym_action_proposals (orkym_request_id, action_type, related_entity_id)
  WHERE orkym_request_id IS NOT NULL;

ALTER TABLE public.orkym_action_proposals ENABLE ROW LEVEL SECURITY;

-- SELECT: admin / tenant_admin / arena_owner
CREATE POLICY "select_orkym_action_proposals"
  ON public.orkym_action_proposals FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_tenant_admin(tenant_id, auth.uid())
    OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
  );

-- INSERT/UPDATE/DELETE bloqueados a clients (apenas via SECURITY DEFINER)
-- (sem policy = sem acesso)

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_orkym_action_proposals_updated_at ON public.orkym_action_proposals;
CREATE TRIGGER trg_orkym_action_proposals_updated_at
  BEFORE UPDATE ON public.orkym_action_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Tabela orkym_action_executions (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orkym_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.orkym_action_proposals(id) ON DELETE CASCADE,
  attempt_number int NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('started','succeeded','failed')),
  result jsonb,
  error_message text,
  executed_by uuid,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orkym_action_executions_proposal
  ON public.orkym_action_executions (proposal_id, created_at DESC);

ALTER TABLE public.orkym_action_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_orkym_action_executions"
  ON public.orkym_action_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orkym_action_proposals p
      WHERE p.id = proposal_id
        AND (
          public.is_admin(auth.uid())
          OR public.is_tenant_admin(p.tenant_id, auth.uid())
          OR (p.arena_id IS NOT NULL AND public.is_arena_owner(p.arena_id, auth.uid()))
        )
    )
  );

-- ============================================================
-- 3. RPC: orkym_ingest_actions (service role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_ingest_actions(_payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := (_payload->>'tenant_id')::uuid;
  v_arena uuid := NULLIF(_payload->>'arena_id','')::uuid;
  v_request_id text := _payload->>'request_id';
  v_correlation_id text := _payload->>'correlation_id';
  v_actions jsonb := COALESCE(_payload->'actions', '[]'::jsonb);
  v_action jsonb;
  v_count int := 0;
  v_action_type text;
  v_domain text;
  v_payload_clean jsonb;
  v_human jsonb;
  v_allowed text[] := ARRAY[
    'create_followup','create_reminder','create_occurrence',
    'propose_manual_charge','flag_enrollment_attention',
    'propose_promotion','schedule_operational_review',
    'open_communication_thread','recovery_campaign_draft'
  ];
  v_sensitive_keys text[] := ARRAY['password','cpf','email','phone','whatsapp','token','secret','api_key'];
  v_key text;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_id_required'; END IF;
  IF jsonb_typeof(v_actions) <> 'array' THEN RETURN 0; END IF;

  FOR v_action IN SELECT * FROM jsonb_array_elements(v_actions) LOOP
    v_action_type := v_action->>'action_type';
    v_domain := COALESCE(v_action->>'domain', 'arena_operations');

    -- Allowlist
    IF v_action_type IS NULL OR NOT (v_action_type = ANY(v_allowed)) THEN
      CONTINUE;
    END IF;

    -- Sanitiza payload (remove chaves sensíveis no nível raiz)
    v_payload_clean := COALESCE(v_action->'payload', '{}'::jsonb);
    FOREACH v_key IN ARRAY v_sensitive_keys LOOP
      v_payload_clean := v_payload_clean - v_key;
    END LOOP;

    -- Human summary (safe to render)
    v_human := jsonb_build_object(
      'title', v_action->>'title',
      'description', v_action->>'description',
      'related_entity_type', v_action->>'related_entity_type',
      'related_entity_id', v_action->>'related_entity_id',
      'priority', COALESCE(v_action->>'priority','medium'),
      'action_type', v_action_type,
      'domain', v_domain
    );

    BEGIN
      INSERT INTO public.orkym_action_proposals (
        tenant_id, arena_id, domain, action_type,
        title, description, priority,
        related_entity_type, related_entity_id,
        proposed_payload, human_summary,
        source, orkym_request_id, correlation_id
      ) VALUES (
        v_tenant, v_arena, v_domain, v_action_type,
        COALESCE(v_action->>'title','(sem título)'),
        v_action->>'description',
        COALESCE(v_action->>'priority','medium'),
        v_action->>'related_entity_type',
        NULLIF(v_action->>'related_entity_id','')::uuid,
        v_payload_clean, v_human,
        'orkym', v_request_id, v_correlation_id
      );
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      -- dedup, ignora
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.orkym_ingest_actions(jsonb) FROM public, anon, authenticated;

-- ============================================================
-- 4. RPC: orkym_action_approve
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_approve(_proposal_id uuid)
RETURNS public.orkym_action_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_p public.orkym_action_proposals;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_p FROM public.orkym_action_proposals WHERE id = _proposal_id FOR UPDATE;
  IF v_p IS NULL THEN RAISE EXCEPTION 'proposal_not_found'; END IF;

  -- Permissão
  IF NOT (
    public.is_admin(v_user)
    OR public.is_tenant_admin(v_p.tenant_id, v_user)
    OR (v_p.arena_id IS NOT NULL AND public.is_arena_owner(v_p.arena_id, v_user))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Restrição: propose_promotion exige tenant_admin ou admin global
  IF v_p.action_type = 'propose_promotion' AND NOT (
    public.is_admin(v_user) OR public.is_tenant_admin(v_p.tenant_id, v_user)
  ) THEN
    RAISE EXCEPTION 'forbidden_for_promotion';
  END IF;

  IF v_p.status <> 'proposed' THEN RAISE EXCEPTION 'invalid_state:%', v_p.status; END IF;
  IF v_p.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;

  UPDATE public.orkym_action_proposals
     SET status = 'approved', approved_by = v_user, approved_at = now(), updated_at = now()
   WHERE id = _proposal_id
   RETURNING * INTO v_p;

  RETURN v_p;
END $$;

-- ============================================================
-- 5. RPC: orkym_action_reject
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_reject(_proposal_id uuid, _reason text)
RETURNS public.orkym_action_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_p public.orkym_action_proposals;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_p FROM public.orkym_action_proposals WHERE id = _proposal_id FOR UPDATE;
  IF v_p IS NULL THEN RAISE EXCEPTION 'proposal_not_found'; END IF;

  IF NOT (
    public.is_admin(v_user)
    OR public.is_tenant_admin(v_p.tenant_id, v_user)
    OR (v_p.arena_id IS NOT NULL AND public.is_arena_owner(v_p.arena_id, v_user))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_p.status <> 'proposed' THEN RAISE EXCEPTION 'invalid_state:%', v_p.status; END IF;

  UPDATE public.orkym_action_proposals
     SET status = 'rejected', rejected_by = v_user, rejected_at = now(),
         rejection_reason = _reason, updated_at = now()
   WHERE id = _proposal_id
   RETURNING * INTO v_p;

  RETURN v_p;
END $$;

-- ============================================================
-- 6. RPC: orkym_action_mark_executing (service role only, CAS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_mark_executing(_proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_updated int;
BEGIN
  UPDATE public.orkym_action_proposals
     SET status = 'executing', updated_at = now()
   WHERE id = _proposal_id
     AND status = 'approved'
     AND expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;

REVOKE ALL ON FUNCTION public.orkym_action_mark_executing(uuid) FROM public, anon, authenticated;

-- ============================================================
-- 7. RPC: orkym_action_mark_executed
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_mark_executed(
  _proposal_id uuid,
  _result jsonb,
  _executed_by uuid,
  _duration_ms int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orkym_action_proposals
     SET status = 'executed', executed_at = now(),
         execution_result = _result, updated_at = now()
   WHERE id = _proposal_id;

  INSERT INTO public.orkym_action_executions (
    proposal_id, attempt_number, status, result, executed_by, duration_ms
  ) VALUES (
    _proposal_id,
    COALESCE((SELECT MAX(attempt_number)+1 FROM public.orkym_action_executions WHERE proposal_id = _proposal_id), 1),
    'succeeded', _result, _executed_by, _duration_ms
  );
END $$;

REVOKE ALL ON FUNCTION public.orkym_action_mark_executed(uuid, jsonb, uuid, int) FROM public, anon, authenticated;

-- ============================================================
-- 8. RPC: orkym_action_mark_failed
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_mark_failed(
  _proposal_id uuid,
  _reason text,
  _executed_by uuid,
  _duration_ms int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orkym_action_proposals
     SET status = 'failed', failed_at = now(),
         failure_reason = _reason, updated_at = now()
   WHERE id = _proposal_id;

  INSERT INTO public.orkym_action_executions (
    proposal_id, attempt_number, status, error_message, executed_by, duration_ms
  ) VALUES (
    _proposal_id,
    COALESCE((SELECT MAX(attempt_number)+1 FROM public.orkym_action_executions WHERE proposal_id = _proposal_id), 1),
    'failed', _reason, _executed_by, _duration_ms
  );
END $$;

REVOKE ALL ON FUNCTION public.orkym_action_mark_failed(uuid, text, uuid, int) FROM public, anon, authenticated;

-- ============================================================
-- 9. RPC: orkym_action_expire_stale (cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.orkym_action_expire_stale()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.orkym_action_proposals
       SET status = 'expired', updated_at = now()
     WHERE status = 'proposed' AND expires_at < now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $$;

-- ============================================================
-- 10. View v_orkym_action_metrics
-- ============================================================
CREATE OR REPLACE VIEW public.v_orkym_action_metrics
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  tenant_id,
  domain,
  action_type,
  COUNT(*) FILTER (WHERE status = 'proposed') AS proposed_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE status = 'executed') AS executed_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COUNT(*) AS total_count,
  AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) * 1000)
    FILTER (WHERE approved_at IS NOT NULL) AS avg_time_to_approval_ms,
  AVG(EXTRACT(EPOCH FROM (executed_at - approved_at)) * 1000)
    FILTER (WHERE executed_at IS NOT NULL AND approved_at IS NOT NULL) AS avg_execution_ms
FROM public.orkym_action_proposals
GROUP BY 1, 2, 3, 4;

GRANT SELECT ON public.v_orkym_action_metrics TO authenticated;