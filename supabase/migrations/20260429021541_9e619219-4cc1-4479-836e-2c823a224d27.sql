
-- Wrap KPI helpers with scope authorization and revoke from anon
REVOKE ALL ON FUNCTION public.orkym_revenue_kpis_arena(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_revenue_kpis_tenant(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_revenue_kpis_company(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_revenue_kpis_admin(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_message_performance(text, uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_roi_multiplier(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.orkym_revenue_kpis_arena(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orkym_revenue_kpis_tenant(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orkym_revenue_kpis_company(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orkym_revenue_kpis_admin(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orkym_message_performance(text, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orkym_roi_multiplier(uuid, text) TO service_role;

-- Add scope authorization wrappers via STRICT internal checks
CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_arena(_arena_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_arena_owner(_arena_id, auth.uid())
          OR EXISTS (SELECT 1 FROM arenas a WHERE a.id = _arena_id AND a.tenant_id IS NOT NULL AND is_tenant_admin(a.tenant_id, auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE arena_id = _arena_id AND status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND created_at BETWEEN _from AND _to), 0),
    'bookings_total', COALESCE((SELECT COUNT(*) FROM bookings WHERE arena_id = _arena_id AND created_at BETWEEN _from AND _to), 0),
    'bookings_via_wa', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND entity_type='booking' AND created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE arena_id = _arena_id AND direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE arena_id = _arena_id AND attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0)
  );
END $$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_tenant(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_tenant_admin(_tenant_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE tenant_id = _tenant_id AND status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE tenant_id = _tenant_id AND direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE tenant_id = _tenant_id AND attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0),
    'arenas', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT a.id AS arena_id, a.name,
               COALESCE(SUM(r.revenue_amount), 0) AS revenue_orkym,
               COUNT(r.id) AS conversions
          FROM arenas a
          LEFT JOIN orkym_revenue_attribution r
            ON r.arena_id = a.id AND r.created_at BETWEEN _from AND _to
         WHERE a.tenant_id = _tenant_id
         GROUP BY a.id, a.name
         ORDER BY revenue_orkym DESC
         LIMIT 20
      ) t), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_company(_company_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM companies c WHERE c.id = _company_id AND c.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (
    WITH product_orders AS (
      SELECT mo.* FROM marketplace_orders mo
      JOIN products p ON p.id = mo.product_id
      WHERE p.company_id = _company_id
        AND mo.created_at BETWEEN _from AND _to
    )
    SELECT jsonb_build_object(
      'orders_total', (SELECT COUNT(*) FROM product_orders),
      'revenue_total', COALESCE((SELECT SUM(total_amount) FROM product_orders WHERE status='paid'), 0),
      'orders_via_wa', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution r
                                  JOIN product_orders po ON po.id = r.entity_id
                                  WHERE r.entity_type='marketplace_order'), 0),
      'revenue_orkym', COALESCE((SELECT SUM(r.revenue_amount) FROM orkym_revenue_attribution r
                                  JOIN product_orders po ON po.id = r.entity_id
                                  WHERE r.entity_type='marketplace_order'), 0)
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.orkym_revenue_kpis_admin(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(total_amount) FROM financial_transactions WHERE status='paid' AND paid_at BETWEEN _from AND _to), 0),
    'revenue_orkym', COALESCE((SELECT SUM(revenue_amount) FROM orkym_revenue_attribution WHERE created_at BETWEEN _from AND _to), 0),
    'messages_sent', COALESCE((SELECT COUNT(*) FROM whatsapp_messages WHERE direction='outbound' AND initiated_by='orkym' AND created_at BETWEEN _from AND _to), 0),
    'conversions', COALESCE((SELECT COUNT(*) FROM orkym_revenue_attribution WHERE attribution_type='proactive' AND created_at BETWEEN _from AND _to), 0)
  );
END $$;

CREATE OR REPLACE FUNCTION public.orkym_message_performance(_scope_type text, _scope_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (trigger_type text, sent bigint, delivered bigint, responded bigint, converted bigint, revenue numeric, conversion_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _scope_type = 'admin' THEN
    IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF _scope_type = 'tenant' THEN
    IF NOT (is_admin(auth.uid()) OR is_tenant_admin(_scope_id, auth.uid())) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF _scope_type = 'arena' THEN
    IF NOT (is_admin(auth.uid()) OR is_arena_owner(_scope_id, auth.uid())) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSE
    RAISE EXCEPTION 'invalid_scope';
  END IF;

  RETURN QUERY
  WITH triggers AS (
    SELECT q.id, q.trigger_type
      FROM orkym_triggers_queue q
     WHERE q.created_at BETWEEN _from AND _to
       AND ((_scope_type='tenant' AND q.tenant_id=_scope_id)
         OR (_scope_type='arena' AND q.arena_id=_scope_id)
         OR (_scope_type='admin'))
  ),
  agg AS (
    SELECT t.trigger_type,
           COUNT(*) FILTER (WHERE f.event='message_sent') AS sent,
           COUNT(*) FILTER (WHERE f.event='delivered') AS delivered,
           COUNT(*) FILTER (WHERE f.event='responded') AS responded,
           COUNT(*) FILTER (WHERE f.event='converted') AS converted
      FROM triggers t LEFT JOIN orkym_trigger_feedback f ON f.trigger_id = t.id
     GROUP BY t.trigger_type
  ),
  rev AS (
    SELECT q.trigger_type, COALESCE(SUM(r.revenue_amount),0) AS revenue
      FROM triggers q LEFT JOIN orkym_revenue_attribution r ON r.trigger_id = q.id
     GROUP BY q.trigger_type
  )
  SELECT a.trigger_type, a.sent, a.delivered, a.responded, a.converted,
         COALESCE(rev.revenue,0),
         CASE WHEN a.sent>0 THEN ROUND((a.converted::numeric/a.sent::numeric),4) ELSE 0 END
    FROM agg a LEFT JOIN rev ON rev.trigger_type = a.trigger_type
   ORDER BY a.sent DESC;
END $$;
