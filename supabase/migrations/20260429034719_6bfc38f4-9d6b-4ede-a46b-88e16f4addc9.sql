ALTER TABLE public.transaction_splits DROP CONSTRAINT IF EXISTS transaction_splits_status_check;
ALTER TABLE public.transaction_splits ADD CONSTRAINT transaction_splits_status_check
  CHECK (status = ANY (ARRAY['calculated'::text, 'pending'::text, 'processing'::text, 'settled'::text, 'failed'::text, 'reversed'::text]));