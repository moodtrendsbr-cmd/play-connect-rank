
-- =============================================
-- 1. COMPANIES TABLE
-- =============================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  city text,
  state text,
  email text,
  phone text,
  category text,
  description text,
  logo_url text,
  status text NOT NULL DEFAULT 'pending_approval',
  plan text NOT NULL DEFAULT 'free',
  commission_rate numeric NOT NULL DEFAULT 10,
  highlight_enabled boolean NOT NULL DEFAULT false,
  feed_ads_enabled boolean NOT NULL DEFAULT false,
  tournament_visibility boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Helper function (after table exists)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = _company_id AND owner_user_id = _user_id
  )
$$;

-- Companies RLS
CREATE POLICY "Public view approved companies" ON public.companies
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Admin view all companies" ON public.companies
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner view own company" ON public.companies
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Auth users register company" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Admin update companies" ON public.companies
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner update own company" ON public.companies
  FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Admin delete companies" ON public.companies
  FOR DELETE USING (public.is_admin(auth.uid()));

-- =============================================
-- 2. PRODUCTS
-- =============================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  external_link text,
  stock integer,
  status text NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view approved products" ON public.products
  FOR SELECT USING (
    status = 'approved' AND EXISTS (
      SELECT 1 FROM public.companies WHERE id = company_id AND status = 'approved'
    )
  );
CREATE POLICY "Admin view all products" ON public.products
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner view own products" ON public.products
  FOR SELECT USING (public.is_company_owner(company_id, auth.uid()));
CREATE POLICY "Owner insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_company_owner(company_id, auth.uid()));
CREATE POLICY "Admin update products" ON public.products
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner update own products" ON public.products
  FOR UPDATE USING (public.is_company_owner(company_id, auth.uid()));
CREATE POLICY "Admin delete products" ON public.products
  FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner delete own products" ON public.products
  FOR DELETE USING (public.is_company_owner(company_id, auth.uid()));

-- =============================================
-- 3. SPONSORED POSTS
-- =============================================
CREATE TABLE public.sponsored_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  city text,
  active_from timestamptz NOT NULL,
  active_to timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsored_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view active sponsored posts" ON public.sponsored_posts
  FOR SELECT USING (active = true AND now() >= active_from AND now() <= active_to);
CREATE POLICY "Admin view all sponsored posts" ON public.sponsored_posts
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin insert sponsored posts" ON public.sponsored_posts
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin update sponsored posts" ON public.sponsored_posts
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete sponsored posts" ON public.sponsored_posts
  FOR DELETE USING (public.is_admin(auth.uid()));

-- =============================================
-- 4. TOURNAMENT PARTNERS
-- =============================================
CREATE TABLE public.tournament_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view tournament partners" ON public.tournament_partners
  FOR SELECT USING (true);
CREATE POLICY "Admin insert tournament partners" ON public.tournament_partners
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin update tournament partners" ON public.tournament_partners
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete tournament partners" ON public.tournament_partners
  FOR DELETE USING (public.is_admin(auth.uid()));

-- =============================================
-- 5. ATHLETE SPONSORS
-- =============================================
CREATE TABLE public.athlete_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view athlete sponsors" ON public.athlete_sponsors
  FOR SELECT USING (true);
CREATE POLICY "Admin insert athlete sponsors" ON public.athlete_sponsors
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin update athlete sponsors" ON public.athlete_sponsors
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete athlete sponsors" ON public.athlete_sponsors
  FOR DELETE USING (public.is_admin(auth.uid()));

-- =============================================
-- 6. MARKETPLACE ORDERS
-- =============================================
CREATE TABLE public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL,
  mood_commission numeric NOT NULL DEFAULT 0,
  company_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer view own orders" ON public.marketplace_orders
  FOR SELECT USING (auth.uid() = buyer_user_id);
CREATE POLICY "Admin view all orders" ON public.marketplace_orders
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Company owner view orders" ON public.marketplace_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = product_id AND c.owner_user_id = auth.uid()
    )
  );
CREATE POLICY "Auth users create orders" ON public.marketplace_orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_user_id);
CREATE POLICY "Admin update orders" ON public.marketplace_orders
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- =============================================
-- 7. STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('company-images', 'company-images', true);

CREATE POLICY "Anyone can view company images" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-images');
CREATE POLICY "Auth users upload company images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users update own company images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'company-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own company images" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-images' AND auth.uid() IS NOT NULL);
