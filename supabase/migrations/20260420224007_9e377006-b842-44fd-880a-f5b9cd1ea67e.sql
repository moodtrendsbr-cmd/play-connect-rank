-- 1. COMMENTS (semantic clarity)
COMMENT ON TABLE public.arena_operational_events IS 'Trilha operacional interna da arena (presença, billing, etc). Append-only. Não confundir com tournaments (eventos esportivos públicos).';
COMMENT ON TABLE public.arena_operational_tasks IS 'AÇÕES a executar pela operação (pendência, follow-up, sugestão). Estados: open/dismissed/done. Tem priority. Diferente de arena_occurrences (que é o PROBLEMA registrado).';
COMMENT ON TABLE public.arena_occurrences IS 'PROBLEMAS/registros de fato (incidente, manutenção, conflito). Estados: open/in_progress/resolved/closed. Tem severity. Diferente de arena_operational_tasks (que é a AÇÃO).';

-- 2. event_type format CHECK (NOT VALID = não revalida histórico)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_type_format') THEN
    ALTER TABLE public.arena_operational_events
      ADD CONSTRAINT event_type_format CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$') NOT VALID;
  END IF;
END $$;

-- 3-4. cross-link columns (nullable, soft relation)
ALTER TABLE public.arena_operational_tasks ADD COLUMN IF NOT EXISTS occurrence_id uuid;
ALTER TABLE public.arena_occurrences ADD COLUMN IF NOT EXISTS task_id uuid;

-- 5-6. status CHECKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_chk') THEN
    ALTER TABLE public.arena_operational_tasks
      ADD CONSTRAINT tasks_status_chk CHECK (status IN ('open','dismissed','done'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'occ_status_chk') THEN
    ALTER TABLE public.arena_occurrences
      ADD CONSTRAINT occ_status_chk CHECK (status IN ('open','in_progress','resolved','closed'));
  END IF;
END $$;

-- 7. billing cycles split-ready columns
ALTER TABLE public.arena_billing_cycles
  ADD COLUMN IF NOT EXISTS payment_account_id uuid,
  ADD COLUMN IF NOT EXISTS provider_preference_id text,
  ADD COLUMN IF NOT EXISTS gross_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(10,2);

-- 8. backfill existing rows
UPDATE public.arena_billing_cycles
   SET gross_amount = amount,
       net_amount   = amount,
       fee_amount   = COALESCE(fee_amount, 0)
 WHERE gross_amount IS NULL;

-- 9. archived_at on events
ALTER TABLE public.arena_operational_events ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 10. indexes
CREATE INDEX IF NOT EXISTS idx_arena_op_events_arena_created
  ON public.arena_operational_events (arena_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arena_op_events_unprocessed
  ON public.arena_operational_events (arena_id, processed_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_arena_op_events_type
  ON public.arena_operational_events (arena_id, event_type, created_at DESC);

-- 11. RPC: generate billing cycle (with split-ready snapshot)
CREATE OR REPLACE FUNCTION public.arena_generate_billing_cycle(_subscription_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _plan record;
  _period_start timestamptz;
  _period_end timestamptz;
  _due_at timestamptz;
  _cycle_id uuid;
BEGIN
  SELECT * INTO _sub FROM arena_student_subscriptions WHERE id = _subscription_id;
  IF _sub IS NULL THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  IF NOT (is_arena_owner(_sub.arena_id, auth.uid())
       OR is_tenant_admin(_sub.tenant_id, auth.uid())
       OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _plan FROM arena_membership_plans WHERE id = _sub.plan_id;
  IF _plan IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;

  _period_start := COALESCE(_sub.next_due_at, _sub.current_period_end, now());
  _period_end := CASE _plan.billing_frequency
    WHEN 'monthly'   THEN _period_start + interval '1 month'
    WHEN 'quarterly' THEN _period_start + interval '3 months'
    WHEN 'yearly'    THEN _period_start + interval '1 year'
    ELSE _period_start + interval '1 month'
  END;
  _due_at := _period_start;

  INSERT INTO arena_billing_cycles (
    tenant_id, arena_id, subscription_id,
    period_start, period_end, due_at,
    amount, status,
    payment_account_id, gross_amount, fee_amount, net_amount
  ) VALUES (
    _sub.tenant_id, _sub.arena_id, _sub.id,
    _period_start, _period_end, _due_at,
    _plan.amount, 'pending',
    _sub.payment_account_id, _plan.amount, 0, _plan.amount
  ) RETURNING id INTO _cycle_id;

  UPDATE arena_student_subscriptions
     SET current_period_start = _period_start,
         current_period_end   = _period_end,
         next_due_at          = _period_end,
         updated_at           = now()
   WHERE id = _sub.id;

  RETURN _cycle_id;
END $$;

-- 12. RPC: mark cycle paid (accepts optional fee_amount)
CREATE OR REPLACE FUNCTION public.arena_mark_cycle_paid(
  _cycle_id uuid,
  _payment_method text DEFAULT 'manual',
  _payment_reference text DEFAULT NULL,
  _fee_amount numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cycle record;
BEGIN
  SELECT * INTO _cycle FROM arena_billing_cycles WHERE id = _cycle_id;
  IF _cycle IS NULL THEN RAISE EXCEPTION 'Cycle not found'; END IF;

  IF NOT (is_arena_owner(_cycle.arena_id, auth.uid())
       OR is_tenant_admin(_cycle.tenant_id, auth.uid())
       OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE arena_billing_cycles
     SET status            = 'paid',
         paid_at           = now(),
         payment_method    = _payment_method,
         payment_reference = _payment_reference,
         fee_amount        = COALESCE(_fee_amount, 0),
         net_amount        = COALESCE(gross_amount, amount) - COALESCE(_fee_amount, 0),
         updated_at        = now()
   WHERE id = _cycle_id;
END $$;

-- 13. RPC: archive old processed events (soft retention)
CREATE OR REPLACE FUNCTION public.arena_archive_old_events(
  _arena_id uuid,
  _older_than_days int DEFAULT 180
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM arenas WHERE id = _arena_id;

  IF NOT (is_arena_owner(_arena_id, auth.uid())
       OR (_tenant IS NOT NULL AND is_tenant_admin(_tenant, auth.uid()))
       OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE arena_operational_events
     SET archived_at = now()
   WHERE arena_id = _arena_id
     AND processed_at IS NOT NULL
     AND archived_at IS NULL
     AND created_at < now() - (_older_than_days || ' days')::interval;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;