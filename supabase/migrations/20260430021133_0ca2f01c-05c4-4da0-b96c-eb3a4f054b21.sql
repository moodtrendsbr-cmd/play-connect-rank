ALTER TABLE public.conversational_commands
  DROP CONSTRAINT IF EXISTS conversational_commands_status_check;

ALTER TABLE public.conversational_commands
  ADD CONSTRAINT conversational_commands_status_check CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'dispatched'::text,
      'executed'::text,
      'failed'::text,
      'no_action'::text,
      'rate_limited'::text,
      'identity_required'::text,
      'pending_action_consumed'::text
    ])
  );

CREATE INDEX IF NOT EXISTS idx_cc_pending_action
  ON public.conversational_commands (user_id, created_at DESC)
  WHERE direction = 'outbound'
    AND initiated_by = 'orkym'
    AND status <> 'pending_action_consumed'
    AND parsed_intent IS NOT NULL;