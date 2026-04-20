-- =====================================================
-- FASE 2.5 — PUBLIC DATA AUDIT + TENANT PRIVACY HARDENING
-- =====================================================

-- ============ 1. PUBLIC VIEWS ============

-- profiles_public
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  user_id, full_name, avatar_url, bio, city, state, team, arena, titles,
  social_instagram, social_tiktok, social_x, social_youtube, social_facebook, social_linkedin,
  link, gender, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- arenas_public
CREATE OR REPLACE VIEW public.arenas_public
WITH (security_invoker = on) AS
SELECT
  id, name, slug, city, state, cover_image_url, description, rules,
  is_active, tenant_id, created_at
FROM public.arenas
WHERE is_active = true;

GRANT SELECT ON public.arenas_public TO anon, authenticated;

-- companies_public
CREATE OR REPLACE VIEW public.companies_public
WITH (security_invoker = on) AS
SELECT
  id, name, logo_url, description, category, city, state,
  plan, status, tenant_id, created_at
FROM public.companies
WHERE status = 'approved';

GRANT SELECT ON public.companies_public TO anon, authenticated;

-- tenant_settings_public
CREATE OR REPLACE VIEW public.tenant_settings_public
WITH (security_invoker = on) AS
SELECT
  tenant_id, display_name, logo_url, favicon_url,
  primary_color, secondary_color, default_locale, timezone
FROM public.tenant_settings;

GRANT SELECT ON public.tenant_settings_public TO anon, authenticated;

-- ============ 2. RESTRICT BASE TABLES ============

-- profiles: substitui SELECT aberto
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;

CREATE POLICY "Owner view full profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- arenas: remove SELECT público (mantém owner/admin/tenant_admin existentes)
DROP POLICY IF EXISTS "Public view active arenas" ON public.arenas;

-- companies: remove SELECT público
DROP POLICY IF EXISTS "Public view approved companies" ON public.companies;

-- tenant_settings: remove SELECT público
DROP POLICY IF EXISTS "Public read tenant_settings" ON public.tenant_settings;

-- tenant_domains: remove SELECT público
DROP POLICY IF EXISTS "Public read domains" ON public.tenant_domains;
DROP POLICY IF EXISTS "Public read tenant_domains" ON public.tenant_domains;

-- ============ 3. RPC: resolve_tenant_by_host ============

CREATE OR REPLACE FUNCTION public.resolve_tenant_by_host(_host text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_domains
  WHERE domain = lower(_host)
    AND verification_status = 'verified'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(text) TO anon, authenticated;

-- ============ 4. SECURITY AUDIT LOG ============

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tenant_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view audit log"
  ON public.security_audit_log FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Tenant admin view tenant audit"
  ON public.security_audit_log FOR SELECT
  USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));

-- Nenhum INSERT direto — só via trigger SECURITY DEFINER
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON public.security_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.security_audit_log(resource_type, resource_id);

-- Trigger function genérica
CREATE OR REPLACE FUNCTION public.log_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_tenant uuid;
  v_resource uuid;
BEGIN
  IF TG_TABLE_NAME = 'tenant_memberships' THEN
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_resource := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'payment_accounts' THEN
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_resource := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'tenant_domains' THEN
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_resource := COALESCE(NEW.id, OLD.id);
  END IF;

  INSERT INTO public.security_audit_log(user_id, tenant_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(),
    v_tenant,
    v_action,
    TG_TABLE_NAME,
    v_resource,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_tenant_memberships ON public.tenant_memberships;
CREATE TRIGGER audit_tenant_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_security_event();

DROP TRIGGER IF EXISTS audit_payment_accounts ON public.payment_accounts;
CREATE TRIGGER audit_payment_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_security_event();

DROP TRIGGER IF EXISTS audit_tenant_domains ON public.tenant_domains;
CREATE TRIGGER audit_tenant_domains
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.log_security_event();

-- ============ 5. SPONSORED POSTS / GIVEAWAYS — confirmar segurança ============

-- sponsored_posts: público apenas se ativo no período
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sponsored_posts' AND policyname='Public view sponsored posts') THEN
    DROP POLICY "Public view sponsored posts" ON public.sponsored_posts;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='sponsored_posts' AND schemaname='public') THEN
    EXECUTE 'CREATE POLICY "Public view active sponsored posts" ON public.sponsored_posts FOR SELECT USING (active = true AND now() BETWEEN active_from AND active_to)';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ 6. STORAGE: anti-list em buckets públicos ============
-- Política existente "Public read" geralmente permite LIST. Mantemos leitura por path direto
-- mas removemos qualquer policy que permita SELECT geral sem filtro.
-- Como as URLs públicas do Supabase passam pelo render endpoint, leitura direta continua OK.
-- Não modificamos storage.objects aqui para não quebrar uploads existentes — fica para Fase 3.