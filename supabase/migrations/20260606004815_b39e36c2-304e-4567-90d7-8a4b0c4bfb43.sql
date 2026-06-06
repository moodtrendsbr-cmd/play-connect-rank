
-- 1) Subscriptions: campos para recorrência real
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub_id
  ON public.subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 2) Withdrawal requests: execução real
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- 3) Idempotência: 1 financial_transaction por (provider, reference)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_tx_provider_ref
  ON public.financial_transactions(payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 4) Trigger despachador: bookings, subscriptions, withdrawals
CREATE OR REPLACE FUNCTION public.tg_apply_payment_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type = 'booking' AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.bookings
       SET status = 'confirmed',
           payment_provider = COALESCE(NEW.payment_provider, payment_provider),
           payment_ref = COALESCE(NEW.payment_reference, payment_ref)
     WHERE id = NEW.source_id
       AND status <> 'confirmed';
  END IF;

  IF NEW.source_type = 'booking' AND NEW.status IN ('refunded','cancelled','failed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.bookings
       SET status = 'canceled'
     WHERE id = NEW.source_id
       AND status <> 'canceled';
  END IF;

  IF NEW.source_type = 'subscription' AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.subscriptions
       SET status = 'active',
           current_period_end = COALESCE(NEW.paid_at, now()) + interval '1 month',
           next_billing_at = COALESCE(NEW.paid_at, now()) + interval '1 month'
     WHERE id = NEW.source_id;
  END IF;

  IF NEW.source_type = 'subscription' AND NEW.status IN ('failed','rejected')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.subscriptions
       SET status = 'overdue'
     WHERE id = NEW.source_id
       AND status NOT IN ('cancelled','canceled');
  END IF;

  IF NEW.source_type = 'withdrawal' AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.withdrawal_requests
       SET status = 'paid',
           executed_at = COALESCE(NEW.paid_at, now()),
           provider_payment_id = COALESCE(NEW.payment_reference, provider_payment_id)
     WHERE id = NEW.source_id;
  END IF;

  IF NEW.source_type = 'withdrawal' AND NEW.status IN ('failed','rejected','cancelled')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.withdrawal_requests
       SET status = 'failed',
           failure_reason = COALESCE(NEW.cancellation_reason, failure_reason)
     WHERE id = NEW.source_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_payment_side_effects ON public.financial_transactions;
CREATE TRIGGER trg_apply_payment_side_effects
  AFTER INSERT OR UPDATE OF status ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_payment_side_effects();
