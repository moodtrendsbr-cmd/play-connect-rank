-- Targeted fix: replace t.status with t.state in tournament-related blocks.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.growth_generate_opportunity_triggers'::regproc) INTO v_def;
  -- We just re-create with the same body but s/t.status IN/t.state IN/g for tournaments.
END $$;

CREATE OR REPLACE FUNCTION public.growth_generate_opportunity_triggers()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_count int := 0; r record;
BEGIN
  -- 1
  BEGIN
    FOR r IN
      SELECT t.id, t.tenant_id, t.organizer_id, t.name AS tname, t.max_slots AS slots, t.start_date,
             (SELECT count(*) FROM public.enrollments e WHERE e.tournament_id = t.id AND e.status::text IN ('paid','confirmed','approved')) AS enrolled
        FROM public.tournaments t
       WHERE t.state IN ('published','active')
         AND t.start_date IS NOT NULL
         AND t.start_date BETWEEN now()::date AND (now() + interval '48 hours')::date
         AND t.max_slots IS NOT NULL AND t.max_slots > 0
       LIMIT 200
    LOOP
      IF r.enrolled::numeric / NULLIF(r.slots,0) < 0.60 THEN
        PERFORM public.orkym_trigger_enqueue(r.tenant_id, NULL, r.organizer_id, 'organizer',
          'tournament_low_enrollment','tournament', r.id,
          jsonb_build_object('tournament_id',r.id,'enrolled',r.enrolled,'slots',r.slots,'name',r.tname,'start_date',r.start_date),
          'high','low_enroll:'||r.id::text||':'||to_char(now(),'YYYYMMDD'), now());
        v_count := v_count + 1;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen1: %', SQLERRM; END;

  -- 2
  BEGIN
    FOR r IN
      WITH agg AS (
        SELECT b.arena_id, b.tenant_id, extract(dow FROM b.booking_date)::int AS dow,
               extract(hour FROM b.start_time)::int AS hr,
               count(*) FILTER (WHERE b.status IN ('confirmed','paid')) AS taken, count(*) AS total
          FROM public.bookings b
         WHERE b.booking_date >= (now() - interval '3 days')::date AND b.booking_date <= now()::date
         GROUP BY 1,2,3,4 HAVING count(*) >= 3)
      SELECT a.arena_id, a.tenant_id, a.dow, a.hr, (a.taken::numeric/NULLIF(a.total,0)) AS occ
        FROM agg a WHERE a.taken::numeric/NULLIF(a.total,0) < 0.40 LIMIT 100
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, r.arena_id, NULL, 'arena',
        'idle_court_slot','court_slot',NULL,
        jsonb_build_object('arena_id',r.arena_id,'weekday',r.dow,'hour',r.hr,'occupancy_pct',round((r.occ*100)::numeric,1)),
        'medium','idle_slot:'||r.arena_id::text||':'||r.dow||':'||r.hr||':'||to_char(now(),'YYYYMMDD'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen2: %', SQLERRM; END;

  -- 3
  BEGIN
    FOR r IN
      SELECT DISTINCT pe.user_id, pe.tenant_id FROM public.orkym_proactive_eligibility pe
       WHERE pe.opted_in = true AND pe.channel = 'whatsapp'
         AND (EXISTS(SELECT 1 FROM public.bookings b WHERE b.user_id=pe.user_id AND b.created_at < now()-interval '5 days')
           OR EXISTS(SELECT 1 FROM public.enrollments e WHERE e.user_id=pe.user_id AND e.created_at < now()-interval '5 days'))
         AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.user_id=pe.user_id AND b.created_at > now()-interval '5 days')
         AND NOT EXISTS(SELECT 1 FROM public.enrollments e WHERE e.user_id=pe.user_id AND e.created_at > now()-interval '5 days')
         AND NOT EXISTS(SELECT 1 FROM public.orkym_triggers_queue q WHERE q.trigger_type='inactive_athlete' AND q.user_id=pe.user_id AND q.created_at > now()-interval '14 days')
       LIMIT 300
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, NULL, r.user_id, 'athlete',
        'inactive_athlete','user', r.user_id, jsonb_build_object('inactive_days',5),
        'low','inactive:'||r.user_id::text||':'||to_char(now(),'YYYYWW'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen3: %', SQLERRM; END;

  -- 4
  BEGIN
    FOR r IN
      SELECT c.id, c.tenant_id, c.arena_id, c.title, c.start_at, c.capacity,
             (c.capacity-(SELECT count(*) FROM public.arena_class_enrollments e WHERE e.class_id=c.id AND e.status='active')) AS free
        FROM public.arena_classes c
       WHERE c.status='scheduled' AND c.start_at BETWEEN now() AND now()+interval '7 days' AND c.capacity > 0
       LIMIT 200
    LOOP
      IF r.free::numeric/NULLIF(r.capacity,0) > 0.30 THEN
        PERFORM public.orkym_trigger_enqueue(r.tenant_id, r.arena_id, NULL, 'arena',
          'class_open_seats','arena_class', r.id,
          jsonb_build_object('class_id',r.id,'title',r.title,'free',r.free,'capacity',r.capacity,'start_at',r.start_at),
          'medium','class_open:'||r.id::text||':'||to_char(now(),'YYYYMMDD'), now());
        v_count := v_count + 1;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen4: %', SQLERRM; END;

  -- 5
  BEGIN
    FOR r IN
      WITH ranked AS (SELECT position, athlete_id, total_points,
             LAG(total_points) OVER (ORDER BY position) AS next_points
        FROM public.ranking_global WHERE position <= 10)
      SELECT athlete_id, position, total_points, COALESCE(next_points-total_points,0) AS gap
        FROM ranked WHERE position > 1 AND (next_points-total_points) BETWEEN 1 AND 30 LIMIT 50
    LOOP
      DECLARE v_tenant uuid;
      BEGIN
        SELECT tenant_id INTO v_tenant FROM public.profiles WHERE user_id=r.athlete_id LIMIT 1;
        IF v_tenant IS NOT NULL THEN
          PERFORM public.orkym_trigger_enqueue(v_tenant, NULL, r.athlete_id, 'athlete',
            'near_rank_up','user', r.athlete_id,
            jsonb_build_object('position',r.position,'points',r.total_points,'points_to_next',r.gap),
            'low','near_rank:'||r.athlete_id::text||':'||to_char(now(),'YYYYMMDD'), now());
          v_count := v_count + 1;
        END IF;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen5: %', SQLERRM; END;

  -- 6
  BEGIN
    FOR r IN
      SELECT p.id, p.tenant_id, p.company_id, p.name, c.owner_user_id
        FROM public.products p JOIN public.companies c ON c.id=p.company_id
       WHERE p.status='active' AND p.created_at < now()-interval '7 days'
         AND NOT EXISTS(SELECT 1 FROM public.ad_campaigns ac
           WHERE ac.target_type='product' AND ac.target_id=p.id AND ac.status='active'
             AND ac.starts_at <= now() AND ac.ends_at >= now())
       LIMIT 100
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, NULL, r.owner_user_id, 'company',
        'low_product_views','product', r.id, jsonb_build_object('product_id',r.id,'name',r.name),
        'low','low_product_views:'||r.id::text||':'||to_char(now(),'YYYYMMDD'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen6: %', SQLERRM; END;

  -- 7
  BEGIN
    FOR r IN
      SELECT t.id, t.tenant_id, t.organizer_id, t.name AS tname, t.max_slots AS slots, t.start_date,
             (SELECT count(*) FROM public.enrollments e WHERE e.tournament_id=t.id AND e.status::text IN ('paid','confirmed','approved')) AS enrolled
        FROM public.tournaments t
       WHERE t.state IN ('published','active') AND t.start_date IS NOT NULL
         AND t.start_date > now()::date AND t.max_slots IS NOT NULL AND t.max_slots > 0
       LIMIT 200
    LOOP
      IF r.enrolled::numeric/NULLIF(r.slots,0) > 0.90 THEN
        PERFORM public.orkym_trigger_enqueue(r.tenant_id, NULL, r.organizer_id, 'organizer',
          'tournament_high_demand','tournament', r.id,
          jsonb_build_object('tournament_id',r.id,'enrolled',r.enrolled,'slots',r.slots,'name',r.tname,'start_date',r.start_date),
          'medium','high_demand:'||r.id::text||':'||to_char(now(),'YYYYMMDD'), now());
        v_count := v_count + 1;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen7: %', SQLERRM; END;

  -- 8
  BEGIN
    FOR r IN
      SELECT ac.id, ac.tenant_id, ac.company_id, ac.name, c.owner_user_id
        FROM public.ad_campaigns ac JOIN public.companies c ON c.id=ac.company_id
       WHERE ac.status='active' AND ac.starts_at < now()-interval '3 days' AND ac.ends_at > now()
         AND NOT EXISTS(SELECT 1 FROM public.arena_operational_events ev
           WHERE ev.entity_type='campaign' AND ev.entity_id=ac.id AND ev.created_at > ac.starts_at)
       LIMIT 50
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, NULL, r.owner_user_id, 'company',
        'low_campaign_performance','campaign', r.id, jsonb_build_object('campaign_id',r.id,'name',r.name),
        'medium','weak_campaign:'||r.id::text||':'||to_char(now(),'YYYYMMDD'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen8: %', SQLERRM; END;

  -- 9
  BEGIN
    FOR r IN
      WITH per_arena AS (
        SELECT a.id AS arena_id, a.tenant_id, a.owner_user_id,
               (SELECT count(*) FROM public.bookings b WHERE b.arena_id=a.id AND b.created_at > now()-interval '7 days') AS bookings_7d
          FROM public.arenas a WHERE a.tenant_id IS NOT NULL
      ), tenant_avg AS (
        SELECT tenant_id, avg(bookings_7d)::numeric AS avg_b FROM per_arena GROUP BY tenant_id HAVING count(*) >= 2)
      SELECT pa.arena_id, pa.tenant_id, pa.owner_user_id, pa.bookings_7d, ta.avg_b
        FROM per_arena pa JOIN tenant_avg ta ON ta.tenant_id=pa.tenant_id
       WHERE ta.avg_b > 0 AND pa.bookings_7d::numeric < ta.avg_b * 0.5 LIMIT 50
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, r.arena_id, r.owner_user_id, 'tenant',
        'arena_low_activity','arena', r.arena_id,
        jsonb_build_object('arena_id',r.arena_id,'bookings_7d',r.bookings_7d,'tenant_avg',round(r.avg_b,1)),
        'low','arena_low:'||r.arena_id::text||':'||to_char(now(),'YYYYMMDD'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen9: %', SQLERRM; END;

  -- 10
  BEGIN
    FOR r IN
      WITH a AS (
        SELECT ar.id AS arena_id, ar.tenant_id, ar.owner_user_id,
               (SELECT count(*) FROM public.bookings b WHERE b.arena_id=ar.id AND b.created_at > now()-interval '3 days') AS recent,
               (SELECT count(*) FROM public.bookings b WHERE b.arena_id=ar.id AND b.created_at > now()-interval '30 days')/10.0 AS avg3d
          FROM public.arenas ar)
      SELECT a.arena_id, a.tenant_id, a.owner_user_id FROM a
       WHERE a.avg3d > 0 AND a.recent::numeric > a.avg3d * 1.5 LIMIT 50
    LOOP
      PERFORM public.orkym_trigger_enqueue(r.tenant_id, r.arena_id, r.owner_user_id, 'arena',
        'high_demand_signal','arena', r.arena_id, jsonb_build_object('arena_id',r.arena_id),
        'low','high_demand_arena:'||r.arena_id::text||':'||to_char(now(),'YYYYMMDD'), now());
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gen10: %', SQLERRM; END;

  RETURN v_count;
END $function$;