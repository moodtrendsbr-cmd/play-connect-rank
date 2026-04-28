-- ============================================================
-- Phase 12.6 — read_at column + idx for delivery webhook lookups
-- ============================================================
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_external_id
  ON public.whatsapp_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

-- ============================================================
-- Phase 12.8 — Read-only catalog RPCs for ORKYM bridge
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_athlete_ranking(_athlete_id uuid, _modality text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'modality', r.modality,
    'category', r.category,
    'points', r.points,
    'position', r.position,
    'updated_at', r.updated_at
  ) ORDER BY r.points DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT modality, category, points,
           ROW_NUMBER() OVER (PARTITION BY modality, category ORDER BY points DESC) AS position,
           updated_at, athlete_id
      FROM public.athlete_rankings
     WHERE (_modality IS NULL OR modality = _modality)
  ) r
  WHERE r.athlete_id = _athlete_id;

  RETURN jsonb_build_object('success', true, 'athlete_id', _athlete_id, 'rankings', COALESCE(v_rows, '[]'::jsonb));
EXCEPTION WHEN undefined_table THEN
  RETURN jsonb_build_object('success', true, 'athlete_id', _athlete_id, 'rankings', '[]'::jsonb, 'note', 'rankings_table_unavailable');
END $$;

CREATE OR REPLACE FUNCTION public.list_today_matches(_arena_id uuid DEFAULT NULL, _tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'match_id', m.id,
    'tournament_id', m.tournament_id,
    'scheduled_at', m.scheduled_at,
    'court_id', m.court_id,
    'status', m.status
  ) ORDER BY m.scheduled_at ASC), '[]'::jsonb)
  INTO v_rows
  FROM public.matches m
  WHERE m.scheduled_at::date = current_date
    AND (_arena_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tournaments t WHERE t.id = m.tournament_id AND t.arena_id = _arena_id))
    AND (_tenant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tournaments t WHERE t.id = m.tournament_id AND t.tenant_id = _tenant_id));

  RETURN jsonb_build_object('success', true, 'date', current_date, 'matches', COALESCE(v_rows, '[]'::jsonb));
EXCEPTION WHEN undefined_table THEN
  RETURN jsonb_build_object('success', true, 'date', current_date, 'matches', '[]'::jsonb, 'note', 'matches_table_unavailable');
END $$;

CREATE OR REPLACE FUNCTION public.get_athlete_performance(_athlete_id uuid, _period_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total int := 0; v_wins int := 0;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE winner_id = _athlete_id)
    INTO v_total, v_wins
    FROM public.matches
   WHERE (player1_id = _athlete_id OR player2_id = _athlete_id)
     AND scheduled_at > now() - (_period_days || ' days')::interval
     AND status = 'completed';

  RETURN jsonb_build_object(
    'success', true, 'athlete_id', _athlete_id, 'period_days', _period_days,
    'total_matches', v_total, 'wins', v_wins,
    'win_rate', CASE WHEN v_total > 0 THEN ROUND((v_wins::numeric / v_total) * 100, 1) ELSE 0 END
  );
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RETURN jsonb_build_object('success', true, 'athlete_id', _athlete_id, 'total_matches', 0, 'wins', 0, 'note', 'matches_schema_unavailable');
END $$;

CREATE OR REPLACE FUNCTION public.get_tournament_standings(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_t record;
BEGIN
  SELECT id, name, status INTO v_t FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'tournament_not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'enrollment_id', e.id, 'athlete_id', e.athlete_id, 'category', e.category, 'status', e.status
  )), '[]'::jsonb) INTO v_rows
  FROM public.enrollments e
  WHERE e.tournament_id = _tournament_id
  LIMIT 100;

  RETURN jsonb_build_object('success', true, 'tournament_id', _tournament_id, 'tournament_name', v_t.name, 'standings', COALESCE(v_rows, '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.list_upcoming_classes(_arena_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'title', c.title, 'start_at', c.start_at, 'end_at', c.end_at,
    'capacity', c.capacity, 'modality', c.modality
  ) ORDER BY c.start_at ASC), '[]'::jsonb) INTO v_rows
  FROM public.arena_classes c
  WHERE c.arena_id = _arena_id
    AND c.start_at >= now()
    AND c.start_at <= now() + (_days || ' days')::interval
  LIMIT 100;

  RETURN jsonb_build_object('success', true, 'arena_id', _arena_id, 'classes', COALESCE(v_rows, '[]'::jsonb));
END $$;

-- ============================================================
-- Phase 12.9 — wa_leads table for unknown WhatsApp guests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL DEFAULT 0,
  last_inbound_text text,
  source_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  tenant_hint uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  arena_hint uuid REFERENCES public.arenas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','engaged','converted','blocked')),
  converted_user_id uuid,
  converted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_leads_status ON public.wa_leads (status);
CREATE INDEX IF NOT EXISTS idx_wa_leads_tenant_hint ON public.wa_leads (tenant_hint);

ALTER TABLE public.wa_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_leads_admin_select" ON public.wa_leads;
CREATE POLICY "wa_leads_admin_select" ON public.wa_leads
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR (tenant_hint IS NOT NULL AND public.is_tenant_admin(tenant_hint, auth.uid()))
  );

-- Service role bypasses RLS by default; no INSERT/UPDATE/DELETE policies
-- to keep mutations server-side only.

CREATE TRIGGER trg_wa_leads_updated
  BEFORE UPDATE ON public.wa_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when a wa_identity is verified, mark matching leads as converted
CREATE OR REPLACE FUNCTION public.trg_wa_lead_convert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified_at IS NOT NULL AND (OLD.verified_at IS NULL OR OLD.verified_at IS DISTINCT FROM NEW.verified_at) THEN
    UPDATE public.wa_leads
       SET status = 'converted',
           converted_user_id = NEW.user_id,
           converted_at = now(),
           updated_at = now()
     WHERE wa_phone = NEW.wa_phone
       AND status <> 'converted';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_identities_convert_lead ON public.wa_identities;
CREATE TRIGGER trg_wa_identities_convert_lead
  AFTER INSERT OR UPDATE OF verified_at ON public.wa_identities
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_lead_convert();