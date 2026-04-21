-- 1. ALTER arena_operational_tasks
ALTER TABLE public.arena_operational_tasks
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_arena_op_tasks_correlation
  ON public.arena_operational_tasks(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- 2. orkym_api_calls
CREATE TABLE IF NOT EXISTS public.orkym_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  correlation_id text,
  tenant_id uuid,
  arena_id uuid,
  domain text NOT NULL,
  action text NOT NULL,
  http_status int,
  status text NOT NULL CHECK (status IN ('success','failed','timeout','degraded','rate_limited','deduped')),
  duration_ms int,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  retried_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orkym_calls_tenant_created
  ON public.orkym_api_calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orkym_calls_domain_action_created
  ON public.orkym_api_calls(domain, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orkym_calls_status_created
  ON public.orkym_api_calls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orkym_calls_request_id
  ON public.orkym_api_calls(request_id);

ALTER TABLE public.orkym_api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orkym_calls_admin_select"
  ON public.orkym_api_calls FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "orkym_calls_tenant_admin_select"
  ON public.orkym_api_calls FOR SELECT
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()));

-- INSERT/UPDATE/DELETE: nenhum role normal — só service role bypass

-- 3. orkym_dedup
CREATE TABLE IF NOT EXISTS public.orkym_dedup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedup_key text UNIQUE NOT NULL,
  tenant_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orkym_dedup_expires
  ON public.orkym_dedup(expires_at);

ALTER TABLE public.orkym_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orkym_dedup_admin_select"
  ON public.orkym_dedup FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 4. RPC orkym_ingest_tasks
CREATE OR REPLACE FUNCTION public.orkym_ingest_tasks(_payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := NULLIF(_payload->>'tenant_id','')::uuid;
  v_arena uuid := NULLIF(_payload->>'arena_id','')::uuid;
  v_correlation text := _payload->>'correlation_id';
  v_request_id text := _payload->>'request_id';
  v_tasks jsonb := COALESCE(_payload->'tasks', '[]'::jsonb);
  v_task jsonb;
  v_count int := 0;
  v_priority int;
BEGIN
  IF v_arena IS NULL THEN
    RETURN 0; -- tasks operacionais exigem arena
  END IF;

  FOR v_task IN SELECT * FROM jsonb_array_elements(v_tasks) LOOP
    v_priority := COALESCE((v_task->>'priority')::int, 2);
    IF v_priority NOT IN (1,2,3) THEN v_priority := 2; END IF;

    INSERT INTO public.arena_operational_tasks (
      tenant_id, arena_id, task_type, title, description,
      priority, status, source, correlation_id, metadata,
      related_entity_type, related_entity_id
    ) VALUES (
      v_tenant, v_arena,
      COALESCE(v_task->>'task_type', 'orkym_suggestion'),
      COALESCE(v_task->>'title', '(sem título)'),
      v_task->>'description',
      v_priority,
      'open',
      'orkym',
      v_correlation,
      jsonb_build_object('request_id', v_request_id) || COALESCE(v_task->'metadata', '{}'::jsonb),
      v_task->>'related_entity_type',
      NULLIF(v_task->>'related_entity_id','')::uuid
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.orkym_ingest_tasks(jsonb) FROM PUBLIC, authenticated, anon;

-- 5. RPC orkym_purge_dedup
CREATE OR REPLACE FUNCTION public.orkym_purge_dedup()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  WITH del AS (
    DELETE FROM public.orkym_dedup WHERE expires_at < now() RETURNING 1
  ) SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END $$;

-- 6. View v_orkym_metrics (security_invoker para herdar RLS de orkym_api_calls)
CREATE OR REPLACE VIEW public.v_orkym_metrics
WITH (security_invoker = on) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  domain,
  action,
  tenant_id,
  count(*)::int AS total,
  count(*) FILTER (WHERE status='success')::int AS success,
  count(*) FILTER (WHERE status='failed')::int AS failed,
  count(*) FILTER (WHERE status='timeout')::int AS timeouts,
  count(*) FILTER (WHERE status='degraded')::int AS degraded,
  count(*) FILTER (WHERE status='rate_limited')::int AS rate_limited,
  count(*) FILTER (WHERE status='deduped')::int AS deduped,
  ROUND(AVG(duration_ms) FILTER (WHERE status='success'))::int AS avg_duration_ms_success
FROM public.orkym_api_calls
GROUP BY 1,2,3,4;

GRANT SELECT ON public.v_orkym_metrics TO authenticated;