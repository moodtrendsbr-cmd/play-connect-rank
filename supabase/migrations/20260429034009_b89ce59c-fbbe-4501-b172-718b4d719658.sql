-- ============================================================
-- P0 #1 — Activate existing trigger functions
-- ============================================================

DROP TRIGGER IF EXISTS trg_enrollments_activity ON public.enrollments;
CREATE TRIGGER trg_enrollments_activity
AFTER INSERT OR UPDATE OF checked_in_at ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_enrollment();

DROP TRIGGER IF EXISTS trg_enrollments_memory ON public.enrollments;
CREATE TRIGGER trg_enrollments_memory
AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_memory_from_enrollment();

DROP TRIGGER IF EXISTS trg_enrollments_record_payment ON public.enrollments;
CREATE TRIGGER trg_enrollments_record_payment
AFTER UPDATE OF status ON public.enrollments
FOR EACH ROW
WHEN (NEW.status::text = 'paid' AND (OLD.status IS NULL OR OLD.status::text <> 'paid'))
EXECUTE FUNCTION public.trg_enrollment_record_payment();

DROP TRIGGER IF EXISTS trg_modality_matches_activity ON public.modality_matches;
CREATE TRIGGER trg_modality_matches_activity
AFTER UPDATE OF winner_entry_id ON public.modality_matches
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_match();

-- ============================================================
-- P0 #3 — Revenue attribution on financial_transactions paid
-- ============================================================

CREATE OR REPLACE FUNCTION public.orkym_attribute_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant uuid := NEW.tenant_id;
  v_arena uuid := NEW.arena_id;
  v_window_start timestamptz := NEW.paid_at - interval '24 hours';
  v_command_id uuid;
  v_trigger_id uuid;
  v_session_id uuid;
  v_attribution_type text;
  v_confidence numeric := 0.50;
  v_window_seconds integer;
BEGIN
  -- Only fire when transaction transitions to paid
  IF NEW.status <> 'paid' OR (OLD.status IS NOT NULL AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;
  IF NEW.paid_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve athlete user_id from source (enrollment / booking / order)
  IF NEW.source_type = 'enrollment' THEN
    SELECT COALESCE(e.user_id, e.payer_id) INTO v_user_id
      FROM public.enrollments e WHERE e.id = NEW.source_id LIMIT 1;
  END IF;
  -- (other source_types: leave v_user_id null; attribution still recorded as reactive)

  -- 1. Look for recent OUTBOUND proactive trigger that landed in this user's WA
  IF v_user_id IS NOT NULL THEN
    SELECT cc.id, cc.linked_entity_id
      INTO v_command_id, v_trigger_id
      FROM public.conversational_commands cc
     WHERE cc.user_id = v_user_id
       AND cc.direction = 'outbound'
       AND cc.initiated_by = 'orkym'
       AND cc.linked_entity_type = 'trigger'
       AND cc.created_at >= v_window_start
       AND cc.created_at <= NEW.paid_at
     ORDER BY cc.created_at DESC
     LIMIT 1;

    IF v_trigger_id IS NOT NULL THEN
      v_attribution_type := 'proactive';
      v_confidence := 0.85;
      v_window_seconds := EXTRACT(EPOCH FROM (NEW.paid_at - (
        SELECT created_at FROM public.conversational_commands WHERE id = v_command_id
      )))::int;
    ELSE
      -- 2. Look for recent INBOUND command from this user (assisted)
      SELECT cc.id INTO v_command_id
        FROM public.conversational_commands cc
       WHERE cc.user_id = v_user_id
         AND cc.direction = 'inbound'
         AND cc.created_at >= v_window_start
         AND cc.created_at <= NEW.paid_at
       ORDER BY cc.created_at DESC
       LIMIT 1;

      IF v_command_id IS NOT NULL THEN
        v_attribution_type := 'assisted';
        v_confidence := 0.65;
        v_window_seconds := EXTRACT(EPOCH FROM (NEW.paid_at - (
          SELECT created_at FROM public.conversational_commands WHERE id = v_command_id
        )))::int;
      ELSE
        v_attribution_type := 'reactive';
        v_confidence := 0.30;
      END IF;
    END IF;
  ELSE
    v_attribution_type := 'reactive';
    v_confidence := 0.30;
  END IF;

  INSERT INTO public.orkym_revenue_attribution (
    tenant_id, arena_id, user_id, profile_type,
    trigger_id, command_id, session_id,
    entity_type, entity_id,
    financial_transaction_id, revenue_amount, currency,
    attribution_type, attribution_confidence,
    conversion_window_seconds, metadata
  ) VALUES (
    v_tenant, v_arena, v_user_id, 'athlete',
    v_trigger_id, v_command_id, v_session_id,
    NEW.source_type, NEW.source_id,
    NEW.id, NEW.total_amount, NEW.currency,
    v_attribution_type, v_confidence,
    v_window_seconds,
    jsonb_build_object('source_type', NEW.source_type, 'auto', true)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the financial transaction
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_transactions_attribute_revenue ON public.financial_transactions;
CREATE TRIGGER trg_financial_transactions_attribute_revenue
AFTER INSERT OR UPDATE OF status ON public.financial_transactions
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION public.orkym_attribute_revenue();

-- ============================================================
-- P0 #5 — Enqueue athlete notifications (proactive triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION public.orkym_enqueue_athlete_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_arena uuid;
  v_trigger_type text;
  v_dedup text;
  v_payload jsonb;
  v_priority text := 'medium';
  v_entity_type text;
  v_entity_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'enrollments' THEN
    v_user := COALESCE(NEW.user_id, NEW.payer_id);
    IF v_user IS NULL THEN RETURN NEW; END IF;
    SELECT tenant_id INTO v_tenant FROM public.tournaments WHERE id = NEW.tournament_id;
    v_entity_type := 'tournament';
    v_entity_id := NEW.tournament_id;

    IF TG_OP = 'INSERT' THEN
      v_trigger_type := 'enrollment_created';
      v_dedup := 'enroll_created:' || NEW.id::text;
      v_payload := jsonb_build_object(
        'enrollment_id', NEW.id,
        'tournament_id', NEW.tournament_id,
        'status', NEW.status::text
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status::text = 'paid'
          AND (OLD.status IS NULL OR OLD.status::text <> 'paid') THEN
      v_trigger_type := 'enrollment_paid';
      v_dedup := 'enroll_paid:' || NEW.id::text;
      v_priority := 'high';
      v_payload := jsonb_build_object(
        'enrollment_id', NEW.id,
        'tournament_id', NEW.tournament_id,
        'amount_paid', NEW.amount_paid
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'modality_matches' THEN
    -- Notify both winner and loser when a winner is set
    IF NEW.winner_entry_id IS NULL OR NEW.winner_entry_id IS NOT DISTINCT FROM OLD.winner_entry_id THEN
      RETURN NEW;
    END IF;
    v_tenant := NEW.tenant_id;
    v_arena := NEW.arena_id;
    v_entity_type := 'modality_match';
    v_entity_id := NEW.id;
    v_trigger_type := 'match_result';
    v_priority := 'medium';
    v_payload := jsonb_build_object(
      'match_id', NEW.id,
      'modality_id', NEW.modality_id,
      'score_a', NEW.score_a,
      'score_b', NEW.score_b,
      'winner_entry_id', NEW.winner_entry_id
    );

    -- Enqueue for each member of both entries
    FOR v_user IN
      SELECT em.user_id FROM public.modality_entry_members em
       WHERE em.entry_id IN (NEW.entry_a_id, NEW.entry_b_id)
         AND em.user_id IS NOT NULL
    LOOP
      v_dedup := 'match_result:' || NEW.id::text || ':' || v_user::text;
      INSERT INTO public.orkym_triggers_queue (
        tenant_id, arena_id, user_id, profile_type,
        trigger_type, entity_type, entity_id, payload, priority, dedup_key
      ) VALUES (
        v_tenant, v_arena, v_user, 'athlete',
        v_trigger_type, v_entity_type, v_entity_id, v_payload, v_priority, v_dedup
      ) ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;
    RETURN NEW;
  ELSE
    RETURN NEW;
  END IF;

  -- enrollments single-user enqueue
  INSERT INTO public.orkym_triggers_queue (
    tenant_id, arena_id, user_id, profile_type,
    trigger_type, entity_type, entity_id, payload, priority, dedup_key
  ) VALUES (
    v_tenant, v_arena, v_user, 'athlete',
    v_trigger_type, v_entity_type, v_entity_id, v_payload, v_priority, v_dedup
  ) ON CONFLICT (dedup_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollments_notify ON public.enrollments;
CREATE TRIGGER trg_enrollments_notify
AFTER INSERT OR UPDATE OF status ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.orkym_enqueue_athlete_notification();

DROP TRIGGER IF EXISTS trg_modality_matches_notify ON public.modality_matches;
CREATE TRIGGER trg_modality_matches_notify
AFTER UPDATE OF winner_entry_id ON public.modality_matches
FOR EACH ROW EXECUTE FUNCTION public.orkym_enqueue_athlete_notification();

-- Ensure dedup_key uniqueness for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS orkym_triggers_queue_dedup_key_uq
  ON public.orkym_triggers_queue (dedup_key) WHERE dedup_key IS NOT NULL;