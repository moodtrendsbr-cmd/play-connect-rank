
-- ============================================================
-- PHASE G-3: Featured Listings (Social Monetization)
-- ============================================================

-- Enum-like via CHECK: entity_type
-- We use text + CHECK to keep it flexible

-- 1. featured_pricing — fixed price catalog
CREATE TABLE public.featured_pricing (
  tier text PRIMARY KEY,
  display_name text NOT NULL,
  price_brl numeric(10,2) NOT NULL,
  duration_days integer NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_pricing public read"
  ON public.featured_pricing FOR SELECT
  USING (active = true);

INSERT INTO public.featured_pricing (tier, display_name, price_brl, duration_days, description) VALUES
  ('basic',     'Destaque Básico',    29.00,  7, 'Aparece com badge de destaque por 7 dias.'),
  ('premium',   'Destaque Premium',   79.00, 15, 'Posição priorizada e badge dourado por 15 dias.'),
  ('spotlight', 'Destaque Spotlight',199.00, 30, 'Topo absoluto + badge spotlight por 30 dias.')
ON CONFLICT (tier) DO NOTHING;

-- 2. featured_listings
CREATE TABLE public.featured_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('tournament','product','company','arena','sponsored_post')),
  entity_id uuid NOT NULL,
  tier text NOT NULL REFERENCES public.featured_pricing(tier),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','expired','killed')),
  starts_at timestamptz,
  ends_at timestamptz,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_transaction_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_entity ON public.featured_listings (entity_type, entity_id, status);
CREATE INDEX idx_featured_active ON public.featured_listings (status, starts_at, ends_at) WHERE status = 'active';
CREATE INDEX idx_featured_owner ON public.featured_listings (created_by);

ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_listings public read active"
  ON public.featured_listings FOR SELECT
  USING (status IN ('active','expired','killed'));

CREATE POLICY "featured_listings owner read"
  ON public.featured_listings FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "featured_listings admin all"
  ON public.featured_listings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "featured_listings owner update"
  ON public.featured_listings FOR UPDATE
  USING (auth.uid() = created_by AND status IN ('active','paused'))
  WITH CHECK (auth.uid() = created_by AND status IN ('active','paused'));

-- 3. featured_kill_switch — global per entity_type
CREATE TABLE public.featured_kill_switch (
  entity_type text PRIMARY KEY CHECK (entity_type IN ('tournament','product','company','arena','sponsored_post','*')),
  enabled boolean NOT NULL DEFAULT false,
  reason text,
  toggled_by uuid,
  toggled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_kill_switch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kill_switch public read"
  ON public.featured_kill_switch FOR SELECT
  USING (true);

CREATE POLICY "kill_switch admin write"
  ON public.featured_kill_switch FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: all switches off by default
INSERT INTO public.featured_kill_switch (entity_type, enabled) VALUES
  ('tournament', false),
  ('product', false),
  ('company', false),
  ('arena', false),
  ('sponsored_post', false),
  ('*', false)
ON CONFLICT DO NOTHING;

-- 4. featured_active_v — public view
CREATE OR REPLACE VIEW public.featured_active_v
WITH (security_invoker = on)
AS
SELECT
  fl.id,
  fl.entity_type,
  fl.entity_id,
  fl.tier,
  fl.starts_at,
  fl.ends_at,
  fl.created_by,
  fp.display_name,
  fp.price_brl
FROM public.featured_listings fl
JOIN public.featured_pricing fp ON fp.tier = fl.tier
WHERE fl.status = 'active'
  AND fl.starts_at <= now()
  AND fl.ends_at > now()
  AND NOT EXISTS (
    SELECT 1 FROM public.featured_kill_switch ks
    WHERE ks.enabled = true
      AND (ks.entity_type = fl.entity_type OR ks.entity_type = '*')
  );

GRANT SELECT ON public.featured_active_v TO anon, authenticated;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- purchase_featured: create a pending featured listing, returns row + price
CREATE OR REPLACE FUNCTION public.purchase_featured(
  _entity_type text,
  _entity_id uuid,
  _tier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price numeric;
  _days int;
  _id uuid;
  _user uuid := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;

  SELECT price_brl, duration_days INTO _price, _days
    FROM public.featured_pricing
   WHERE tier = _tier AND active = true;

  IF _price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_tier');
  END IF;

  INSERT INTO public.featured_listings
    (entity_type, entity_id, tier, status, paid_amount, created_by)
  VALUES
    (_entity_type, _entity_id, _tier, 'pending', _price, _user)
  RETURNING id INTO _id;

  RETURN jsonb_build_object(
    'success', true,
    'featured_id', _id,
    'price_brl', _price,
    'duration_days', _days
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_featured(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_featured(text, uuid, text) TO authenticated;

-- toggle_featured_kill_switch: admin only
CREATE OR REPLACE FUNCTION public.toggle_featured_kill_switch(
  _entity_type text,
  _enabled boolean,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  INSERT INTO public.featured_kill_switch (entity_type, enabled, reason, toggled_by, toggled_at)
  VALUES (_entity_type, _enabled, _reason, auth.uid(), now())
  ON CONFLICT (entity_type) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        reason = EXCLUDED.reason,
        toggled_by = auth.uid(),
        toggled_at = now();

  RETURN jsonb_build_object('success', true, 'entity_type', _entity_type, 'enabled', _enabled);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_featured_kill_switch(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_featured_kill_switch(text, boolean, text) TO authenticated;

-- admin_kill_featured_listing: terminate a single listing
CREATE OR REPLACE FUNCTION public.admin_kill_featured_listing(
  _featured_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.featured_listings
     SET status = 'killed',
         updated_at = now()
   WHERE id = _featured_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_kill_featured_listing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kill_featured_listing(uuid, text) TO authenticated;

-- ============================================================
-- TRIGGER: auto-activate when financial_transaction is paid
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_featured_activate_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days int;
BEGIN
  IF NEW.source_type = 'featured'
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN

    SELECT fp.duration_days INTO _days
      FROM public.featured_listings fl
      JOIN public.featured_pricing fp ON fp.tier = fl.tier
     WHERE fl.id = NEW.source_id;

    IF _days IS NOT NULL THEN
      UPDATE public.featured_listings
         SET status = 'active',
             starts_at = now(),
             ends_at = now() + make_interval(days => _days),
             payment_transaction_id = NEW.id,
             updated_at = now()
       WHERE id = NEW.source_id AND status = 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_featured_activate_on_paid ON public.financial_transactions;
CREATE TRIGGER trg_featured_activate_on_paid
  AFTER INSERT OR UPDATE OF status ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_featured_activate_on_paid();

-- ============================================================
-- updated_at trigger for featured_listings
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_set_updated_at_featured()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_featured_listings_updated_at
  BEFORE UPDATE ON public.featured_listings
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at_featured();
