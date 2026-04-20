-- ============================================================
-- FASE 5.5 — Finance Hardening + Settlement Readiness
-- ============================================================

-- 1. Status hardening em financial_transactions
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_status_chk') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT ftx_status_chk
      CHECK (status IN ('pending','paid','failed','canceled','refunded','partially_refunded','disputed'))
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_refunded_amount_chk') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT ftx_refunded_amount_chk
      CHECK (refunded_amount >= 0 AND refunded_amount <= total_amount)
      NOT VALID;
  END IF;
END $$;

-- 2. Status hardening em transaction_splits
ALTER TABLE public.transaction_splits
  ADD COLUMN IF NOT EXISTS expected_settlement_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS settlement_method text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

-- Backfill: status atual 'pending' significa "calculado"
UPDATE public.transaction_splits SET status = 'calculated' WHERE status = 'pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tsplits_status_chk') THEN
    ALTER TABLE public.transaction_splits
      ADD CONSTRAINT tsplits_status_chk
      CHECK (status IN ('pending','calculated','settled','canceled','reversed','failed'))
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tsplits_amount_chk') THEN
    ALTER TABLE public.transaction_splits
      ADD CONSTRAINT tsplits_amount_chk
      CHECK (amount >= 0)
      NOT VALID;
  END IF;
END $$;

-- 3. Tabela financial_adjustments (append-only)
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('refund_full','refund_partial','cancellation','manual_credit','manual_debit','split_correction')),
  amount numeric(10,2) NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  external_reference text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fadj_tx ON public.financial_adjustments (transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fadj_tenant ON public.financial_adjustments (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fadj_type ON public.financial_adjustments (adjustment_type);

ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fadj_select ON public.financial_adjustments;
CREATE POLICY fadj_select ON public.financial_adjustments FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR public.is_tenant_admin(tenant_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    WHERE ft.id = transaction_id
      AND (
        (ft.arena_id IS NOT NULL AND public.is_arena_owner(ft.arena_id, auth.uid()))
        OR (ft.organizer_id IS NOT NULL AND ft.organizer_id = auth.uid())
      )
  )
);

-- INSERT/UPDATE/DELETE bloqueados (apenas via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS fadj_no_insert ON public.financial_adjustments;
CREATE POLICY fadj_no_insert ON public.financial_adjustments FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS fadj_no_update ON public.financial_adjustments;
CREATE POLICY fadj_no_update ON public.financial_adjustments FOR UPDATE USING (false);
DROP POLICY IF EXISTS fadj_no_delete ON public.financial_adjustments;
CREATE POLICY fadj_no_delete ON public.financial_adjustments FOR DELETE USING (false);

-- 4. Helper: cálculo de data esperada de settlement
CREATE OR REPLACE FUNCTION public.finance_compute_expected_settlement(_tenant_id uuid, _paid_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
BEGIN
  SELECT COALESCE((metadata->>'settlement_delay_days')::int, 2)
    INTO v_days
    FROM public.tenant_settings
   WHERE tenant_id = _tenant_id
   LIMIT 1;
  RETURN COALESCE(_paid_at, now()) + (COALESCE(v_days, 2) || ' days')::interval;
END $$;

-- 5. finance_record_payment atualizado (split_source em metadata, expected_settlement_at, payment_account p/ todos)
CREATE OR REPLACE FUNCTION public.finance_record_payment(
  _source_type text, _source_id uuid, _total numeric,
  _provider text DEFAULT NULL, _reference text DEFAULT NULL,
  _paid_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_arena uuid;
  v_organizer uuid;
  v_company_id uuid;
  v_tx_id uuid;
  v_existing_status text;
  v_rule record;
  v_override jsonb;
  v_split_source text := 'fallback';
  v_platform_pct numeric(5,2);
  v_organizer_pct numeric(5,2);
  v_arena_pct numeric(5,2);
  v_company_pct numeric(5,2);
  v_affiliate_pct numeric(5,2);
  v_arena_pay uuid;
  v_org_pay uuid;
  v_company_pay uuid;
  v_expected timestamptz;
BEGIN
  -- Resolve fonte → tenant/arena/organizer/company
  IF _source_type = 'enrollment' THEN
    SELECT t.tenant_id, t.organizer_id, t.default_split_config
      INTO v_tenant, v_organizer, v_override
      FROM enrollments e JOIN tournaments t ON t.id = e.tournament_id
     WHERE e.id = _source_id;
  ELSIF _source_type = 'booking' THEN
    SELECT b.tenant_id, b.arena_id INTO v_tenant, v_arena FROM bookings b WHERE b.id = _source_id;
  ELSIF _source_type = 'marketplace_order' THEN
    SELECT mo.tenant_id, p.company_id INTO v_tenant, v_company_id
      FROM marketplace_orders mo JOIN products p ON p.id = mo.product_id WHERE mo.id = _source_id;
  ELSIF _source_type = 'arena_billing_cycle' THEN
    SELECT bc.tenant_id, bc.arena_id INTO v_tenant, v_arena FROM arena_billing_cycles bc WHERE bc.id = _source_id;
  ELSIF _source_type = 'sponsorship' THEN
    SELECT ts.tenant_id, ts.company_id, t.organizer_id INTO v_tenant, v_company_id, v_organizer
      FROM tournament_sponsorships ts LEFT JOIN tournaments t ON t.id = ts.tournament_id WHERE ts.id = _source_id;
  END IF;

  IF v_tenant IS NULL THEN v_tenant := '00000000-0000-0000-0000-000000000001'::uuid; END IF;

  v_expected := public.finance_compute_expected_settlement(v_tenant, _paid_at);

  -- UPSERT idempotente
  INSERT INTO financial_transactions (
    tenant_id, arena_id, organizer_id, source_type, source_id,
    total_amount, status, payment_provider, payment_reference, paid_at
  ) VALUES (
    v_tenant, v_arena, v_organizer, _source_type, _source_id,
    _total, 'paid', _provider, _reference, _paid_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET status = CASE
          WHEN financial_transactions.status IN ('refunded','partially_refunded','disputed','canceled')
          THEN financial_transactions.status
          ELSE 'paid'
        END,
        total_amount = EXCLUDED.total_amount,
        payment_provider = COALESCE(EXCLUDED.payment_provider, financial_transactions.payment_provider),
        payment_reference = COALESCE(EXCLUDED.payment_reference, financial_transactions.payment_reference),
        paid_at = COALESCE(EXCLUDED.paid_at, financial_transactions.paid_at),
        updated_at = now()
  RETURNING id, status INTO v_tx_id, v_existing_status;

  -- Guard: se já tem splits OU status terminal de refund → não recriar
  IF v_existing_status IN ('refunded','partially_refunded','canceled')
     OR EXISTS (SELECT 1 FROM transaction_splits WHERE transaction_id = v_tx_id) THEN
    IF v_arena IS NOT NULL THEN
      INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
      VALUES (v_tenant, v_arena, 'financial_transaction', v_tx_id, 'finance.payment_received',
              jsonb_build_object('source_type', _source_type, 'source_id', _source_id, 'total', _total, 'idempotent_skip', true), 'system');
    END IF;
    RETURN v_tx_id;
  END IF;

  -- Resolve regras (hierarquia: tenant > global > fallback)
  SELECT * INTO v_rule FROM split_rules
    WHERE tenant_id = v_tenant AND source_type = _source_type AND is_active = true LIMIT 1;
  IF v_rule.id IS NOT NULL THEN
    v_split_source := 'tenant_rule';
  ELSE
    SELECT * INTO v_rule FROM split_rules
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        AND source_type = _source_type AND is_active = true LIMIT 1;
    IF v_rule.id IS NOT NULL THEN v_split_source := 'global_default'; END IF;
  END IF;

  v_platform_pct  := COALESCE(v_rule.platform_pct, 10);
  v_organizer_pct := COALESCE(v_rule.organizer_pct, 0);
  v_arena_pct     := COALESCE(v_rule.arena_pct, 0);
  v_company_pct   := COALESCE(v_rule.company_pct, 0);
  v_affiliate_pct := COALESCE(v_rule.affiliate_pct, 0);

  IF _source_type = 'enrollment' AND v_override IS NOT NULL THEN
    v_platform_pct  := COALESCE((v_override->>'platform_pct')::numeric, v_platform_pct);
    v_organizer_pct := COALESCE((v_override->>'organizer_pct')::numeric, v_organizer_pct);
    v_arena_pct     := COALESCE((v_override->>'arena_pct')::numeric, v_arena_pct);
    v_split_source  := 'override';
  END IF;

  -- Resolve payment_accounts canônicas
  IF v_arena IS NOT NULL THEN
    SELECT id INTO v_arena_pay FROM payment_accounts WHERE arena_id = v_arena AND status='active' LIMIT 1;
  END IF;
  IF v_organizer IS NOT NULL THEN
    SELECT id INTO v_org_pay FROM payment_accounts
      WHERE tenant_id = v_tenant AND arena_id IS NULL AND status='active'
      ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_company_id IS NOT NULL THEN
    SELECT id INTO v_company_pay FROM payment_accounts
      WHERE tenant_id = v_tenant AND status='active'
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Atualiza metadata da transação com split_source
  UPDATE financial_transactions
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('split_source', v_split_source)
   WHERE id = v_tx_id;

  -- INSERT splits
  IF v_platform_pct > 0 THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount, status, expected_settlement_at, settlement_method)
    VALUES (v_tx_id, v_tenant, 'platform', NULL, v_platform_pct, ROUND(_total * v_platform_pct / 100, 2), 'calculated', v_expected, 'manual');
  END IF;
  IF v_organizer_pct > 0 AND v_organizer IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, payment_account_id, percentage, amount, status, expected_settlement_at, settlement_method)
    VALUES (v_tx_id, v_tenant, 'organizer', v_organizer, v_org_pay, v_organizer_pct, ROUND(_total * v_organizer_pct / 100, 2), 'calculated', v_expected, 'manual');
  END IF;
  IF v_arena_pct > 0 AND v_arena IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, payment_account_id, percentage, amount, status, expected_settlement_at, settlement_method)
    VALUES (v_tx_id, v_tenant, 'arena', v_arena, v_arena_pay, v_arena_pct, ROUND(_total * v_arena_pct / 100, 2), 'calculated', v_expected, 'manual');
  END IF;
  IF v_company_pct > 0 AND v_company_id IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, payment_account_id, percentage, amount, status, expected_settlement_at, settlement_method)
    VALUES (v_tx_id, v_tenant, 'company', v_company_id, v_company_pay, v_company_pct, ROUND(_total * v_company_pct / 100, 2), 'calculated', v_expected, 'manual');
  END IF;
  IF v_affiliate_pct > 0 THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount, status, expected_settlement_at, settlement_method)
    VALUES (v_tx_id, v_tenant, 'affiliate', NULL, v_affiliate_pct, ROUND(_total * v_affiliate_pct / 100, 2), 'calculated', v_expected, 'manual');
  END IF;

  IF v_arena IS NOT NULL THEN
    INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
    VALUES (v_tenant, v_arena, 'financial_transaction', v_tx_id, 'finance.split_calculated',
            jsonb_build_object('source_type', _source_type, 'total', _total, 'split_source', v_split_source), 'system');
    INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
    VALUES (v_tenant, v_arena, 'financial_transaction', v_tx_id, 'finance.payment_received',
            jsonb_build_object('source_type', _source_type, 'source_id', _source_id, 'total', _total), 'system');
  END IF;

  RETURN v_tx_id;
END $$;

-- 6. finance_mark_split_settled atualizado
CREATE OR REPLACE FUNCTION public.finance_mark_split_settled(
  _split_id uuid, _reference text DEFAULT NULL, _method text DEFAULT 'manual'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_split record;
BEGIN
  SELECT * INTO v_split FROM transaction_splits WHERE id = _split_id;
  IF v_split IS NULL THEN RAISE EXCEPTION 'split_not_found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR public.is_tenant_admin(v_split.tenant_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE transaction_splits
     SET status = 'settled',
         settled_at = now(),
         settlement_reference = COALESCE(_reference, settlement_reference),
         payout_reference = COALESCE(_reference, payout_reference),
         settlement_method = COALESCE(_method, settlement_method, 'manual')
   WHERE id = _split_id;

  -- Evento (apenas se houver arena_id na transação)
  INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
  SELECT ft.tenant_id, ft.arena_id, 'transaction_split', v_split.id, 'finance.split_settled',
         jsonb_build_object('split_id', v_split.id, 'amount', v_split.amount, 'method', _method, 'reference', _reference), 'system'
    FROM financial_transactions ft
   WHERE ft.id = v_split.transaction_id AND ft.arena_id IS NOT NULL;
END $$;

-- 7. finance_record_refund
CREATE OR REPLACE FUNCTION public.finance_record_refund(
  _transaction_id uuid, _amount numeric, _reason text, _external_ref text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_remaining numeric;
  v_adj_id uuid;
  v_adj_type text;
  v_full boolean;
  v_user uuid := auth.uid();
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_tx FROM financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx IS NULL THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  IF NOT (
    public.is_admin(v_user)
    OR public.is_tenant_admin(v_tx.tenant_id, v_user)
    OR (v_tx.arena_id IS NOT NULL AND public.is_arena_owner(v_tx.arena_id, v_user))
    OR (v_tx.organizer_id IS NOT NULL AND v_tx.organizer_id = v_user)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tx.status NOT IN ('paid','partially_refunded') THEN
    RAISE EXCEPTION 'invalid_status_for_refund';
  END IF;

  v_remaining := v_tx.total_amount - COALESCE(v_tx.refunded_amount, 0);
  IF _amount > v_remaining THEN RAISE EXCEPTION 'amount_exceeds_remaining'; END IF;

  v_full := (_amount = v_remaining);
  v_adj_type := CASE WHEN v_full AND COALESCE(v_tx.refunded_amount,0) = 0 THEN 'refund_full' ELSE 'refund_partial' END;

  INSERT INTO financial_adjustments (tenant_id, transaction_id, adjustment_type, amount, reason, external_reference, created_by, metadata)
  VALUES (v_tx.tenant_id, _transaction_id, v_adj_type, _amount, _reason, _external_ref, v_user,
          jsonb_build_object('previous_refunded', COALESCE(v_tx.refunded_amount, 0)))
  RETURNING id INTO v_adj_id;

  UPDATE financial_transactions
     SET refunded_amount = COALESCE(refunded_amount, 0) + _amount,
         refunded_at = now(),
         status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
         updated_at = now()
   WHERE id = _transaction_id;

  -- Reverte splits proporcionalmente
  IF v_full THEN
    UPDATE transaction_splits
       SET status = 'reversed', reversed_at = now(), reversal_reason = _reason
     WHERE transaction_id = _transaction_id AND status IN ('calculated','pending');
  END IF;

  -- Evento
  INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
  SELECT v_tx.tenant_id, v_tx.arena_id, 'financial_transaction', _transaction_id, 'finance.refund_created',
         jsonb_build_object('amount', _amount, 'full', v_full, 'reason', _reason, 'adjustment_id', v_adj_id), 'system'
   WHERE v_tx.arena_id IS NOT NULL;

  IF v_full THEN
    INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
    SELECT v_tx.tenant_id, v_tx.arena_id, 'financial_transaction', _transaction_id, 'finance.refund_completed',
           jsonb_build_object('total_refunded', v_tx.total_amount), 'system'
     WHERE v_tx.arena_id IS NOT NULL;
  END IF;

  RETURN v_adj_id;
END $$;

-- 8. finance_cancel_transaction
CREATE OR REPLACE FUNCTION public.finance_cancel_transaction(_transaction_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tx record; v_user uuid := auth.uid();
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT * INTO v_tx FROM financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx IS NULL THEN RAISE EXCEPTION 'transaction_not_found'; END IF;
  IF v_tx.status <> 'pending' THEN RAISE EXCEPTION 'only_pending_can_be_canceled'; END IF;
  IF NOT (
    public.is_admin(v_user)
    OR public.is_tenant_admin(v_tx.tenant_id, v_user)
    OR (v_tx.arena_id IS NOT NULL AND public.is_arena_owner(v_tx.arena_id, v_user))
    OR (v_tx.organizer_id IS NOT NULL AND v_tx.organizer_id = v_user)
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO financial_adjustments (tenant_id, transaction_id, adjustment_type, amount, reason, created_by)
  VALUES (v_tx.tenant_id, _transaction_id, 'cancellation', v_tx.total_amount, _reason, v_user);

  UPDATE financial_transactions SET status='canceled', cancellation_reason=_reason, updated_at=now() WHERE id=_transaction_id;
  UPDATE transaction_splits SET status='canceled' WHERE transaction_id=_transaction_id AND status IN ('calculated','pending');

  INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
  SELECT v_tx.tenant_id, v_tx.arena_id, 'financial_transaction', _transaction_id, 'finance.payment_canceled',
         jsonb_build_object('reason', _reason), 'system'
   WHERE v_tx.arena_id IS NOT NULL;
END $$;

-- 9. finance_apply_split_override
CREATE OR REPLACE FUNCTION public.finance_apply_split_override(
  _transaction_id uuid, _splits jsonb, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx record; v_user uuid := auth.uid(); v_adj_id uuid;
  v_split jsonb; v_total_pct numeric := 0;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF jsonb_typeof(_splits) <> 'array' THEN RAISE EXCEPTION 'splits_must_be_array'; END IF;

  SELECT * INTO v_tx FROM financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx IS NULL THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  IF NOT (public.is_admin(v_user) OR public.is_tenant_admin(v_tx.tenant_id, v_user)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Valida soma de %
  FOR v_split IN SELECT * FROM jsonb_array_elements(_splits) LOOP
    v_total_pct := v_total_pct + COALESCE((v_split->>'percentage')::numeric, 0);
  END LOOP;
  IF v_total_pct > 100.01 THEN RAISE EXCEPTION 'percentage_sum_exceeds_100'; END IF;

  INSERT INTO financial_adjustments (tenant_id, transaction_id, adjustment_type, amount, reason, created_by, metadata)
  VALUES (v_tx.tenant_id, _transaction_id, 'split_correction', 0, _reason, v_user,
          jsonb_build_object('new_splits', _splits))
  RETURNING id INTO v_adj_id;

  -- Reverte splits antigos
  UPDATE transaction_splits
     SET status='reversed', reversed_at=now(), reversal_reason='split_override: ' || _reason
   WHERE transaction_id=_transaction_id AND status IN ('calculated','pending');

  -- Cria novos
  FOR v_split IN SELECT * FROM jsonb_array_elements(_splits) LOOP
    INSERT INTO transaction_splits (
      transaction_id, tenant_id, recipient_type, recipient_id,
      percentage, amount, status, settlement_method, metadata
    ) VALUES (
      _transaction_id, v_tx.tenant_id,
      v_split->>'recipient_type',
      NULLIF(v_split->>'recipient_id','')::uuid,
      COALESCE((v_split->>'percentage')::numeric, 0),
      ROUND(v_tx.total_amount * COALESCE((v_split->>'percentage')::numeric, 0) / 100, 2),
      'calculated', 'manual',
      jsonb_build_object('override_adjustment_id', v_adj_id)
    );
  END LOOP;

  INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
  SELECT v_tx.tenant_id, v_tx.arena_id, 'financial_transaction', _transaction_id, 'finance.split_override_applied',
         jsonb_build_object('adjustment_id', v_adj_id, 'reason', _reason), 'system'
   WHERE v_tx.arena_id IS NOT NULL;

  RETURN v_adj_id;
END $$;

-- 10. View canônica de saldos do organizador
CREATE OR REPLACE VIEW public.v_organizer_balances_canonical
WITH (security_invoker = true)
AS
SELECT
  recipient_id AS organizer_id,
  tenant_id,
  SUM(CASE WHEN status='settled' THEN amount ELSE 0 END)::numeric(12,2) AS settled_total,
  SUM(CASE WHEN status='calculated' THEN amount ELSE 0 END)::numeric(12,2) AS pending_total,
  SUM(CASE WHEN status='reversed' THEN amount ELSE 0 END)::numeric(12,2) AS reversed_total,
  SUM(amount)::numeric(12,2) AS gross_total,
  COUNT(*) AS split_count
FROM public.transaction_splits
WHERE recipient_type = 'organizer'
  AND recipient_id IS NOT NULL
GROUP BY recipient_id, tenant_id;

GRANT SELECT ON public.v_organizer_balances_canonical TO authenticated;

-- 11. payment_accounts: arena_owner pode ler conta da própria arena
DROP POLICY IF EXISTS pa_arena_owner_select ON public.payment_accounts;
CREATE POLICY pa_arena_owner_select ON public.payment_accounts FOR SELECT
USING (
  arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid())
);

-- 12. COMMENTS de legacy
COMMENT ON COLUMN public.arenas.mp_collector_id IS 'DEPRECATED Phase 5.5 — use payment_accounts. Kept for compat only.';
COMMENT ON COLUMN public.profiles.mp_collector_id IS 'DEPRECATED Phase 5.5 — use payment_accounts. Kept for compat only.';
COMMENT ON TABLE public.financial_ledger IS 'DEPRECATED Phase 5.5 — superseded by financial_transactions/transaction_splits.';
COMMENT ON TABLE public.organizer_balances IS 'DEPRECATED Phase 5.5 — use v_organizer_balances_canonical (derived from transaction_splits).';