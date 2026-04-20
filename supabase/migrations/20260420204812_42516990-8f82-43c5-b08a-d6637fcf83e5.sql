-- ============================================================
-- PHASE 2 — Organizer White-Label + Security Hardening
-- ============================================================

-- ------------------------------------------------------------
-- 1. tenant_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  legal_name text,
  support_email text,
  support_phone text,
  primary_color text NOT NULL DEFAULT '#2BFF88',
  secondary_color text NOT NULL DEFAULT '#050708',
  logo_url text,
  favicon_url text,
  default_locale text NOT NULL DEFAULT 'pt-BR',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tenant_settings" ON public.tenant_settings;
CREATE POLICY "Public read tenant_settings" ON public.tenant_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant admin manage settings" ON public.tenant_settings;
CREATE POLICY "Tenant admin manage settings" ON public.tenant_settings
  FOR ALL
  USING (public.is_tenant_admin(tenant_id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()) OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_tenant_settings_updated_at ON public.tenant_settings;
CREATE TRIGGER trg_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill default tenant settings
INSERT INTO public.tenant_settings (tenant_id, display_name, primary_color, secondary_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'MoodPlay', '#2BFF88', '#050708')
ON CONFLICT (tenant_id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. tenant_domains
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'subdomain' CHECK (kind IN ('subdomain','custom')),
  is_primary boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed')),
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_one_primary
  ON public.tenant_domains(tenant_id) WHERE is_primary;

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tenant_domains" ON public.tenant_domains;
CREATE POLICY "Public read tenant_domains" ON public.tenant_domains
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant admin manage domains" ON public.tenant_domains;
CREATE POLICY "Tenant admin manage domains" ON public.tenant_domains
  FOR ALL
  USING (public.is_tenant_admin(tenant_id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()) OR public.is_admin(auth.uid()));

-- Backfill default domain
INSERT INTO public.tenant_domains (tenant_id, domain, kind, is_primary, verification_status, verified_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'play-connect-rank.lovable.app', 'subdomain', true, 'verified', now())
ON CONFLICT (domain) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Security hardening: court_blocks (close public read)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Public view blocks" ON public.court_blocks;

DROP POLICY IF EXISTS "Owner/admin view blocks" ON public.court_blocks;
CREATE POLICY "Owner/admin view blocks" ON public.court_blocks
  FOR SELECT USING (
    public.is_arena_owner(public.get_arena_id_from_court(court_id), auth.uid())
    OR public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  );

-- ------------------------------------------------------------
-- 4. Tenant-admin policies on operational tables
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_admin_delete_arenas" ON public.arenas;
CREATE POLICY "tenant_admin_delete_arenas" ON public.arenas
  FOR DELETE USING (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "tenant_admin_update_enrollments" ON public.enrollments;
CREATE POLICY "tenant_admin_update_enrollments" ON public.enrollments
  FOR UPDATE USING (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "tenant_admin_update_bookings" ON public.bookings;
CREATE POLICY "tenant_admin_update_bookings" ON public.bookings
  FOR UPDATE USING (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "tenant_admin_update_orders" ON public.marketplace_orders;
CREATE POLICY "tenant_admin_update_orders" ON public.marketplace_orders
  FOR UPDATE USING (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()));

-- ------------------------------------------------------------
-- 5. Auto-inherit tenant_id triggers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_from_user(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.tenant_memberships
       WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

-- Generic per-table triggers
CREATE OR REPLACE FUNCTION public.set_arena_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.set_tenant_from_user(NEW.owner_user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS arenas_set_tenant ON public.arenas;
CREATE TRIGGER arenas_set_tenant BEFORE INSERT ON public.arenas
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_tenant_default();

CREATE OR REPLACE FUNCTION public.set_tournament_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.set_tenant_from_user(NEW.organizer_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tournaments_set_tenant ON public.tournaments;
CREATE TRIGGER tournaments_set_tenant BEFORE INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.set_tournament_tenant_default();

CREATE OR REPLACE FUNCTION public.set_company_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.set_tenant_from_user(NEW.owner_user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS companies_set_tenant ON public.companies;
CREATE TRIGGER companies_set_tenant BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_company_tenant_default();

CREATE OR REPLACE FUNCTION public.set_post_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.set_tenant_from_user(NEW.author_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_set_tenant ON public.posts;
CREATE TRIGGER posts_set_tenant BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_tenant_default();

DROP TRIGGER IF EXISTS clips_set_tenant ON public.clips;
CREATE TRIGGER clips_set_tenant BEFORE INSERT ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.set_post_tenant_default();

CREATE OR REPLACE FUNCTION public.set_court_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.arenas WHERE id = NEW.arena_id LIMIT 1;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS courts_set_tenant ON public.courts;
CREATE TRIGGER courts_set_tenant BEFORE INSERT ON public.courts
  FOR EACH ROW EXECUTE FUNCTION public.set_court_tenant_default();

CREATE OR REPLACE FUNCTION public.set_booking_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.arenas WHERE id = NEW.arena_id LIMIT 1;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_set_tenant ON public.bookings;
CREATE TRIGGER bookings_set_tenant BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_tenant_default();

CREATE OR REPLACE FUNCTION public.set_enrollment_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.tournaments WHERE id = NEW.tournament_id LIMIT 1;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enrollments_set_tenant ON public.enrollments;
CREATE TRIGGER enrollments_set_tenant BEFORE INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_enrollment_tenant_default();

CREATE OR REPLACE FUNCTION public.set_order_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT c.tenant_id INTO NEW.tenant_id
      FROM public.products p JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = NEW.product_id LIMIT 1;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_set_tenant ON public.marketplace_orders;
CREATE TRIGGER orders_set_tenant BEFORE INSERT ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_tenant_default();

-- ------------------------------------------------------------
-- 6. Onboarding RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organizer_tenant(
  _name text, _slug text, _display_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  v_user uuid := auth.uid();
  v_slug text := lower(regexp_replace(_slug, '[^a-z0-9-]', '', 'g'));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF v_slug = '' OR length(v_slug) < 2 THEN RAISE EXCEPTION 'invalid slug'; END IF;
  IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'invalid name'; END IF;

  INSERT INTO public.tenants (name, slug, owner_user_id, is_active)
    VALUES (_name, v_slug, v_user, true) RETURNING id INTO v_tenant;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_tenant, v_user, 'owner')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.tenant_settings (tenant_id, display_name)
    VALUES (v_tenant, COALESCE(_display_name, _name));

  RETURN v_tenant;
END $$;

-- ------------------------------------------------------------
-- 7. payment_accounts UNIQUE + sync trigger
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS payment_accounts_provider_extid
  ON public.payment_accounts(provider, external_id);

CREATE OR REPLACE FUNCTION public.sync_arena_payment_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mp_collector_id IS NOT NULL AND NEW.mp_connected = true THEN
    INSERT INTO public.payment_accounts (tenant_id, arena_id, provider, external_id, status)
    VALUES (NEW.tenant_id, NEW.id, 'mercadopago', NEW.mp_collector_id, 'active')
    ON CONFLICT (provider, external_id) DO UPDATE
      SET status = 'active', updated_at = now(), arena_id = EXCLUDED.arena_id, tenant_id = EXCLUDED.tenant_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS arenas_sync_payment ON public.arenas;
CREATE TRIGGER arenas_sync_payment
  AFTER INSERT OR UPDATE OF mp_collector_id, mp_connected
  ON public.arenas FOR EACH ROW EXECUTE FUNCTION public.sync_arena_payment_account();