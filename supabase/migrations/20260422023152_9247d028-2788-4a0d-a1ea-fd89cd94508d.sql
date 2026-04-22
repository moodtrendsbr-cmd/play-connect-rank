-- =========================================================
-- Phase 12 — Deep Conversational Operations
-- =========================================================

-- 1. wa_identities: maps WhatsApp phone -> MoodPlay user
CREATE TABLE public.wa_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  default_arena_id uuid REFERENCES public.arenas(id),
  default_profile_type text NOT NULL CHECK (default_profile_type IN
    ('arena','organizer','athlete','company','tenant','admin')),
  verified_at timestamptz,
  verification_code text,
  verification_expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_identities_phone_unique UNIQUE (wa_phone)
);

CREATE INDEX idx_wa_identities_user ON public.wa_identities(user_id);
CREATE INDEX idx_wa_identities_phone_verified ON public.wa_identities(wa_phone)
  WHERE verified_at IS NOT NULL;

ALTER TABLE public.wa_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_identities self read"
  ON public.wa_identities FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "wa_identities self insert"
  ON public.wa_identities FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "wa_identities self update"
  ON public.wa_identities FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "wa_identities self delete"
  ON public.wa_identities FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER trg_wa_identities_updated_at
  BEFORE UPDATE ON public.wa_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. conversational_commands: command history / audit trail
CREATE TABLE public.conversational_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid REFERENCES public.arenas(id),
  user_id uuid REFERENCES auth.users(id),
  channel text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp','qr','dashboard_cta','api')),
  profile_type text NOT NULL,
  input_text text NOT NULL,
  parsed_intent jsonb,
  orkym_request_id text,
  orkym_correlation_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','executed','failed','no_action','rate_limited','identity_required')),
  result_payload jsonb,
  error_message text,
  proposal_ids uuid[] NOT NULL DEFAULT '{}',
  response_text text,
  shortcode text,
  qr_token uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_cc_tenant ON public.conversational_commands(tenant_id, created_at DESC);
CREATE INDEX idx_cc_user ON public.conversational_commands(user_id, created_at DESC);
CREATE INDEX idx_cc_arena ON public.conversational_commands(arena_id, created_at DESC)
  WHERE arena_id IS NOT NULL;
CREATE INDEX idx_cc_shortcode ON public.conversational_commands(shortcode)
  WHERE shortcode IS NOT NULL;
CREATE INDEX idx_cc_status_created ON public.conversational_commands(status, created_at DESC);

ALTER TABLE public.conversational_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc scoped read"
  ON public.conversational_commands FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
  );

-- INSERT/UPDATE/DELETE blocked from clients (only service role from edge functions)


-- 3. wa_qr_tokens: signed deep links, single-use, short TTL
CREATE TABLE public.wa_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  intent text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid REFERENCES public.arenas(id),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_token_active ON public.wa_qr_tokens(token)
  WHERE consumed_at IS NULL;
CREATE INDEX idx_qr_creator ON public.wa_qr_tokens(created_by, created_at DESC);

ALTER TABLE public.wa_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr scoped read"
  ON public.wa_qr_tokens FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
  );


-- 4. RPC: register WhatsApp identity (generates 6-digit code, idempotent)
CREATE OR REPLACE FUNCTION public.wa_register_identity(
  _phone text,
  _profile text DEFAULT 'athlete'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_phone text;
  v_code text;
  v_existing_user uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  v_phone := regexp_replace(COALESCE(_phone,''), '\D', '', 'g');
  IF length(v_phone) < 10 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF _profile NOT IN ('arena','organizer','athlete','company','tenant','admin') THEN
    RAISE EXCEPTION 'invalid_profile_type';
  END IF;

  -- Block if phone already verified for another user
  SELECT user_id INTO v_existing_user
    FROM public.wa_identities
   WHERE wa_phone = v_phone AND verified_at IS NOT NULL
   LIMIT 1;

  IF v_existing_user IS NOT NULL AND v_existing_user <> v_user THEN
    RAISE EXCEPTION 'phone_taken';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO public.wa_identities (
    wa_phone, user_id, default_profile_type,
    verification_code, verification_expires_at
  ) VALUES (
    v_phone, v_user, _profile,
    v_code, now() + interval '10 minutes'
  )
  ON CONFLICT (wa_phone) DO UPDATE
    SET default_profile_type = EXCLUDED.default_profile_type,
        verification_code = EXCLUDED.verification_code,
        verification_expires_at = EXCLUDED.verification_expires_at,
        updated_at = now()
    WHERE public.wa_identities.user_id = v_user;

  RETURN jsonb_build_object(
    'success', true,
    'phone', v_phone,
    'verification_code', v_code,
    'expires_at', now() + interval '10 minutes'
  );
END $$;


-- 5. RPC: verify WhatsApp identity
CREATE OR REPLACE FUNCTION public.wa_verify_identity(
  _phone text,
  _code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_phone text;
  v_row record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  v_phone := regexp_replace(COALESCE(_phone,''), '\D', '', 'g');

  SELECT * INTO v_row FROM public.wa_identities
   WHERE wa_phone = v_phone AND user_id = v_user
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'identity_not_found');
  END IF;

  IF v_row.verified_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_verified', true);
  END IF;

  IF v_row.verification_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  IF v_row.verification_code <> _code THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.wa_identities
     SET verified_at = now(),
         verification_code = NULL,
         verification_expires_at = NULL,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'verified_at', now());
END $$;


-- 6. RPC: create QR token (security-checked)
CREATE OR REPLACE FUNCTION public.wa_create_qr_token(
  _intent text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _arena_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _ttl_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_token uuid := gen_random_uuid();
  v_ttl int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _intent IS NULL OR length(trim(_intent)) = 0 THEN RAISE EXCEPTION 'intent_required'; END IF;

  v_ttl := LEAST(GREATEST(COALESCE(_ttl_minutes, 30), 1), 60);

  -- Permission gate
  IF _arena_id IS NOT NULL THEN
    IF NOT (public.is_arena_owner(_arena_id, v_user)
         OR public.is_admin(v_user)
         OR (_tenant_id IS NOT NULL AND public.is_tenant_admin(_tenant_id, v_user))) THEN
      RAISE EXCEPTION 'forbidden_arena';
    END IF;
  ELSIF _tenant_id IS NOT NULL THEN
    IF NOT (public.is_tenant_admin(_tenant_id, v_user) OR public.is_admin(v_user)) THEN
      RAISE EXCEPTION 'forbidden_tenant';
    END IF;
  END IF;
  -- Athlete-scoped intents (no arena_id, no tenant_id) are OK for any auth user

  INSERT INTO public.wa_qr_tokens (
    token, intent, payload, arena_id, tenant_id, created_by, expires_at
  ) VALUES (
    v_token, _intent, COALESCE(_payload, '{}'::jsonb),
    _arena_id, _tenant_id, v_user,
    now() + (v_ttl || ' minutes')::interval
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'expires_at', now() + (v_ttl || ' minutes')::interval,
    'short_token', substring(v_token::text, 1, 8)
  );
END $$;


-- 7. RPC: consume QR token (called by service-role from wa-bridge)
CREATE OR REPLACE FUNCTION public.wa_consume_qr_token(
  _token uuid,
  _consumer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT * INTO v_row FROM public.wa_qr_tokens
   WHERE token = _token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_row.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_consumed');
  END IF;
  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  UPDATE public.wa_qr_tokens
     SET consumed_at = now(), consumed_by = _consumer_user_id
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'intent', v_row.intent,
    'payload', v_row.payload,
    'arena_id', v_row.arena_id,
    'tenant_id', v_row.tenant_id
  );
END $$;


-- 8. RPC: shortcode lookup (used by wa-bridge to resolve dashboard CTAs)
CREATE OR REPLACE FUNCTION public.wa_resolve_shortcode(_shortcode text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.conversational_commands
   WHERE shortcode = _shortcode
     AND status = 'pending'
     AND created_at > now() - interval '2 hours'
   ORDER BY created_at DESC
   LIMIT 1
$$;