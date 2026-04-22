
-- ============================================================
-- 1. whatsapp_instances (canal físico)
-- ============================================================
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('twilio','meta','evolution','mock')),
  display_name text NOT NULL,
  phone_number text NOT NULL,
  external_instance_id text,
  webhook_secret text,
  outbound_endpoint text,
  outbound_credentials jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  is_global_fallback boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wa_instances_phone ON public.whatsapp_instances(phone_number);
CREATE UNIQUE INDEX idx_wa_instances_global_fallback
  ON public.whatsapp_instances((1)) WHERE is_global_fallback = true;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Admin-only read/write; credenciais nunca expostas a clientes (service role only)
CREATE POLICY "admin read instances" ON public.whatsapp_instances
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin write instances" ON public.whatsapp_instances
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER set_wa_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. whatsapp_bindings (roteamento hierárquico)
-- ============================================================
CREATE TABLE public.whatsapp_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('arena','tenant','organizer','company','global','profile')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE CASCADE,
  organizer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_type text,
  is_default boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_bindings_arena ON public.whatsapp_bindings(arena_id) WHERE arena_id IS NOT NULL;
CREATE INDEX idx_wa_bindings_tenant ON public.whatsapp_bindings(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_wa_bindings_organizer ON public.whatsapp_bindings(organizer_user_id) WHERE organizer_user_id IS NOT NULL;
CREATE INDEX idx_wa_bindings_company ON public.whatsapp_bindings(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_wa_bindings_scope_priority ON public.whatsapp_bindings(scope_type, priority);

ALTER TABLE public.whatsapp_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read bindings" ON public.whatsapp_bindings
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
    OR (organizer_user_id = auth.uid())
    OR (company_id IS NOT NULL AND public.is_company_owner(company_id, auth.uid()))
  );

CREATE POLICY "tenant admin write bindings" ON public.whatsapp_bindings
  FOR ALL USING (
    public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  ) WITH CHECK (
    public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  );

-- ============================================================
-- 3. whatsapp_messages (histórico inbound + outbound)
-- ============================================================
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  command_id uuid REFERENCES public.conversational_commands(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  wa_phone text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text',
  body text,
  template_name text,
  template_vars jsonb,
  external_message_id text,
  delivery_status text NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued','sent','delivered','read','failed')),
  failure_reason text,
  initiated_by text NOT NULL DEFAULT 'user'
    CHECK (initiated_by IN ('user','orkym','system','manual')),
  category text,
  correlation_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

CREATE INDEX idx_wa_msgs_phone ON public.whatsapp_messages(wa_phone, created_at DESC);
CREATE INDEX idx_wa_msgs_tenant ON public.whatsapp_messages(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_wa_msgs_arena ON public.whatsapp_messages(arena_id, created_at DESC) WHERE arena_id IS NOT NULL;
CREATE INDEX idx_wa_msgs_user ON public.whatsapp_messages(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_wa_msgs_command ON public.whatsapp_messages(command_id) WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX idx_wa_msgs_idempotency
  ON public.whatsapp_messages(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read messages" ON public.whatsapp_messages
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
  );
-- INSERT/UPDATE bloqueados a clientes (service role only)

-- ============================================================
-- 4. orkym_proactive_eligibility (opt-in outbound)
-- ============================================================
CREATE TABLE public.orkym_proactive_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('billing','retention','marketing','operations')),
  channel text NOT NULL DEFAULT 'whatsapp',
  opted_in boolean NOT NULL DEFAULT false,
  opted_at timestamptz,
  opted_out_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, category, channel)
);

CREATE INDEX idx_orkym_elig_user ON public.orkym_proactive_eligibility(user_id);
CREATE INDEX idx_orkym_elig_tenant ON public.orkym_proactive_eligibility(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.orkym_proactive_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self read eligibility" ON public.orkym_proactive_eligibility
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  );
CREATE POLICY "self insert eligibility" ON public.orkym_proactive_eligibility
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update eligibility" ON public.orkym_proactive_eligibility
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_orkym_elig_updated_at
  BEFORE UPDATE ON public.orkym_proactive_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. ALTER conversational_commands — adicionar colunas
-- ============================================================
ALTER TABLE public.conversational_commands
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound','outbound')),
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_entity_type text,
  ADD COLUMN IF NOT EXISTS linked_entity_id uuid,
  ADD COLUMN IF NOT EXISTS normalized_input text,
  ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'user'
    CHECK (initiated_by IN ('user','orkym','system'));

CREATE INDEX IF NOT EXISTS idx_cc_instance
  ON public.conversational_commands(whatsapp_instance_id) WHERE whatsapp_instance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_linked_entity
  ON public.conversational_commands(linked_entity_type, linked_entity_id) WHERE linked_entity_id IS NOT NULL;

-- ============================================================
-- 6. RPC — resolve_whatsapp_instance (hierarquia de roteamento)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_instance(
  _tenant_id uuid DEFAULT NULL,
  _arena_id uuid DEFAULT NULL,
  _profile_type text DEFAULT NULL,
  _organizer_user_id uuid DEFAULT NULL,
  _company_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inst record;
  v_source text;
BEGIN
  -- 1. Arena específico
  IF _arena_id IS NOT NULL THEN
    SELECT i.id, i.provider, i.phone_number, i.display_name, i.status
      INTO v_inst
      FROM whatsapp_bindings b
      JOIN whatsapp_instances i ON i.id = b.instance_id
     WHERE b.arena_id = _arena_id
       AND b.scope_type = 'arena'
       AND i.status = 'active'
     ORDER BY b.priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source', 'arena',
        'instance_id', v_inst.id, 'provider', v_inst.provider,
        'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
    END IF;
  END IF;

  -- 2. Organizer específico
  IF _organizer_user_id IS NOT NULL THEN
    SELECT i.id, i.provider, i.phone_number, i.display_name, i.status
      INTO v_inst
      FROM whatsapp_bindings b
      JOIN whatsapp_instances i ON i.id = b.instance_id
     WHERE b.organizer_user_id = _organizer_user_id
       AND b.scope_type = 'organizer'
       AND i.status = 'active'
     ORDER BY b.priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source', 'organizer',
        'instance_id', v_inst.id, 'provider', v_inst.provider,
        'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
    END IF;
  END IF;

  -- 3. Company específico
  IF _company_id IS NOT NULL THEN
    SELECT i.id, i.provider, i.phone_number, i.display_name, i.status
      INTO v_inst
      FROM whatsapp_bindings b
      JOIN whatsapp_instances i ON i.id = b.instance_id
     WHERE b.company_id = _company_id
       AND b.scope_type = 'company'
       AND i.status = 'active'
     ORDER BY b.priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source', 'company',
        'instance_id', v_inst.id, 'provider', v_inst.provider,
        'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
    END IF;
  END IF;

  -- 4. Tenant
  IF _tenant_id IS NOT NULL THEN
    SELECT i.id, i.provider, i.phone_number, i.display_name, i.status
      INTO v_inst
      FROM whatsapp_bindings b
      JOIN whatsapp_instances i ON i.id = b.instance_id
     WHERE b.tenant_id = _tenant_id
       AND b.scope_type = 'tenant'
       AND i.status = 'active'
     ORDER BY b.priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source', 'tenant',
        'instance_id', v_inst.id, 'provider', v_inst.provider,
        'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
    END IF;
  END IF;

  -- 5. Profile type
  IF _profile_type IS NOT NULL THEN
    SELECT i.id, i.provider, i.phone_number, i.display_name, i.status
      INTO v_inst
      FROM whatsapp_bindings b
      JOIN whatsapp_instances i ON i.id = b.instance_id
     WHERE b.profile_type = _profile_type
       AND b.scope_type = 'profile'
       AND i.status = 'active'
     ORDER BY b.priority ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source', 'profile',
        'instance_id', v_inst.id, 'provider', v_inst.provider,
        'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
    END IF;
  END IF;

  -- 6. Fallback global
  SELECT id, provider, phone_number, display_name
    INTO v_inst
    FROM whatsapp_instances
   WHERE is_global_fallback = true AND status = 'active'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'source', 'global_fallback',
      'instance_id', v_inst.id, 'provider', v_inst.provider,
      'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'no_instance_resolved');
END $$;

-- ============================================================
-- 7. RPC — resolve_whatsapp_instance_by_phone (lookup direto pelo número que recebeu)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_instance_by_phone(_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(COALESCE(_phone,''), '\D', '', 'g');
  v_inst record;
BEGIN
  IF length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  SELECT id, provider, phone_number, display_name, status
    INTO v_inst
    FROM whatsapp_instances
   WHERE phone_number = v_phone
   LIMIT 1;

  IF NOT FOUND THEN
    -- fallback global
    SELECT id, provider, phone_number, display_name, status
      INTO v_inst
      FROM whatsapp_instances
     WHERE is_global_fallback = true AND status = 'active'
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_instance_for_phone');
  END IF;

  RETURN jsonb_build_object('success', true,
    'instance_id', v_inst.id, 'provider', v_inst.provider,
    'phone_number', v_inst.phone_number, 'display_name', v_inst.display_name,
    'status', v_inst.status);
END $$;

-- ============================================================
-- 8. RPC — resolve_whatsapp_identity (quem é a pessoa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_identity(
  _wa_phone text,
  _instance_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(COALESCE(_wa_phone,''), '\D', '', 'g');
  v_id record;
  v_tenant uuid;
  v_arena uuid;
BEGIN
  IF length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  -- Busca identidade conhecida
  SELECT id, user_id, default_profile_type, verified_at, metadata
    INTO v_id
    FROM wa_identities
   WHERE wa_phone = v_phone
   ORDER BY verified_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    -- Lead/guest desconhecido
    RETURN jsonb_build_object(
      'success', true,
      'is_lead', true,
      'verified', false,
      'wa_phone', v_phone,
      'instance_id', _instance_id
    );
  END IF;

  -- Resolve tenant (memberships) e arena padrão (owner)
  SELECT tenant_id INTO v_tenant
    FROM tenant_memberships
   WHERE user_id = v_id.user_id
   ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_arena
    FROM arenas
   WHERE owner_user_id = v_id.user_id
   ORDER BY created_at ASC LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'is_lead', false,
    'verified', v_id.verified_at IS NOT NULL,
    'identity_id', v_id.id,
    'user_id', v_id.user_id,
    'profile_type', v_id.default_profile_type,
    'tenant_id', v_tenant,
    'arena_id', v_arena,
    'wa_phone', v_phone,
    'instance_id', _instance_id
  );
END $$;

-- ============================================================
-- 9. RPCs read-only (catálogo inicial para moodplay-execute-action)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_arena_summary(_arena_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_arena record;
  v_today_classes int;
  v_active_subs int;
  v_overdue int;
BEGIN
  SELECT id, name, tenant_id INTO v_arena FROM arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'arena_not_found'); END IF;

  IF v_user IS NOT NULL AND NOT (
    public.is_arena_owner(_arena_id, v_user)
    OR public.is_tenant_admin(v_arena.tenant_id, v_user)
    OR public.is_admin(v_user)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT count(*) INTO v_today_classes FROM arena_classes
    WHERE arena_id = _arena_id AND start_at::date = current_date;
  SELECT count(*) INTO v_active_subs FROM arena_student_subscriptions
    WHERE arena_id = _arena_id AND status = 'active';
  SELECT count(*) INTO v_overdue FROM arena_billing_cycles
    WHERE arena_id = _arena_id AND status = 'overdue';

  RETURN jsonb_build_object('success', true,
    'arena_id', v_arena.id, 'arena_name', v_arena.name,
    'today_classes', v_today_classes,
    'active_subscriptions', v_active_subs,
    'overdue_cycles', v_overdue);
END $$;

CREATE OR REPLACE FUNCTION public.list_today_classes(_arena_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_arena record;
  v_classes jsonb;
BEGIN
  SELECT id, tenant_id INTO v_arena FROM arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'arena_not_found'); END IF;
  IF v_user IS NOT NULL AND NOT (
    public.is_arena_owner(_arena_id, v_user)
    OR public.is_tenant_admin(v_arena.tenant_id, v_user)
    OR public.is_admin(v_user)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'start_at', start_at, 'end_at', end_at,
    'capacity', capacity, 'status', status
  ) ORDER BY start_at), '[]'::jsonb) INTO v_classes
  FROM arena_classes
  WHERE arena_id = _arena_id AND start_at::date = current_date;

  RETURN jsonb_build_object('success', true, 'classes', v_classes);
END $$;

CREATE OR REPLACE FUNCTION public.list_pending_enrollments(_arena_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_arena record;
  v_items jsonb;
BEGIN
  SELECT id, tenant_id INTO v_arena FROM arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'arena_not_found'); END IF;
  IF v_user IS NOT NULL AND NOT (
    public.is_arena_owner(_arena_id, v_user)
    OR public.is_tenant_admin(v_arena.tenant_id, v_user)
    OR public.is_admin(v_user)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'student_id', e.student_id, 'class_id', e.class_id,
    'payment_status', e.payment_status, 'enrolled_at', e.enrolled_at
  ) ORDER BY e.enrolled_at DESC), '[]'::jsonb) INTO v_items
  FROM arena_class_enrollments e
  WHERE e.arena_id = _arena_id AND e.payment_status = 'pending'
  LIMIT 50;

  RETURN jsonb_build_object('success', true, 'enrollments', v_items);
END $$;

CREATE OR REPLACE FUNCTION public.get_revenue_today(_arena_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_arena record;
  v_total numeric := 0;
  v_count int := 0;
BEGIN
  SELECT id, tenant_id INTO v_arena FROM arenas WHERE id = _arena_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'arena_not_found'); END IF;
  IF v_user IS NOT NULL AND NOT (
    public.is_arena_owner(_arena_id, v_user)
    OR public.is_tenant_admin(v_arena.tenant_id, v_user)
    OR public.is_admin(v_user)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(SUM(total_amount), 0), count(*) INTO v_total, v_count
  FROM financial_transactions
  WHERE arena_id = _arena_id
    AND status = 'paid'
    AND paid_at::date = current_date;

  RETURN jsonb_build_object('success', true,
    'total', v_total, 'count', v_count, 'date', current_date);
END $$;
