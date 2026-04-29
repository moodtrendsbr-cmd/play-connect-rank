
-- M-1: Extend ad_campaigns for unified monetization
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS boost_level int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_days int;

-- Validation trigger: kind ↔ target_type consistency (no CHECK to keep it flexible)
CREATE OR REPLACE FUNCTION public.trg_ad_campaigns_validate_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'tournament_boost' AND COALESCE(NEW.target_type,'tournament') <> 'tournament' THEN
    RAISE EXCEPTION 'tournament_boost requires target_type=tournament';
  ELSIF NEW.kind = 'company_boost' AND COALESCE(NEW.target_type,'company') <> 'company' THEN
    RAISE EXCEPTION 'company_boost requires target_type=company';
  ELSIF NEW.kind = 'product_boost' AND COALESCE(NEW.target_type,'product') <> 'product' THEN
    RAISE EXCEPTION 'product_boost requires target_type=product';
  END IF;
  IF NEW.boost_level NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'boost_level must be between 1 and 3';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ad_campaigns_validate_kind ON public.ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_validate_kind
  BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.trg_ad_campaigns_validate_kind();

-- Boost pricing
CREATE TABLE IF NOT EXISTS public.boost_pricing (
  boost_level int PRIMARY KEY,
  duration_days int NOT NULL,
  price_brl numeric NOT NULL,
  display_name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.boost_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boost_pricing public read" ON public.boost_pricing;
CREATE POLICY "boost_pricing public read" ON public.boost_pricing FOR SELECT USING (active = true);

INSERT INTO public.boost_pricing (boost_level, duration_days, price_brl, display_name, description) VALUES
  (1, 3,  19,  'Boost Básico',   'Aparece com prioridade no feed por 3 dias'),
  (2, 7,  49,  'Boost Premium',  'Topo do feed + recomendações por 7 dias'),
  (3, 15, 129, 'Boost Spotlight','Máxima prioridade + frequência por 15 dias')
ON CONFLICT (boost_level) DO NOTHING;

-- M-4: purchase_boost RPC (creates pending ad_campaign)
CREATE OR REPLACE FUNCTION public.purchase_boost(
  _kind text,
  _target_type text,
  _target_id uuid,
  _boost_level int,
  _company_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _price numeric;
  _days int;
  _campaign_id uuid;
  _tenant uuid;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;

  IF _kind NOT IN ('tournament_boost','company_boost','product_boost') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_kind');
  END IF;

  SELECT price_brl, duration_days INTO _price, _days
    FROM public.boost_pricing
   WHERE boost_level = _boost_level AND active = true;

  IF _price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_boost_level');
  END IF;

  -- Resolve tenant from company if provided
  IF _company_id IS NOT NULL THEN
    SELECT tenant_id INTO _tenant FROM public.companies WHERE id = _company_id;
  END IF;
  _tenant := COALESCE(_tenant, '00000000-0000-0000-0000-000000000001'::uuid);

  INSERT INTO public.ad_campaigns
    (tenant_id, company_id, name, kind, target_type, target_id,
     boost_level, duration_days, status, priority,
     starts_at, ends_at, budget)
  VALUES
    (_tenant, _company_id,
     _kind || ':' || _target_id::text,
     _kind, _target_type, _target_id,
     _boost_level, _days, 'pending', _boost_level * 10,
     now(), now() + make_interval(days => _days), _price)
  RETURNING id INTO _campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', _campaign_id,
    'price_brl', _price,
    'duration_days', _days
  );
END $$;

GRANT EXECUTE ON FUNCTION public.purchase_boost(text, text, uuid, int, uuid) TO authenticated;

-- M-5: activation trigger on paid
CREATE OR REPLACE FUNCTION public.trg_boost_activate_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _days int;
BEGIN
  IF NEW.source_type = 'boost'
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN

    SELECT duration_days INTO _days FROM public.ad_campaigns WHERE id = NEW.source_id;

    IF _days IS NOT NULL THEN
      UPDATE public.ad_campaigns
         SET status = 'active',
             starts_at = now(),
             ends_at = now() + make_interval(days => _days),
             updated_at = now()
       WHERE id = NEW.source_id AND status = 'pending';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_boost_activate_on_paid ON public.financial_transactions;
CREATE TRIGGER trg_boost_activate_on_paid
  AFTER INSERT OR UPDATE OF status ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_boost_activate_on_paid();

-- M-2: feed_unified_v — ranks promotional items only (organic stays in posts)
CREATE OR REPLACE VIEW public.feed_unified_v
WITH (security_invoker = on) AS
-- Boosted entities via ad_campaigns
SELECT
  c.id::text                          AS item_key,
  c.kind                              AS item_type,
  c.target_id                         AS item_id,
  c.created_at                        AS occurred_at,
  'boost'::text                       AS type,
  c.id                                AS campaign_id,
  c.company_id                        AS company_id,
  c.target_type                       AS target_type,
  c.target_id                         AS target_id,
  (50 + c.boost_level * 15)::int      AS priority_score,
  jsonb_build_object(
    'title', c.title,
    'image_url', c.image_url,
    'link', c.link,
    'cta_label', c.cta_label,
    'boost_level', c.boost_level
  )                                   AS payload
FROM public.ad_campaigns c
WHERE c.status = 'active'
  AND c.kind IN ('tournament_boost','company_boost','product_boost')
  AND now() BETWEEN c.starts_at AND c.ends_at

UNION ALL

-- Sponsored posts (legacy table, still useful)
SELECT
  sp.id::text                         AS item_key,
  'sponsored_post'::text              AS item_type,
  sp.id                               AS item_id,
  sp.created_at                       AS occurred_at,
  'sponsored'::text                   AS type,
  NULL::uuid                          AS campaign_id,
  sp.company_id                       AS company_id,
  'company'::text                     AS target_type,
  sp.company_id                       AS target_id,
  40::int                             AS priority_score,
  jsonb_build_object(
    'title', sp.title,
    'content', sp.content,
    'image_url', sp.image_url
  )                                   AS payload
FROM public.sponsored_posts sp
WHERE sp.active = true
  AND now() BETWEEN COALESCE(sp.active_from, now() - interval '1 day')
                AND COALESCE(sp.active_to, now() + interval '30 days');

-- M-6: boost_performance_v — campaign metrics
CREATE OR REPLACE VIEW public.boost_performance_v
WITH (security_invoker = on) AS
SELECT
  c.id              AS campaign_id,
  c.kind,
  c.target_type,
  c.target_id,
  c.company_id,
  c.tenant_id,
  c.boost_level,
  c.status,
  c.starts_at,
  c.ends_at,
  c.budget,
  COALESCE(SUM(CASE WHEN e.event_type = 'impression' THEN 1 ELSE 0 END), 0)::int AS impressions,
  COALESCE(SUM(CASE WHEN e.event_type = 'click'      THEN 1 ELSE 0 END), 0)::int AS clicks
FROM public.ad_campaigns c
LEFT JOIN public.ad_events e ON e.campaign_id = c.id
WHERE c.kind IN ('tournament_boost','company_boost','product_boost')
GROUP BY c.id;

-- M-8: anti-spam guard
CREATE OR REPLACE FUNCTION public.feed_should_inject_promo(_user_id uuid, _last_n int DEFAULT 50)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _impressions int;
BEGIN
  IF _user_id IS NULL THEN
    RETURN true;
  END IF;
  SELECT COUNT(*) INTO _impressions
    FROM public.ad_events
   WHERE viewer_id = _user_id
     AND event_type = 'impression'
     AND occurred_at > now() - interval '1 hour';
  -- Cap at 10 promos/hour per user (~20% of typical 50-item session)
  RETURN _impressions < 10;
END $$;

GRANT EXECUTE ON FUNCTION public.feed_should_inject_promo(uuid, int) TO authenticated, anon;

-- ORKYM trigger types (no schema change needed if types are text; just document)
COMMENT ON TABLE public.ad_campaigns IS
  'Unified monetization campaigns. kind ∈ {feed_highlight, tournament_highlight, arena_highlight, marketplace_highlight, tournament_boost, company_boost, product_boost}. Boost kinds use boost_level (1-3) and are activated by trg_boost_activate_on_paid when financial_transactions.source_type=boost paid.';
