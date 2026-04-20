-- ============================================================
-- FASE 4: ORKYM Operational Layer + Recurring Ops + Occurrences
-- ============================================================

-- ----------- BLOCO A: ORKYM HOOKS -----------

CREATE TABLE public.arena_operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_op_events_arena_created ON public.arena_operational_events(arena_id, created_at DESC);
CREATE INDEX idx_arena_op_events_unprocessed ON public.arena_operational_events(arena_id, event_type) WHERE processed_at IS NULL;

CREATE TABLE public.arena_operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  related_entity_type text,
  related_entity_id uuid,
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','done')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','orkym','system')),
  due_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_op_tasks_arena_status ON public.arena_operational_tasks(arena_id, status, created_at DESC);

-- ----------- BLOCO B: RECURRING / BILLING -----------

CREATE TABLE public.arena_membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  billing_frequency text NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly','quarterly','yearly','one_time')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_plans_arena_active ON public.arena_membership_plans(arena_id, is_active);

CREATE TABLE public.arena_student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.arena_students(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.arena_membership_plans(id) ON DELETE RESTRICT,
  payment_account_id uuid REFERENCES public.payment_accounts(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','canceled','past_due')),
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_due_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_subs_arena_due ON public.arena_student_subscriptions(arena_id, next_due_at);
CREATE INDEX idx_arena_subs_student ON public.arena_student_subscriptions(student_id);

CREATE TABLE public.arena_billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.arena_student_subscriptions(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','canceled')),
  payment_reference text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_cycles_sub_due ON public.arena_billing_cycles(subscription_id, due_at);
CREATE INDEX idx_arena_cycles_arena_status ON public.arena_billing_cycles(arena_id, status, due_at);

-- ----------- BLOCO C: OCCURRENCES -----------

CREATE TABLE public.arena_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  related_entity_type text,
  related_entity_id uuid,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('court','class','instructor','booking','student','event','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  reported_by uuid,
  assigned_to uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_occurrences_arena_status ON public.arena_occurrences(arena_id, status, created_at DESC);

-- ----------- ENABLE RLS -----------

ALTER TABLE public.arena_operational_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_operational_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_occurrences ENABLE ROW LEVEL SECURITY;

-- ----------- POLICIES: padrão arena owner / tenant admin / admin -----------

-- arena_operational_events
CREATE POLICY "op_events_view" ON public.arena_operational_events FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "op_events_manage" ON public.arena_operational_events FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- arena_operational_tasks
CREATE POLICY "op_tasks_view" ON public.arena_operational_tasks FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "op_tasks_manage" ON public.arena_operational_tasks FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- arena_membership_plans
CREATE POLICY "plans_view" ON public.arena_membership_plans FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "plans_manage" ON public.arena_membership_plans FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- arena_student_subscriptions (+ exceção: aluno vê a sua)
CREATE POLICY "subs_view_owner" ON public.arena_student_subscriptions FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "subs_view_student_own" ON public.arena_student_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.arena_students s
                 WHERE s.id = arena_student_subscriptions.student_id
                   AND s.profile_user_id = auth.uid()));
CREATE POLICY "subs_manage" ON public.arena_student_subscriptions FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- arena_billing_cycles (+ exceção: aluno vê os seus)
CREATE POLICY "cycles_view_owner" ON public.arena_billing_cycles FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "cycles_view_student_own" ON public.arena_billing_cycles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.arena_student_subscriptions sub
                 JOIN public.arena_students s ON s.id = sub.student_id
                 WHERE sub.id = arena_billing_cycles.subscription_id
                   AND s.profile_user_id = auth.uid()));
CREATE POLICY "cycles_manage" ON public.arena_billing_cycles FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- arena_occurrences
CREATE POLICY "occ_view" ON public.arena_occurrences FOR SELECT
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));
CREATE POLICY "occ_manage" ON public.arena_occurrences FOR ALL
  USING (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_arena_owner(arena_id, auth.uid())
      OR public.is_tenant_admin(tenant_id, auth.uid())
      OR public.is_admin(auth.uid()));

-- ----------- TENANT-DEFAULT TRIGGERS -----------

CREATE TRIGGER trg_op_events_tenant_default BEFORE INSERT ON public.arena_operational_events
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_op_tasks_tenant_default BEFORE INSERT ON public.arena_operational_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_plans_tenant_default BEFORE INSERT ON public.arena_membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_subs_tenant_default BEFORE INSERT ON public.arena_student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_cycles_tenant_default BEFORE INSERT ON public.arena_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_occ_tenant_default BEFORE INSERT ON public.arena_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();

-- ----------- UPDATED_AT TRIGGERS -----------

CREATE TRIGGER trg_op_tasks_updated_at BEFORE UPDATE ON public.arena_operational_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.arena_membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON public.arena_student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cycles_updated_at BEFORE UPDATE ON public.arena_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_occ_updated_at BEFORE UPDATE ON public.arena_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPCs OPERACIONAIS (sem inteligência)
-- ============================================================

CREATE OR REPLACE FUNCTION public.arena_generate_billing_cycle(_subscription_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sub record;
  v_plan record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_due timestamptz;
  v_cycle_id uuid;
  v_interval interval;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_sub FROM public.arena_student_subscriptions WHERE id = _subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'subscription_not_found'; END IF;

  IF NOT (public.is_arena_owner(v_sub.arena_id, v_user)
       OR public.is_tenant_admin(v_sub.tenant_id, v_user)
       OR public.is_admin(v_user)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_plan FROM public.arena_membership_plans WHERE id = v_sub.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  v_interval := CASE v_plan.billing_frequency
    WHEN 'monthly'   THEN interval '1 month'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'yearly'    THEN interval '1 year'
    ELSE interval '1 month'
  END;

  v_period_start := COALESCE(v_sub.current_period_end, v_sub.next_due_at, now());
  v_period_end   := v_period_start + v_interval;
  v_due          := v_period_start;

  INSERT INTO public.arena_billing_cycles (
    tenant_id, arena_id, subscription_id, period_start, period_end, amount, due_at, status
  ) VALUES (
    v_sub.tenant_id, v_sub.arena_id, v_sub.id, v_period_start, v_period_end, v_plan.amount, v_due, 'pending'
  ) RETURNING id INTO v_cycle_id;

  UPDATE public.arena_student_subscriptions
    SET current_period_start = v_period_start,
        current_period_end = v_period_end,
        next_due_at = v_period_end,
        status = CASE WHEN status = 'past_due' THEN 'active' ELSE status END,
        updated_at = now()
  WHERE id = v_sub.id;

  RETURN v_cycle_id;
END $$;

CREATE OR REPLACE FUNCTION public.arena_mark_cycle_paid(
  _cycle_id uuid,
  _payment_method text DEFAULT 'manual',
  _payment_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cycle record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_cycle FROM public.arena_billing_cycles WHERE id = _cycle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cycle_not_found'; END IF;

  IF NOT (public.is_arena_owner(v_cycle.arena_id, v_user)
       OR public.is_tenant_admin(v_cycle.tenant_id, v_user)
       OR public.is_admin(v_user)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.arena_billing_cycles
    SET status = 'paid',
        paid_at = now(),
        payment_method = _payment_method,
        payment_reference = _payment_reference,
        updated_at = now()
  WHERE id = _cycle_id;
END $$;

CREATE OR REPLACE FUNCTION public.arena_mark_overdue_cycles(_arena_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_arena record;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT id, tenant_id INTO v_arena FROM public.arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_not_found'; END IF;

  IF NOT (public.is_arena_owner(_arena_id, v_user)
       OR public.is_tenant_admin(v_arena.tenant_id, v_user)
       OR public.is_admin(v_user)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH upd AS (
    UPDATE public.arena_billing_cycles
       SET status = 'overdue', updated_at = now()
     WHERE arena_id = _arena_id
       AND status = 'pending'
       AND due_at < now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;

  UPDATE public.arena_student_subscriptions s
     SET status = 'past_due', updated_at = now()
   WHERE s.arena_id = _arena_id
     AND s.status = 'active'
     AND EXISTS (SELECT 1 FROM public.arena_billing_cycles c
                 WHERE c.subscription_id = s.id AND c.status = 'overdue');

  RETURN v_count;
END $$;

-- ============================================================
-- TRIGGERS DE EVENTOS (ORKYM hooks)
-- ============================================================

CREATE OR REPLACE FUNCTION public.emit_billing_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('overdue','paid') THEN
    INSERT INTO public.arena_operational_events (
      tenant_id, arena_id, entity_type, entity_id, event_type, payload, source
    ) VALUES (
      NEW.tenant_id, NEW.arena_id, 'billing_cycle', NEW.id,
      'billing.' || NEW.status,
      jsonb_build_object(
        'subscription_id', NEW.subscription_id,
        'amount', NEW.amount,
        'due_at', NEW.due_at,
        'paid_at', NEW.paid_at
      ),
      'system'
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_billing_emit_event
  AFTER UPDATE ON public.arena_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.emit_billing_event();

CREATE OR REPLACE FUNCTION public.emit_attendance_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'absent' THEN
    INSERT INTO public.arena_operational_events (
      tenant_id, arena_id, entity_type, entity_id, event_type, payload, source
    ) VALUES (
      NEW.tenant_id, NEW.arena_id, 'attendance', NEW.id,
      'attendance.absent',
      jsonb_build_object(
        'class_id', NEW.class_id,
        'student_id', NEW.student_id,
        'enrollment_id', NEW.enrollment_id
      ),
      'system'
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_attendance_emit_event
  AFTER INSERT ON public.arena_attendance
  FOR EACH ROW EXECUTE FUNCTION public.emit_attendance_event();