ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_type_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'enrollment'::text,
    'booking'::text,
    'marketplace_order'::text,
    'arena_billing_cycle'::text,
    'sponsorship'::text,
    'boost'::text
  ]));

CREATE OR REPLACE FUNCTION public.trg_boost_activate_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _days int;
BEGIN
  IF NEW.source_type = 'boost'
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN

    SELECT duration_days INTO _days
      FROM public.ad_campaigns WHERE id = NEW.source_id;

    IF _days IS NOT NULL THEN
      UPDATE public.ad_campaigns
         SET status = 'active',
             starts_at = now(),
             ends_at = now() + make_interval(days => _days),
             updated_at = now()
       WHERE id = NEW.source_id AND status = 'pending';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS "fin_tx_boost_owner_read" ON public.financial_transactions;
CREATE POLICY "fin_tx_boost_owner_read" ON public.financial_transactions
  FOR SELECT
  USING (
    source_type = 'boost'
    AND EXISTS (
      SELECT 1 FROM public.ad_campaigns c
       WHERE c.id = financial_transactions.source_id
         AND (
           c.company_id IN (
             SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
           )
           OR public.is_admin(auth.uid())
         )
    )
  );