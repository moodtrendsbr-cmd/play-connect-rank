
-- =====================
-- 1. company_plans table
-- =====================
CREATE TABLE public.company_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0,
  sponsored_posts_per_month integer NOT NULL DEFAULT 0,
  banner_feed_enabled boolean NOT NULL DEFAULT false,
  tournament_visibility boolean NOT NULL DEFAULT false,
  marketplace_highlight boolean NOT NULL DEFAULT false,
  commission_rate numeric NOT NULL DEFAULT 15,
  max_products integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view company plans" ON public.company_plans FOR SELECT USING (true);
CREATE POLICY "Admin insert company plans" ON public.company_plans FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin update company plans" ON public.company_plans FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admin delete company plans" ON public.company_plans FOR DELETE USING (is_admin(auth.uid()));

CREATE TRIGGER update_company_plans_updated_at
  BEFORE UPDATE ON public.company_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed plans
INSERT INTO public.company_plans (name, display_name, monthly_price, sponsored_posts_per_month, banner_feed_enabled, tournament_visibility, marketplace_highlight, commission_rate, max_products, description) VALUES
  ('free', 'Free', 0, 0, false, false, false, 15, 5, 'Entre na Mood Play gratuitamente. Até 5 produtos, visibilidade básica, comissão 15%.'),
  ('pro', 'Pro', 199, 1, false, true, false, 10, null, 'Apareça para atletas da sua cidade. Produtos ilimitados, destaque em torneios, 1 post patrocinado/mês, comissão 10%.'),
  ('elite', 'Elite', 499, 4, true, true, true, 8, null, 'Domine sua região esportiva. Posts patrocinados semanais, banner no feed, topo do marketplace, comissão 8%.');

-- =====================
-- 2. Alter companies table
-- =====================
ALTER TABLE public.companies ADD COLUMN plan_id uuid REFERENCES public.company_plans(id);
ALTER TABLE public.companies ADD COLUMN billing_status text NOT NULL DEFAULT 'none';

-- =====================
-- 3. subscriptions table
-- =====================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.company_plans(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  next_billing_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view all subscriptions" ON public.subscriptions FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Owner view own subscription" ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.companies WHERE id = subscriptions.company_id AND owner_user_id = auth.uid())
);
CREATE POLICY "Admin insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin update subscriptions" ON public.subscriptions FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admin delete subscriptions" ON public.subscriptions FOR DELETE USING (is_admin(auth.uid()));

-- =====================
-- 4. financial_ledger table
-- =====================
CREATE TABLE public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id uuid,
  company_id uuid REFERENCES public.companies(id),
  amount numeric NOT NULL,
  mood_share numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view financial ledger" ON public.financial_ledger FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admin insert financial ledger" ON public.financial_ledger FOR INSERT WITH CHECK (is_admin(auth.uid()));
