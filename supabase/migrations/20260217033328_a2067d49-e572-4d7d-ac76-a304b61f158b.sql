
-- ========================================
-- MÓDULO DE ARENAS - Tabelas + RLS + Funções
-- ========================================

-- 1. Tabela arenas
CREATE TABLE public.arenas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  address text,
  zip_code text,
  description text,
  rules text,
  cover_image_url text,
  contact_email text,
  contact_whatsapp text,
  mp_connected boolean NOT NULL DEFAULT false,
  mp_collector_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;

-- 2. Tabela courts
CREATE TABLE public.courts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Quadra A',
  is_active boolean NOT NULL DEFAULT true,
  price_per_hour numeric,
  modalities text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- 3. Tabela court_availability
CREATE TABLE public.court_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes integer NOT NULL DEFAULT 60,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.court_availability ENABLE ROW LEVEL SECURITY;

-- 4. Tabela court_blocks
CREATE TABLE public.court_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.court_blocks ENABLE ROW LEVEL SECURITY;

-- 5. Tabela bookings
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_id uuid NOT NULL REFERENCES public.arenas(id),
  court_id uuid NOT NULL REFERENCES public.courts(id),
  user_id uuid,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment',
  payment_provider text,
  payment_ref text,
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_whatsapp text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6. Tabela arena_links
CREATE TABLE public.arena_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  icon_type text NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  position_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_links ENABLE ROW LEVEL SECURITY;

-- 7. Tabela arena_partners
CREATE TABLE public.arena_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  logo_url text,
  link_url text,
  tier text NOT NULL DEFAULT 'basic',
  physical_space_included boolean NOT NULL DEFAULT false,
  position_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_partners ENABLE ROW LEVEL SECURITY;

-- 8. Tabela arena_physical_inventory
CREATE TABLE public.arena_physical_inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  space_type text NOT NULL DEFAULT 'banner',
  description text,
  price_monthly numeric,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_physical_inventory ENABLE ROW LEVEL SECURITY;

-- ========================================
-- FUNÇÃO AUXILIAR: is_arena_owner
-- ========================================
CREATE OR REPLACE FUNCTION public.is_arena_owner(_arena_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.arenas WHERE id = _arena_id AND owner_user_id = _user_id
  )
$$;

-- Função para obter arena_id pelo court_id
CREATE OR REPLACE FUNCTION public.get_arena_id_from_court(_court_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT arena_id FROM public.courts WHERE id = _court_id LIMIT 1
$$;

-- ========================================
-- RLS POLICIES: arenas
-- ========================================
CREATE POLICY "Public view active arenas" ON public.arenas FOR SELECT USING (is_active = true);
CREATE POLICY "Owner view own arena" ON public.arenas FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Owner insert arena" ON public.arenas FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owner update own arena" ON public.arenas FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Admin view all arenas" ON public.arenas FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admin update arenas" ON public.arenas FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admin delete arenas" ON public.arenas FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: courts
-- ========================================
CREATE POLICY "Public view courts" ON public.courts FOR SELECT USING (true);
CREATE POLICY "Owner insert courts" ON public.courts FOR INSERT WITH CHECK (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner update courts" ON public.courts FOR UPDATE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner delete courts" ON public.courts FOR DELETE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Admin manage courts" ON public.courts FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: court_availability
-- ========================================
CREATE POLICY "Public view availability" ON public.court_availability FOR SELECT USING (true);
CREATE POLICY "Owner insert availability" ON public.court_availability FOR INSERT WITH CHECK (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Owner update availability" ON public.court_availability FOR UPDATE USING (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Owner delete availability" ON public.court_availability FOR DELETE USING (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Admin manage availability" ON public.court_availability FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: court_blocks
-- ========================================
CREATE POLICY "Public view blocks" ON public.court_blocks FOR SELECT USING (true);
CREATE POLICY "Owner insert blocks" ON public.court_blocks FOR INSERT WITH CHECK (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Owner update blocks" ON public.court_blocks FOR UPDATE USING (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Owner delete blocks" ON public.court_blocks FOR DELETE USING (is_arena_owner(get_arena_id_from_court(court_id), auth.uid()));
CREATE POLICY "Admin manage blocks" ON public.court_blocks FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: bookings
-- ========================================
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Arena owner view bookings" ON public.bookings FOR SELECT USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Arena owner update bookings" ON public.bookings FOR UPDATE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Admin manage bookings" ON public.bookings FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: arena_links
-- ========================================
CREATE POLICY "Public view active links" ON public.arena_links FOR SELECT USING (is_active = true);
CREATE POLICY "Owner insert links" ON public.arena_links FOR INSERT WITH CHECK (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner update links" ON public.arena_links FOR UPDATE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner delete links" ON public.arena_links FOR DELETE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Admin manage links" ON public.arena_links FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: arena_partners
-- ========================================
CREATE POLICY "Public view active partners" ON public.arena_partners FOR SELECT USING (is_active = true);
CREATE POLICY "Owner insert partners" ON public.arena_partners FOR INSERT WITH CHECK (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner update partners" ON public.arena_partners FOR UPDATE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner delete partners" ON public.arena_partners FOR DELETE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Admin manage partners" ON public.arena_partners FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- RLS POLICIES: arena_physical_inventory
-- ========================================
CREATE POLICY "Public view inventory" ON public.arena_physical_inventory FOR SELECT USING (true);
CREATE POLICY "Owner insert inventory" ON public.arena_physical_inventory FOR INSERT WITH CHECK (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner update inventory" ON public.arena_physical_inventory FOR UPDATE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Owner delete inventory" ON public.arena_physical_inventory FOR DELETE USING (is_arena_owner(arena_id, auth.uid()));
CREATE POLICY "Admin manage inventory" ON public.arena_physical_inventory FOR ALL USING (is_admin(auth.uid()));

-- ========================================
-- STORAGE BUCKET
-- ========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('arena-images', 'arena-images', true);

CREATE POLICY "Public view arena images" ON storage.objects FOR SELECT USING (bucket_id = 'arena-images');
CREATE POLICY "Auth users upload arena images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'arena-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users update own arena images" ON storage.objects FOR UPDATE USING (bucket_id = 'arena-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own arena images" ON storage.objects FOR DELETE USING (bucket_id = 'arena-images' AND auth.uid() IS NOT NULL);

-- ========================================
-- TRIGGER updated_at for arenas
-- ========================================
CREATE TRIGGER update_arenas_updated_at
BEFORE UPDATE ON public.arenas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
