DROP VIEW IF EXISTS public.v_autonomy_metrics;
CREATE VIEW public.v_autonomy_metrics
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', l.created_at)::date AS day,
  l.tenant_id,
  l.action_type,
  l.resolved_mode,
  count(*) AS total,
  count(*) FILTER (WHERE l.resolved_mode = 'auto') AS auto_count,
  count(*) FILTER (WHERE l.resolved_mode = 'approve') AS approve_count,
  count(*) FILTER (WHERE l.resolved_mode = 'suggest') AS suggest_count,
  count(*) FILTER (WHERE l.guardrail_blocked IS NOT NULL) AS blocked_by_guardrail,
  count(*) FILTER (WHERE l.policy_source = 'kill_switch') AS blocked_by_kill_switch,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.orkym_action_proposals p
    WHERE p.id = l.proposal_id AND p.auto_executed = true
  )) AS auto_executed_count
FROM public.autonomy_policy_logs l
GROUP BY 1, 2, 3, 4;