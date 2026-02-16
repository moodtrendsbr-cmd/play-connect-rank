
-- Tournament Sponsor Plans (admin-defined packages)
CREATE TABLE public.tournament_sponsor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  max_tournaments integer DEFAULT 1,
  feed_visibility boolean DEFAULT false,
  signup_visibility boolean DEFAULT false,
  tournament_visibility boolean DEFAULT true,
  physical_banner_allowed boolean DEFAULT false,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_sponsor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view sponsor plans" ON public.tournament_sponsor_plans FOR SELECT USING (true);
CREATE POLICY "Admin insert sponsor plans" ON public.tournament_sponsor_plans FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin update sponsor plans" ON public.tournament_sponsor_plans FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete sponsor plans" ON public.tournament_sponsor_plans FOR DELETE USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_tournament_sponsor_plans_updated_at
  BEFORE UPDATE ON public.tournament_sponsor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tournament Sponsorships (each sponsorship record)
CREATE TABLE public.tournament_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.tournament_sponsor_plans(id),
  logo_url text,
  link text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view active sponsorships" ON public.tournament_sponsorships FOR SELECT USING (true);
CREATE POLICY "Company owner insert sponsorship" ON public.tournament_sponsorships FOR INSERT WITH CHECK (public.is_company_owner(company_id, auth.uid()));
CREATE POLICY "Company owner update own sponsorship" ON public.tournament_sponsorships FOR UPDATE USING (public.is_company_owner(company_id, auth.uid()));
CREATE POLICY "Admin update sponsorships" ON public.tournament_sponsorships FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete sponsorships" ON public.tournament_sponsorships FOR DELETE USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_tournament_sponsorships_updated_at
  BEFORE UPDATE ON public.tournament_sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default plans
INSERT INTO public.tournament_sponsor_plans (name, display_name, price, max_tournaments, feed_visibility, signup_visibility, tournament_visibility, physical_banner_allowed, description) VALUES
('basic', 'Basic', 99, 1, false, false, true, false, 'Logo na página do torneio'),
('pro', 'Pro', 249, 3, false, true, true, false, 'Logo na página do torneio + tela de inscrição/pagamento'),
('elite', 'Elite', 499, 5, true, true, true, true, 'Visibilidade completa: torneio, inscrição, feed local e direito a banner físico');
