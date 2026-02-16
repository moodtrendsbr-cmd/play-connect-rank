
-- Helper function to check if user owns the company linked to a sponsorship
CREATE OR REPLACE FUNCTION public.is_sponsorship_company_owner(_sponsorship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_sponsorships ts
    JOIN public.companies c ON c.id = ts.company_id
    WHERE ts.id = _sponsorship_id AND c.owner_user_id = _user_id
  )
$$;

-- Create sponsorship_giveaways table
CREATE TABLE public.sponsorship_giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsorship_id uuid NOT NULL REFERENCES public.tournament_sponsorships(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  rules text,
  needs_refrigeration boolean DEFAULT false,
  delivery_deadline date,
  contact_name text,
  contact_whatsapp text,
  contact_email text,
  pickup_address text,
  delivery_address text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsorship_giveaways ENABLE ROW LEVEL SECURITY;

-- RLS: Owner of the company can SELECT
CREATE POLICY "Owner view giveaways"
ON public.sponsorship_giveaways FOR SELECT
USING (is_sponsorship_company_owner(sponsorship_id, auth.uid()) OR is_admin(auth.uid()));

-- RLS: Owner can INSERT
CREATE POLICY "Owner insert giveaways"
ON public.sponsorship_giveaways FOR INSERT
WITH CHECK (is_sponsorship_company_owner(sponsorship_id, auth.uid()));

-- RLS: Owner or admin can UPDATE
CREATE POLICY "Owner or admin update giveaways"
ON public.sponsorship_giveaways FOR UPDATE
USING (is_sponsorship_company_owner(sponsorship_id, auth.uid()) OR is_admin(auth.uid()));

-- RLS: Admin can DELETE
CREATE POLICY "Admin delete giveaways"
ON public.sponsorship_giveaways FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sponsorship_giveaways_updated_at
BEFORE UPDATE ON public.sponsorship_giveaways
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add tracking columns to tournament_sponsorships
ALTER TABLE public.tournament_sponsorships
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count integer NOT NULL DEFAULT 0;
