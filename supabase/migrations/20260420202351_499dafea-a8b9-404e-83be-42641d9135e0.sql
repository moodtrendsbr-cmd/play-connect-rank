-- =====================================================================
-- FASE 1 — FOUNDATION MULTI-TENANT MOODPLAY
-- =====================================================================

-- 1. NEW TABLES
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  custom_domain text UNIQUE,
  owner_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$')
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','staff','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  arena_id uuid,
  provider text NOT NULL DEFAULT 'mercadopago',
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- 2. ADD tenant_id TO BUSINESS TABLES
ALTER TABLE public.arenas                     ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.tournaments                ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.enrollments                ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.bookings                   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.companies                  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.products                   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.marketplace_orders         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.tournament_modalities      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.modality_entries           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.modality_groups            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.modality_matches           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.modality_placements        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.modality_prizes            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.courts                     ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.court_availability         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.court_blocks               ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.arena_links                ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.arena_partners             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.arena_physical_inventory   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.posts                      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.clips                      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.financial_ledger           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.organizer_balances         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.subscriptions              ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.withdrawal_requests        ADD COLUMN IF NOT EXISTS tenant_id uuid;

DO $$ BEGIN
  ALTER TABLE public.arenas
    ADD CONSTRAINT arenas_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.tenant_id', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.set_current_tenant(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.tenant_id', COALESCE(_tenant_id::text, ''), false);
END; $$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = _tenant_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = _tenant_id AND user_id = _user_id AND role IN ('owner','admin'))
$$;

CREATE OR REPLACE FUNCTION public.expire_pending_enrollments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.enrollments
    SET status = 'cancelled'::enrollment_status, updated_at = now()
    WHERE status = 'pending'::enrollment_status
      AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING 1
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END; $$;

-- 4. BACKFILL
INSERT INTO public.tenants (id, name, slug, owner_user_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'MoodPlay Default', 'moodplay', NULL, true)
ON CONFLICT (id) DO NOTHING;

UPDATE public.arenas                   SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tournaments              SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.enrollments              SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.bookings                 SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.companies                SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.products                 SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.marketplace_orders       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tournament_modalities    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.modality_entries         SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.modality_groups          SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.modality_matches         SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.modality_placements      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.modality_prizes          SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.courts                   SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.court_availability       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.court_blocks             SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.arena_links              SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.arena_partners           SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.arena_physical_inventory SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.posts                    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.clips                    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.financial_ledger         SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.organizer_balances       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.subscriptions            SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.withdrawal_requests      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', user_id, 'admin'
FROM public.user_roles WHERE role = 'admin'::app_role
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', sub.uid, 'staff'
FROM (SELECT DISTINCT owner_user_id AS uid FROM public.arenas WHERE owner_user_id IS NOT NULL) sub
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', sub.uid, 'staff'
FROM (SELECT DISTINCT organizer_id AS uid FROM public.tournaments WHERE organizer_id IS NOT NULL) sub
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.payment_accounts (tenant_id, arena_id, provider, external_id, status)
SELECT tenant_id, id, 'mercadopago', mp_collector_id, 'active'
FROM public.arenas
WHERE mp_collector_id IS NOT NULL AND mp_collector_id <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_accounts (tenant_id, arena_id, provider, external_id, status)
SELECT '00000000-0000-0000-0000-000000000001', NULL, 'mercadopago', mp_collector_id, 'active'
FROM public.profiles
WHERE mp_collector_id IS NOT NULL AND mp_collector_id <> ''
ON CONFLICT DO NOTHING;

-- 5. RLS ON NEW TABLES
ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their tenants" ON public.tenants
  FOR SELECT USING (is_tenant_member(id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Public view active tenants" ON public.tenants
  FOR SELECT USING (is_active = true);
CREATE POLICY "Owner admin update tenant" ON public.tenants
  FOR UPDATE USING (is_tenant_admin(id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin insert tenant" ON public.tenants
  FOR INSERT WITH CHECK (is_admin(auth.uid()) OR auth.uid() = owner_user_id);
CREATE POLICY "Admin delete tenant" ON public.tenants
  FOR DELETE USING (is_admin(auth.uid()));

CREATE POLICY "Members view memberships" ON public.tenant_memberships
  FOR SELECT USING (user_id = auth.uid() OR is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin insert memberships" ON public.tenant_memberships
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin update memberships" ON public.tenant_memberships
  FOR UPDATE USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin delete memberships" ON public.tenant_memberships
  FOR DELETE USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Tenant admin view payment accounts" ON public.payment_accounts
  FOR SELECT USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin insert payment accounts" ON public.payment_accounts
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin update payment accounts" ON public.payment_accounts
  FOR UPDATE USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Tenant admin delete payment accounts" ON public.payment_accounts
  FOR DELETE USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Admin view webhook events" ON public.webhook_events
  FOR SELECT USING (is_admin(auth.uid()));

-- 6. ADDITIVE TENANT-AWARE POLICIES (coexist with legacy)
CREATE POLICY "tenant_member_view_arenas" ON public.arenas
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_update_arenas" ON public.arenas
  FOR UPDATE USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_member_view_tournaments" ON public.tournaments
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_update_tournaments" ON public.tournaments
  FOR UPDATE USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_view_enrollments" ON public.enrollments
  FOR SELECT TO authenticated USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_view_bookings" ON public.bookings
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_view_orders" ON public.marketplace_orders
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_view_ledger" ON public.financial_ledger
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "tenant_admin_view_balances" ON public.organizer_balances
  FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));

-- 7. ENROLLMENTS pending TTL
CREATE OR REPLACE FUNCTION public.set_enrollment_pending_ttl()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending'::enrollment_status AND NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '30 minutes';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enrollment_pending_ttl ON public.enrollments;
CREATE TRIGGER trg_enrollment_pending_ttl
BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_enrollment_pending_ttl();

-- 8. updated_at triggers
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_accounts_updated_at ON public.payment_accounts;
CREATE TRIGGER trg_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. INDEXES
CREATE INDEX IF NOT EXISTS idx_arenas_tenant             ON public.arenas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_tenant        ON public.tournaments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant        ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant           ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant          ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant           ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_tenant ON public.marketplace_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courts_tenant             ON public.courts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_posts_tenant              ON public.posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clips_tenant              ON public.clips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user   ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_tenant   ON public.payment_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_arena    ON public.payment_accounts(arena_id);

-- 10. DEPRECATION COMMENTS
COMMENT ON TABLE  public.match_results            IS 'DEPRECATED: use modality_matches';
COMMENT ON COLUMN public.arenas.mp_collector_id   IS 'DEPRECATED: use payment_accounts.external_id';
COMMENT ON COLUMN public.profiles.mp_collector_id IS 'DEPRECATED: use payment_accounts.external_id';