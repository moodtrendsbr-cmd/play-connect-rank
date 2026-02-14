
-- 1. Add mp_collector_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mp_collector_id text;

-- 2. Create organizer_balances table
CREATE TABLE public.organizer_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  payment_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

ALTER TABLE public.organizer_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers view own balances"
ON public.organizer_balances FOR SELECT
USING (auth.uid() = organizer_id);

-- Service role inserts via edge functions, no user INSERT policy needed

-- 3. Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pix_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers view own withdrawals"
ON public.withdrawal_requests FOR SELECT
USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers create withdrawals"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (auth.uid() = organizer_id);
