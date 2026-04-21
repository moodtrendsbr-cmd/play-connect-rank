CREATE OR REPLACE FUNCTION public.orkym_ingest_actions(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := (_payload->>'tenant_id')::uuid;
  v_arena  uuid := NULLIF(_payload->>'arena_id','')::uuid;
  v_req    text := _payload->>'request_id';
  v_corr   text := _payload->>'correlation_id';
  v_actions jsonb := COALESCE(_payload->'actions', '[]'::jsonb);
  v_action jsonb;
  v_count int := 0;
  v_atype text;
  v_domain text;
  v_allowed text[] := ARRAY[
    'create_followup','create_reminder','create_occurrence',
    'propose_manual_charge','flag_enrollment_attention','propose_promotion',
    'schedule_operational_review','open_communication_thread','recovery_campaign_draft'
  ];
  v_blocked text[] := ARRAY[
    'refund','cancel_payment','change_split','delete_user','delete_arena',
    'delete_tenant','suspend_user','automatic_charge','force_block'
  ];
  v_human jsonb;
  v_proposed jsonb;
  v_resolved record;
  v_guardrail record;
  v_final_mode text;
  v_final_source text;
  v_guardrail_block text;
  v_policy_id uuid;
  v_initial_status text;
  v_status text;
  v_proposal_id uuid;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_id_required'; END IF;

  FOR v_action IN SELECT * FROM jsonb_array_elements(v_actions) LOOP
    v_atype  := v_action->>'action_type';
    v_domain := COALESCE(v_action->>'domain','arena_operations');

    -- Hard allowlist + blocklist
    IF v_atype IS NULL OR NOT (v_atype = ANY(v_allowed)) OR (v_atype = ANY(v_blocked)) THEN
      CONTINUE;
    END IF;

    v_proposed := COALESCE(v_action->'proposed_payload','{}'::jsonb);
    -- Sanitize human_summary
    v_human := jsonb_build_object(
      'title', v_action->>'title',
      'description', v_action->>'description',
      'related_entity_type', v_action->>'related_entity_type',
      'related_entity_id',   v_action->>'related_entity_id',
      'priority', COALESCE(v_action->>'priority','medium')
    );

    -- Resolve policy
    SELECT * INTO v_resolved FROM public.autonomy_resolve_policy(
      v_tenant, v_arena, v_domain, v_atype
    );
    v_final_mode   := v_resolved.execution_mode;
    v_final_source := v_resolved.policy_source;
    v_policy_id    := v_resolved.policy_id;
    v_guardrail_block := NULL;

    -- Guardrails só se mode='auto'
    IF v_final_mode = 'auto' THEN
      SELECT * INTO v_guardrail FROM public.autonomy_check_guardrails(
        v_tenant, v_arena, v_atype, v_proposed,
        COALESCE((SELECT conditions FROM public.autonomy_policies WHERE id = v_policy_id), '{}'::jsonb)
      );
      IF NOT v_guardrail.allowed THEN
        v_final_mode := 'approve';
        v_final_source := 'guardrail_block';
        v_guardrail_block := v_guardrail.reason;
      END IF;
    END IF;

    -- Determine initial status
    IF v_final_mode = 'suggest' THEN
      v_status := 'canceled';
      v_initial_status := 'suggest';
    ELSIF v_final_mode = 'auto' THEN
      v_status := 'approved';
      v_initial_status := 'auto';
    ELSE
      v_status := 'proposed';
      v_initial_status := 'approve';
    END IF;

    -- INSERT proposal
    INSERT INTO public.orkym_action_proposals (
      tenant_id, arena_id, domain, action_type, title, description,
      priority, status, related_entity_type, related_entity_id,
      proposed_payload, human_summary, source,
      orkym_request_id, correlation_id,
      execution_mode, policy_id, policy_source, initial_status, auto_executed
    ) VALUES (
      v_tenant, v_arena, v_domain, v_atype,
      v_action->>'title',
      v_action->>'description',
      COALESCE(v_action->>'priority','medium'),
      v_status,
      v_action->>'related_entity_type',
      NULLIF(v_action->>'related_entity_id','')::uuid,
      v_proposed,
      v_human,
      'orkym',
      v_req,
      v_corr,
      v_final_mode, v_policy_id, v_final_source, v_initial_status, false
    )
    ON CONFLICT (orkym_request_id, action_type, related_entity_id) DO NOTHING
    RETURNING id INTO v_proposal_id;

    IF v_proposal_id IS NOT NULL THEN
      v_count := v_count + 1;
      -- Log decision
      PERFORM public.autonomy_log_decision(
        v_proposal_id, v_tenant, v_arena, v_domain, v_atype,
        v_final_mode, v_policy_id, v_final_source, v_guardrail_block,
        jsonb_build_object('correlation_id', v_corr, 'request_id', v_req)
      );
    END IF;
  END LOOP;

  RETURN v_count;
END $$;