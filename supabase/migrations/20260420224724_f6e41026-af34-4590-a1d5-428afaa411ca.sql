
-- 1. Extend tournament_modalities
ALTER TABLE public.tournament_modalities
  ADD COLUMN IF NOT EXISTS team_size smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'groups_then_ko';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tournament_modalities_phase_chk') THEN
    ALTER TABLE public.tournament_modalities
      ADD CONSTRAINT tournament_modalities_phase_chk
      CHECK (phase IN ('groups_only','ko_only','groups_then_ko'));
  END IF;
END $$;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS modality_id uuid;

ALTER TABLE public.modality_matches
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS arena_id uuid;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS default_split_config jsonb;

-- New tables
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid,
  organizer_id uuid,
  source_type text NOT NULL CHECK (source_type IN ('enrollment','booking','marketplace_order','arena_billing_cycle','sponsorship')),
  source_id uuid NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','canceled')),
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_tenant ON public.financial_transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_arena ON public.financial_transactions (arena_id, created_at DESC) WHERE arena_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_tx_organizer ON public.financial_transactions (organizer_id, created_at DESC) WHERE organizer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_tx_status ON public.financial_transactions (status);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_tx_admin_all" ON public.financial_transactions;
CREATE POLICY "fin_tx_admin_all" ON public.financial_transactions
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fin_tx_tenant_admin_select" ON public.financial_transactions;
CREATE POLICY "fin_tx_tenant_admin_select" ON public.financial_transactions
  FOR SELECT USING (public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "fin_tx_arena_owner_select" ON public.financial_transactions;
CREATE POLICY "fin_tx_arena_owner_select" ON public.financial_transactions
  FOR SELECT USING (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()));

DROP POLICY IF EXISTS "fin_tx_organizer_select" ON public.financial_transactions;
CREATE POLICY "fin_tx_organizer_select" ON public.financial_transactions
  FOR SELECT USING (organizer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('platform','organizer','arena','company','affiliate')),
  recipient_id uuid,
  payment_account_id uuid,
  percentage numeric(5,2) NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','failed')),
  settled_at timestamptz,
  settlement_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_splits_tx ON public.transaction_splits (transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_recipient ON public.transaction_splits (recipient_type, recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_splits_tenant ON public.transaction_splits (tenant_id, created_at DESC);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "splits_admin_all" ON public.transaction_splits;
CREATE POLICY "splits_admin_all" ON public.transaction_splits
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "splits_tenant_admin_select" ON public.transaction_splits;
CREATE POLICY "splits_tenant_admin_select" ON public.transaction_splits
  FOR SELECT USING (public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "splits_recipient_select" ON public.transaction_splits;
CREATE POLICY "splits_recipient_select" ON public.transaction_splits
  FOR SELECT USING (
    (recipient_type = 'organizer' AND recipient_id = auth.uid())
    OR (recipient_type = 'arena' AND recipient_id IS NOT NULL AND public.is_arena_owner(recipient_id, auth.uid()))
    OR (recipient_type = 'company' AND recipient_id IS NOT NULL AND public.is_company_owner(recipient_id, auth.uid()))
  );

CREATE TABLE IF NOT EXISTS public.split_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('enrollment','booking','marketplace_order','arena_billing_cycle','sponsorship')),
  platform_pct numeric(5,2) NOT NULL DEFAULT 10,
  organizer_pct numeric(5,2) NOT NULL DEFAULT 0,
  arena_pct numeric(5,2) NOT NULL DEFAULT 0,
  company_pct numeric(5,2) NOT NULL DEFAULT 0,
  affiliate_pct numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type)
);

ALTER TABLE public.split_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_rules_admin_all" ON public.split_rules;
CREATE POLICY "split_rules_admin_all" ON public.split_rules
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "split_rules_tenant_admin_all" ON public.split_rules;
CREATE POLICY "split_rules_tenant_admin_all" ON public.split_rules
  FOR ALL USING (public.is_tenant_admin(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_fin_tx_updated_at ON public.financial_transactions;
CREATE TRIGGER trg_fin_tx_updated_at BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_split_rules_updated_at ON public.split_rules;
CREATE TRIGGER trg_split_rules_updated_at BEFORE UPDATE ON public.split_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Core RPC
CREATE OR REPLACE FUNCTION public.finance_record_payment(
  _source_type text,
  _source_id uuid,
  _total numeric,
  _provider text DEFAULT NULL,
  _reference text DEFAULT NULL,
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
  v_tx_id uuid;
  v_rule record;
  v_override jsonb;
  v_platform_pct numeric(5,2);
  v_organizer_pct numeric(5,2);
  v_arena_pct numeric(5,2);
  v_company_pct numeric(5,2);
  v_affiliate_pct numeric(5,2);
  v_company_id uuid;
  v_arena_pay uuid;
BEGIN
  IF _source_type = 'enrollment' THEN
    SELECT t.tenant_id, t.organizer_id, t.default_split_config
      INTO v_tenant, v_organizer, v_override
      FROM enrollments e
      JOIN tournaments t ON t.id = e.tournament_id
     WHERE e.id = _source_id;
  ELSIF _source_type = 'booking' THEN
    SELECT b.tenant_id, b.arena_id
      INTO v_tenant, v_arena
      FROM bookings b
     WHERE b.id = _source_id;
  ELSIF _source_type = 'marketplace_order' THEN
    SELECT mo.tenant_id, p.company_id
      INTO v_tenant, v_company_id
      FROM marketplace_orders mo
      JOIN products p ON p.id = mo.product_id
     WHERE mo.id = _source_id;
  ELSIF _source_type = 'arena_billing_cycle' THEN
    SELECT bc.tenant_id, bc.arena_id
      INTO v_tenant, v_arena
      FROM arena_billing_cycles bc
     WHERE bc.id = _source_id;
  ELSIF _source_type = 'sponsorship' THEN
    SELECT ts.tenant_id, ts.company_id, t.organizer_id
      INTO v_tenant, v_company_id, v_organizer
      FROM tournament_sponsorships ts
      LEFT JOIN tournaments t ON t.id = ts.tournament_id
     WHERE ts.id = _source_id;
  END IF;

  IF v_tenant IS NULL THEN
    v_tenant := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO financial_transactions (
    tenant_id, arena_id, organizer_id, source_type, source_id,
    total_amount, status, payment_provider, payment_reference, paid_at
  ) VALUES (
    v_tenant, v_arena, v_organizer, _source_type, _source_id,
    _total, 'paid', _provider, _reference, _paid_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET status = 'paid',
        total_amount = EXCLUDED.total_amount,
        payment_provider = COALESCE(EXCLUDED.payment_provider, financial_transactions.payment_provider),
        payment_reference = COALESCE(EXCLUDED.payment_reference, financial_transactions.payment_reference),
        paid_at = COALESCE(EXCLUDED.paid_at, financial_transactions.paid_at),
        updated_at = now()
  RETURNING id INTO v_tx_id;

  IF EXISTS (SELECT 1 FROM transaction_splits WHERE transaction_id = v_tx_id) THEN
    IF v_arena IS NOT NULL THEN
      INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
      VALUES (v_tenant, v_arena, 'financial_transaction', v_tx_id, 'finance.payment_received',
              jsonb_build_object('source_type', _source_type, 'source_id', _source_id, 'total', _total), 'system');
    END IF;
    RETURN v_tx_id;
  END IF;

  SELECT * INTO v_rule FROM split_rules
   WHERE tenant_id = v_tenant AND source_type = _source_type AND is_active = true
   LIMIT 1;

  IF v_rule IS NULL THEN
    SELECT * INTO v_rule FROM split_rules
     WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
       AND source_type = _source_type AND is_active = true
     LIMIT 1;
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
  END IF;

  IF v_arena IS NOT NULL THEN
    SELECT id INTO v_arena_pay FROM payment_accounts WHERE arena_id = v_arena AND status='active' LIMIT 1;
  END IF;

  IF v_platform_pct > 0 THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount)
    VALUES (v_tx_id, v_tenant, 'platform', NULL, v_platform_pct, ROUND(_total * v_platform_pct / 100, 2));
  END IF;

  IF v_organizer_pct > 0 AND v_organizer IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount)
    VALUES (v_tx_id, v_tenant, 'organizer', v_organizer, v_organizer_pct, ROUND(_total * v_organizer_pct / 100, 2));
  END IF;

  IF v_arena_pct > 0 AND v_arena IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, payment_account_id, percentage, amount)
    VALUES (v_tx_id, v_tenant, 'arena', v_arena, v_arena_pay, v_arena_pct, ROUND(_total * v_arena_pct / 100, 2));
  END IF;

  IF v_company_pct > 0 AND v_company_id IS NOT NULL THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount)
    VALUES (v_tx_id, v_tenant, 'company', v_company_id, v_company_pct, ROUND(_total * v_company_pct / 100, 2));
  END IF;

  IF v_affiliate_pct > 0 THEN
    INSERT INTO transaction_splits (transaction_id, tenant_id, recipient_type, recipient_id, percentage, amount)
    VALUES (v_tx_id, v_tenant, 'affiliate', NULL, v_affiliate_pct, ROUND(_total * v_affiliate_pct / 100, 2));
  END IF;

  IF v_arena IS NOT NULL THEN
    INSERT INTO arena_operational_events (tenant_id, arena_id, entity_type, entity_id, event_type, payload, source)
    VALUES (v_tenant, v_arena, 'financial_transaction', v_tx_id, 'finance.payment_received',
            jsonb_build_object('source_type', _source_type, 'source_id', _source_id, 'total', _total),
            'system');
  END IF;

  RETURN v_tx_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_mark_split_settled(
  _split_id uuid,
  _reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_split record;
BEGIN
  SELECT * INTO v_split FROM transaction_splits WHERE id = _split_id;
  IF v_split IS NULL THEN RAISE EXCEPTION 'split_not_found'; END IF;

  IF NOT (public.is_admin(auth.uid()) OR public.is_tenant_admin(v_split.tenant_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE transaction_splits
     SET status = 'settled',
         settled_at = now(),
         settlement_reference = _reference
   WHERE id = _split_id;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION public.trg_enrollment_record_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric;
BEGIN
  IF NEW.status::text = 'paid' AND (OLD.status IS NULL OR OLD.status::text <> 'paid') THEN
    SELECT COALESCE(NEW.amount_paid, t.entry_fee, 0) INTO v_amount
      FROM tournaments t WHERE t.id = NEW.tournament_id;
    IF v_amount > 0 THEN
      PERFORM public.finance_record_payment('enrollment', NEW.id, v_amount, 'mercadopago', NEW.payment_id, now());
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enrollment_finance ON public.enrollments;
CREATE TRIGGER trg_enrollment_finance AFTER UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_enrollment_record_payment();

CREATE OR REPLACE FUNCTION public.trg_booking_record_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') AND NEW.amount > 0 THEN
    PERFORM public.finance_record_payment('booking', NEW.id, NEW.amount, NEW.payment_provider, NEW.payment_ref, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_booking_finance ON public.bookings;
CREATE TRIGGER trg_booking_finance AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_record_payment();

CREATE OR REPLACE FUNCTION public.trg_marketplace_record_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') AND NEW.total_amount > 0 THEN
    PERFORM public.finance_record_payment('marketplace_order', NEW.id, NEW.total_amount, NEW.payment_method, NEW.payment_id, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_marketplace_finance ON public.marketplace_orders;
CREATE TRIGGER trg_marketplace_finance AFTER UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_record_payment();

CREATE OR REPLACE FUNCTION public.trg_billing_cycle_record_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') AND NEW.amount > 0 THEN
    PERFORM public.finance_record_payment('arena_billing_cycle', NEW.id, NEW.amount, NEW.payment_method, NEW.payment_reference, COALESCE(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_billing_cycle_finance ON public.arena_billing_cycles;
CREATE TRIGGER trg_billing_cycle_finance AFTER UPDATE ON public.arena_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.trg_billing_cycle_record_payment();

-- Seed default split rules
INSERT INTO public.split_rules (tenant_id, source_type, platform_pct, organizer_pct, arena_pct, company_pct)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'enrollment',          10, 90, 0, 0),
  ('00000000-0000-0000-0000-000000000001', 'booking',             10, 0, 90, 0),
  ('00000000-0000-0000-0000-000000000001', 'arena_billing_cycle', 10, 0, 90, 0),
  ('00000000-0000-0000-0000-000000000001', 'marketplace_order',   10, 0, 0, 90),
  ('00000000-0000-0000-0000-000000000001', 'sponsorship',         10, 90, 0, 0)
ON CONFLICT (tenant_id, source_type) DO NOTHING;

COMMENT ON TABLE public.financial_ledger IS 'LEGACY (Fase 5): substituido por financial_transactions + transaction_splits.';
COMMENT ON TABLE public.financial_transactions IS 'Toda receita rastreavel por fonte. Idempotente por (source_type, source_id).';
COMMENT ON TABLE public.transaction_splits IS 'Distribuicao da receita: platform / organizer / arena / company / affiliate.';
COMMENT ON TABLE public.split_rules IS 'Configuracao de % por tenant + source_type. Tenant default fornece fallback global.';
