
-- ============================================================
-- Phase 12.7 — conversation_sessions table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  arena_id uuid NULL,
  user_id uuid NOT NULL,
  profile_type text NOT NULL,
  whatsapp_instance_id uuid NOT NULL,

  current_intent text NOT NULL,
  state text NOT NULL DEFAULT 'collecting'
    CHECK (state IN ('collecting','confirming','executing','completed','abandoned','failed','superseded')),

  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot jsonb NULL,
  snapshot_hash text NULL,

  idempotency_key text NULL,
  execution_result jsonb NULL,
  command_id uuid NULL REFERENCES public.conversational_commands(id) ON DELETE SET NULL,

  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz NULL,
  locked_by text NULL,
  lock_expires_at timestamptz NULL,

  last_message_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  resumable_until timestamptz NULL,

  correlation_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_user_instance
  ON public.conversation_sessions (user_id, whatsapp_instance_id)
  WHERE state IN ('collecting','confirming');

CREATE INDEX IF NOT EXISTS idx_sessions_expires_active
  ON public.conversation_sessions (expires_at)
  WHERE state IN ('collecting','confirming');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_idempotency_key
  ON public.conversation_sessions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_tenant_created
  ON public.conversation_sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_resumable
  ON public.conversation_sessions (user_id, whatsapp_instance_id, resumable_until)
  WHERE state = 'abandoned' AND resumable_until IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_conversation_sessions_updated_at ON public.conversation_sessions;
CREATE TRIGGER trg_conversation_sessions_updated_at
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on conversation_sessions" ON public.conversation_sessions;
CREATE POLICY "Admin full access on conversation_sessions"
  ON public.conversation_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admin reads conversation_sessions" ON public.conversation_sessions;
CREATE POLICY "Tenant admin reads conversation_sessions"
  ON public.conversation_sessions
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Arena owner reads conversation_sessions" ON public.conversation_sessions;
CREATE POLICY "Arena owner reads conversation_sessions"
  ON public.conversation_sessions
  FOR SELECT TO authenticated
  USING (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()));

DROP POLICY IF EXISTS "User reads own conversation_sessions" ON public.conversation_sessions;
CREATE POLICY "User reads own conversation_sessions"
  ON public.conversation_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RPCs
-- ============================================================

-- Lock TTL (segundos) usado quando não informado
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_session_lock(
  _session_id uuid,
  _request_id text,
  _ttl_seconds int DEFAULT 30
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT id, is_locked, locked_by, lock_expires_at
    INTO v_row
    FROM public.conversation_sessions
   WHERE id = _session_id
   FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- já travada por outro request_id e ainda dentro do TTL → nega
  IF v_row.is_locked
     AND v_row.locked_by IS DISTINCT FROM _request_id
     AND COALESCE(v_row.lock_expires_at, now()) > now() THEN
    RETURN false;
  END IF;

  UPDATE public.conversation_sessions
     SET is_locked = true,
         locked_at = now(),
         locked_by = _request_id,
         lock_expires_at = now() + make_interval(secs => _ttl_seconds),
         updated_at = now()
   WHERE id = _session_id;

  RETURN true;
EXCEPTION
  WHEN lock_not_available THEN
    RETURN false;
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_session_lock(
  _session_id uuid,
  _request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_sessions
     SET is_locked = false,
         locked_at = NULL,
         locked_by = NULL,
         lock_expires_at = NULL,
         updated_at = now()
   WHERE id = _session_id
     AND locked_by = _request_id;
END $$;

-- ----------------------------------------------------
-- resolve_or_create_session
-- Retorna jsonb com a sessão + flags is_resumable e is_new
-- Se intent_in difere do current_intent → marca antiga superseded
-- e cria nova.
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_or_create_session(
  _tenant_id uuid,
  _arena_id uuid,
  _user_id uuid,
  _profile_type text,
  _whatsapp_instance_id uuid,
  _intent text,
  _ttl_minutes int DEFAULT 15,
  _resume_window_minutes int DEFAULT 30,
  _correlation_id text DEFAULT NULL,
  _allow_resume boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active record;
  v_resumable record;
  v_new_id uuid;
  v_is_new boolean := false;
  v_is_resumable boolean := false;
BEGIN
  -- 1. Procurar sessão ativa
  SELECT * INTO v_active
    FROM public.conversation_sessions
   WHERE user_id = _user_id
     AND whatsapp_instance_id = _whatsapp_instance_id
     AND state IN ('collecting','confirming')
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    -- multi-intent: ORKYM mandou intent diferente → encerra antiga
    IF _intent IS NOT NULL AND _intent <> v_active.current_intent THEN
      UPDATE public.conversation_sessions
         SET state = 'superseded',
             completed_at = now(),
             metadata = COALESCE(metadata,'{}'::jsonb)
                        || jsonb_build_object('superseded_by_intent', _intent),
             updated_at = now()
       WHERE id = v_active.id;
    ELSE
      -- mesma intent (ou intent não enviada) → reaproveita
      RETURN jsonb_build_object(
        'session', to_jsonb(v_active),
        'is_new', false,
        'is_resumable', false
      );
    END IF;
  END IF;

  -- 2. Se _allow_resume, tentar reabrir abandonada dentro da janela
  IF _allow_resume AND _intent IS NOT NULL THEN
    SELECT * INTO v_resumable
      FROM public.conversation_sessions
     WHERE user_id = _user_id
       AND whatsapp_instance_id = _whatsapp_instance_id
       AND state = 'abandoned'
       AND current_intent = _intent
       AND resumable_until IS NOT NULL
       AND resumable_until > now()
     ORDER BY created_at DESC
     LIMIT 1;

    IF FOUND THEN
      UPDATE public.conversation_sessions
         SET state = 'collecting',
             expires_at = now() + make_interval(mins => _ttl_minutes),
             resumable_until = NULL,
             last_message_at = now(),
             metadata = COALESCE(metadata,'{}'::jsonb)
                        || jsonb_build_object('resumed_at', now()),
             updated_at = now()
       WHERE id = v_resumable.id
       RETURNING * INTO v_resumable;

      RETURN jsonb_build_object(
        'session', to_jsonb(v_resumable),
        'is_new', false,
        'is_resumable', true
      );
    END IF;
  END IF;

  -- 3. Criar nova
  IF _intent IS NULL THEN
    RETURN jsonb_build_object(
      'session', NULL,
      'is_new', false,
      'is_resumable', false,
      'error', 'no_active_session_and_no_intent'
    );
  END IF;

  INSERT INTO public.conversation_sessions (
    tenant_id, arena_id, user_id, profile_type, whatsapp_instance_id,
    current_intent, state, expires_at, correlation_id
  ) VALUES (
    _tenant_id, _arena_id, _user_id, _profile_type, _whatsapp_instance_id,
    _intent, 'collecting',
    now() + make_interval(mins => _ttl_minutes),
    _correlation_id
  )
  RETURNING id INTO v_new_id;

  v_is_new := true;

  SELECT to_jsonb(s.*) INTO v_active
    FROM public.conversation_sessions s WHERE s.id = v_new_id;

  RETURN jsonb_build_object(
    'session', v_active,
    'is_new', true,
    'is_resumable', false
  );
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_session_context(
  _session_id uuid,
  _values jsonb,
  _ttl_minutes int DEFAULT 15
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_sessions
     SET context_data = COALESCE(context_data,'{}'::jsonb) || COALESCE(_values,'{}'::jsonb),
         last_message_at = now(),
         expires_at = now() + make_interval(mins => _ttl_minutes),
         updated_at = now()
   WHERE id = _session_id;
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.prepare_session_confirmation(
  _session_id uuid,
  _snapshot jsonb,
  _hash text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_sessions
     SET state = 'confirming',
         context_snapshot = _snapshot,
         snapshot_hash = _hash,
         last_message_at = now(),
         updated_at = now()
   WHERE id = _session_id
     AND state IN ('collecting','confirming');
END $$;

-- ----------------------------------------------------
-- mark_session_executing: idempotente.
-- Retorna { acquired: bool, existing_result: jsonb? }
-- - se idempotency_key já existe nesta sessão e está completed/failed
--   → retorna acquired=false + existing_result
-- - se em outra sessão → acquired=false + replay_blocked=true
-- - senão → marca executing e acquired=true
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_session_executing(
  _session_id uuid,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self record;
  v_other record;
BEGIN
  SELECT * INTO v_self
    FROM public.conversation_sessions
   WHERE id = _session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'error', 'session_not_found');
  END IF;

  -- replay no mesmo session: já executou → devolve resultado
  IF v_self.idempotency_key = _idempotency_key
     AND v_self.state IN ('completed','failed','executing') THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'replay', true,
      'state', v_self.state,
      'existing_result', v_self.execution_result
    );
  END IF;

  -- key colidindo em outra sessão
  SELECT id INTO v_other
    FROM public.conversation_sessions
   WHERE idempotency_key = _idempotency_key
     AND id <> _session_id
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'error', 'idempotency_key_taken');
  END IF;

  UPDATE public.conversation_sessions
     SET state = 'executing',
         idempotency_key = _idempotency_key,
         updated_at = now()
   WHERE id = _session_id;

  RETURN jsonb_build_object('acquired', true);
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_session(
  _session_id uuid,
  _result jsonb,
  _success boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_sessions
     SET state = CASE WHEN _success THEN 'completed' ELSE 'failed' END,
         execution_result = _result,
         completed_at = now(),
         is_locked = false,
         locked_at = NULL,
         locked_by = NULL,
         lock_expires_at = NULL,
         updated_at = now()
   WHERE id = _session_id;
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.abandon_session(
  _session_id uuid,
  _reason text DEFAULT 'user_aborted',
  _resume_window_minutes int DEFAULT 30
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_sessions
     SET state = 'abandoned',
         resumable_until = now() + make_interval(mins => _resume_window_minutes),
         metadata = COALESCE(metadata,'{}'::jsonb)
                    || jsonb_build_object('abandon_reason', _reason),
         is_locked = false,
         locked_at = NULL,
         locked_by = NULL,
         lock_expires_at = NULL,
         updated_at = now()
   WHERE id = _session_id;
END $$;

-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_sessions(
  _resume_window_minutes int DEFAULT 30
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.conversation_sessions
       SET state = 'abandoned',
           resumable_until = now() + make_interval(mins => _resume_window_minutes),
           metadata = COALESCE(metadata,'{}'::jsonb)
                      || jsonb_build_object('abandon_reason', 'expired'),
           is_locked = false,
           locked_at = NULL,
           locked_by = NULL,
           lock_expires_at = NULL,
           updated_at = now()
     WHERE state IN ('collecting','confirming')
       AND expires_at < now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $$;
