
-- Phase H — Control Tower AI synthesis RPC
-- Read-only, SECURITY INVOKER, reuses existing tables/views.

CREATE OR REPLACE FUNCTION public.control_tower_summary(
  _scope_type text,
  _scope_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_arena_id uuid;
  v_company_id uuid;
  v_organizer_id uuid;

  v_enrollment_score numeric;
  v_revenue_score numeric;
  v_occupancy_score numeric;
  v_engagement_score numeric;
  v_adoption_score numeric;

  v_total_w numeric := 0;
  v_total_s numeric := 0;
  v_health int;

  v_rev_now numeric := 0;
  v_rev_prev numeric := 0;

  v_alerts jsonb := '[]'::jsonb;
  v_opps jsonb := '[]'::jsonb;
  v_recs jsonb := '[]'::jsonb;
  v_nba jsonb := NULL;

  v_sub jsonb := '{}'::jsonb;
BEGIN
  -- Normalise scope
  IF _scope_type = 'tenant' THEN v_tenant_id := _scope_id;
  ELSIF _scope_type = 'arena' THEN
    v_arena_id := _scope_id;
    SELECT tenant_id INTO v_tenant_id FROM public.arenas WHERE id = _scope_id;
  ELSIF _scope_type = 'company' THEN
    v_company_id := _scope_id;
    SELECT tenant_id INTO v_tenant_id FROM public.companies WHERE id = _scope_id;
  ELSIF _scope_type = 'organizer' THEN
    v_organizer_id := _scope_id;
  ELSIF _scope_type = 'admin' THEN
    -- global, no scope filter
    NULL;
  ELSE
    RETURN jsonb_build_object('error', 'invalid_scope');
  END IF;

  -- ============================================================
  -- 1. ENROLLMENT SCORE — paid vs capacity, upcoming/active tournaments
  -- ============================================================
  WITH t AS (
    SELECT t.id, t.max_slots
    FROM public.tournaments t
    WHERE t.end_date >= CURRENT_DATE
      AND (v_tenant_id IS NULL OR t.tenant_id = v_tenant_id)
      AND (v_arena_id IS NULL OR t.arena_id = v_arena_id)
      AND (v_organizer_id IS NULL OR t.organizer_id = v_organizer_id)
      AND (_scope_type <> 'company')
  ), e AS (
    SELECT t.id,
           COALESCE(t.max_slots, 0) AS cap,
           (SELECT count(*) FROM public.enrollments en
              WHERE en.tournament_id = t.id AND en.status = 'paid') AS paid_n
    FROM t
  )
  SELECT
    CASE WHEN sum(cap) > 0
         THEN least(100, round((sum(paid_n)::numeric / sum(cap)::numeric) * 100))
         ELSE NULL END
  INTO v_enrollment_score
  FROM e WHERE cap > 0;

  -- ============================================================
  -- 2. REVENUE SCORE — last 7d vs previous 7d, capped 0..100 (50=stable)
  -- ============================================================
  SELECT
    COALESCE(sum(CASE WHEN paid_at >= now() - interval '7 days' THEN total_amount END), 0),
    COALESCE(sum(CASE WHEN paid_at < now() - interval '7 days' AND paid_at >= now() - interval '14 days' THEN total_amount END), 0)
  INTO v_rev_now, v_rev_prev
  FROM public.financial_transactions
  WHERE status IN ('paid','partially_refunded')
    AND paid_at IS NOT NULL
    AND paid_at >= now() - interval '14 days'
    AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
    AND (v_arena_id IS NULL OR arena_id = v_arena_id)
    AND (v_organizer_id IS NULL OR organizer_id = v_organizer_id);

  IF v_rev_prev = 0 AND v_rev_now = 0 THEN
    v_revenue_score := NULL;
  ELSIF v_rev_prev = 0 THEN
    v_revenue_score := 80; -- new revenue stream
  ELSE
    v_revenue_score := least(100, greatest(0, round(50 * (v_rev_now / v_rev_prev))));
  END IF;

  -- ============================================================
  -- 3. OCCUPANCY SCORE — bookings vs available slots last 14d (arena/tenant only)
  -- ============================================================
  IF _scope_type IN ('admin','tenant','arena') THEN
    WITH paid_b AS (
      SELECT count(*) AS n
      FROM public.bookings b
      WHERE b.created_at >= now() - interval '14 days'
        AND b.status IN ('paid','confirmed','completed')
        AND (v_tenant_id IS NULL OR b.tenant_id = v_tenant_id)
        AND (v_arena_id IS NULL OR b.arena_id = v_arena_id)
    ), cap AS (
      SELECT count(*) * 14 AS n
      FROM public.court_availability ca
      WHERE (v_tenant_id IS NULL OR ca.tenant_id = v_tenant_id)
    )
    SELECT CASE WHEN cap.n > 0
                THEN least(100, round((paid_b.n::numeric / cap.n::numeric) * 100))
                ELSE NULL END
    INTO v_occupancy_score
    FROM paid_b, cap;
  END IF;

  -- ============================================================
  -- 4. ENGAGEMENT SCORE — distinct active profiles 7d / 30d
  -- ============================================================
  IF _scope_type IN ('admin','tenant','arena') THEN
    WITH x AS (
      SELECT user_id, created_at
      FROM public.xp_events
      WHERE created_at >= now() - interval '30 days'
        AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
        AND (v_arena_id IS NULL OR arena_id = v_arena_id)
    )
    SELECT CASE WHEN count(distinct user_id) > 0
                THEN round(100 * count(distinct user_id) FILTER (WHERE created_at >= now() - interval '7 days')::numeric
                                / count(distinct user_id)::numeric)
                ELSE NULL END
    INTO v_engagement_score FROM x;
  END IF;

  -- ============================================================
  -- 5. ORKYM ADOPTION SCORE — (auto + approved) / suggested 30d
  -- ============================================================
  WITH p AS (
    SELECT status, auto_executed
    FROM public.orkym_action_proposals
    WHERE created_at >= now() - interval '30 days'
      AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
      AND (v_arena_id IS NULL OR arena_id = v_arena_id)
  )
  SELECT CASE WHEN count(*) > 0
              THEN round(100 * count(*) FILTER (WHERE status IN ('approved','executing','executed') OR auto_executed)::numeric
                              / count(*)::numeric)
              ELSE NULL END
  INTO v_adoption_score FROM p;

  -- ============================================================
  -- HEALTH SCORE — weighted avg of available sub-scores
  -- ============================================================
  IF v_enrollment_score IS NOT NULL THEN v_total_s := v_total_s + v_enrollment_score * 0.25; v_total_w := v_total_w + 0.25; END IF;
  IF v_revenue_score    IS NOT NULL THEN v_total_s := v_total_s + v_revenue_score    * 0.25; v_total_w := v_total_w + 0.25; END IF;
  IF v_occupancy_score  IS NOT NULL THEN v_total_s := v_total_s + v_occupancy_score  * 0.20; v_total_w := v_total_w + 0.20; END IF;
  IF v_engagement_score IS NOT NULL THEN v_total_s := v_total_s + v_engagement_score * 0.15; v_total_w := v_total_w + 0.15; END IF;
  IF v_adoption_score   IS NOT NULL THEN v_total_s := v_total_s + v_adoption_score   * 0.15; v_total_w := v_total_w + 0.15; END IF;

  IF v_total_w > 0 THEN
    v_health := round(v_total_s / v_total_w);
  ELSE
    v_health := NULL;
  END IF;

  v_sub := jsonb_build_object(
    'enrollment', v_enrollment_score,
    'revenue', v_revenue_score,
    'occupancy', v_occupancy_score,
    'engagement', v_engagement_score,
    'orkym_adoption', v_adoption_score
  );

  -- ============================================================
  -- ALERTS
  -- ============================================================
  -- Low-enrollment tournaments (from triggers queue, dedup already enforced)
  v_alerts := v_alerts || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'severity', 'warning',
      'kind', 'low_enrollment_tournament',
      'title', 'Inscrições abaixo do esperado',
      'body', COALESCE(q.payload->>'tournament_name', 'Torneio') || ' precisa de impulso',
      'entity_type', q.entity_type,
      'entity_id', q.entity_id
    ))
    FROM public.orkym_triggers_queue q
    WHERE q.trigger_type = 'tournament_low_enrollment'
      AND q.status IN ('pending','queued','processing')
      AND (v_tenant_id IS NULL OR q.tenant_id = v_tenant_id)
      AND (v_arena_id IS NULL OR q.arena_id = v_arena_id)
    LIMIT 5
  ), '[]'::jsonb);

  -- Revenue drop
  IF v_rev_prev > 0 AND v_rev_now > 0 AND (v_rev_now / v_rev_prev) < 0.7 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'severity','warning',
      'kind','revenue_drop',
      'title','Queda de receita nos últimos 7 dias',
      'body','Receita caiu ' || round((1 - v_rev_now/v_rev_prev)*100) || '% vs semana anterior'
    ));
  END IF;

  -- Budget exhausted
  v_alerts := v_alerts || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'severity','critical',
      'kind','budget_exhausted',
      'title','Orçamento de growth quase esgotado',
      'body','Escopo ' || gb.scope_type || ' usou ' ||
             round((gb.spent_brl / NULLIF(gb.budget_brl,0)) * 100) || '%'
    ))
    FROM public.growth_budgets gb
    WHERE gb.active = true
      AND gb.budget_brl > 0
      AND (gb.spent_brl / gb.budget_brl) >= 0.9
      AND (
        (_scope_type = 'admin') OR
        (_scope_type = 'tenant' AND gb.scope_id = v_tenant_id) OR
        (_scope_type = 'arena' AND gb.scope_id = v_arena_id) OR
        (_scope_type = 'company' AND gb.scope_id = v_company_id)
      )
    LIMIT 3
  ), '[]'::jsonb);

  -- ============================================================
  -- OPPORTUNITIES — pending growth triggers
  -- ============================================================
  v_opps := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'kind', q.trigger_type,
      'title', CASE q.trigger_type
        WHEN 'tournament_low_enrollment' THEN 'Torneio com vagas — impulsionar'
        WHEN 'inactive_athlete' THEN 'Atleta inativo há 30+ dias'
        WHEN 'near_rank_up' THEN 'Atleta perto de subir de nível'
        WHEN 'idle_court_slot' THEN 'Horário ocioso na agenda'
        ELSE q.trigger_type
      END,
      'impact', CASE WHEN q.priority = 'high' THEN 'high'
                     WHEN q.priority = 'medium' THEN 'medium'
                     ELSE 'low' END,
      'entity_type', q.entity_type,
      'entity_id', q.entity_id,
      'payload', q.payload
    ))
    FROM (
      SELECT *
      FROM public.orkym_triggers_queue
      WHERE status IN ('pending','queued')
        AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
        AND (v_arena_id IS NULL OR arena_id = v_arena_id)
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               created_at DESC
      LIMIT 5
    ) q
  ), '[]'::jsonb);

  -- ============================================================
  -- RECOMMENDATIONS — derived from triggers + alerts, mapped to allowlist
  -- ============================================================
  v_recs := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'title', CASE q.trigger_type
        WHEN 'tournament_low_enrollment' THEN 'Impulsionar torneio'
        WHEN 'inactive_athlete' THEN 'Reativar atleta'
        WHEN 'near_rank_up' THEN 'Mensagem motivacional'
        WHEN 'idle_court_slot' THEN 'Preencher horário ocioso'
        ELSE 'Ação ORKYM'
      END,
      'body', COALESCE(q.payload->>'reason', 'Recomendado pelo motor de growth'),
      'action_type', CASE q.trigger_type
        WHEN 'tournament_low_enrollment' THEN 'tournament_boost'
        WHEN 'inactive_athlete' THEN 'reactivation_message'
        WHEN 'near_rank_up' THEN 'send_proactive_message'
        WHEN 'idle_court_slot' THEN 'fill_idle_slots'
        ELSE 'send_proactive_message'
      END,
      'trigger_id', q.id,
      'entity_type', q.entity_type,
      'entity_id', q.entity_id,
      'impact', CASE WHEN q.priority = 'high' THEN 3 WHEN q.priority = 'medium' THEN 2 ELSE 1 END,
      'effort', CASE q.trigger_type
        WHEN 'tournament_low_enrollment' THEN 2
        WHEN 'idle_court_slot' THEN 2
        ELSE 1 END
    ))
    FROM (
      SELECT *
      FROM public.orkym_triggers_queue
      WHERE status IN ('pending','queued')
        AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
        AND (v_arena_id IS NULL OR arena_id = v_arena_id)
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               created_at DESC
      LIMIT 5
    ) q
  ), '[]'::jsonb);

  -- Next Best Action: max(impact - effort)
  SELECT to_jsonb(r) INTO v_nba
  FROM (
    SELECT *
    FROM jsonb_array_elements(v_recs) AS x(rec),
         LATERAL (SELECT
           rec AS r,
           (rec->>'impact')::int - (rec->>'effort')::int AS score
         ) s
    ORDER BY score DESC NULLS LAST
    LIMIT 1
  ) sub;

  IF v_nba IS NOT NULL THEN
    v_nba := v_nba->'r';
  END IF;

  RETURN jsonb_build_object(
    'scope_type', _scope_type,
    'scope_id', _scope_id,
    'health_score', v_health,
    'sub_scores', v_sub,
    'alerts', v_alerts,
    'opportunities', v_opps,
    'recommendations', v_recs,
    'next_best_action', v_nba,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.control_tower_summary(text, uuid) TO authenticated;
