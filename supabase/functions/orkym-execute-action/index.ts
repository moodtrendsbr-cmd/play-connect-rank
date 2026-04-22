import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchAction } from "../_shared/orkym-handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * ORKYM Execute Action — Phase 8
 * Executes an approved action proposal by dispatching to internal handlers
 * that REUSE existing flows (tasks/occurrences/billing/ads). No new engines.
 */

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkPermission(
  admin: any,
  userId: string,
  proposal: any,
): Promise<boolean> {
  // admin global
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
  if (isAdmin) return true;

  // tenant_admin
  const { data: isTenantAdmin } = await admin.rpc("is_tenant_admin", {
    _tenant_id: proposal.tenant_id,
    _user_id: userId,
  });
  if (isTenantAdmin) {
    // propose_promotion exige tenant_admin OU admin → ok aqui
    return true;
  }

  // arena_owner
  if (proposal.arena_id) {
    const { data: isOwner } = await admin.rpc("is_arena_owner", {
      _arena_id: proposal.arena_id,
      _user_id: userId,
    });
    if (isOwner) {
      // arena_owner não pode aprovar propose_promotion (governança §4)
      if (proposal.action_type === "propose_promotion") return false;
      return true;
    }
  }
  return false;
}

// =======================================================
// HANDLERS — cada um reusa estruturas existentes
// =======================================================
async function handleAction(admin: any, p: any): Promise<{ ok: boolean; result?: any; error?: string }> {
  const payload = p.proposed_payload ?? {};
  const baseTask = {
    tenant_id: p.tenant_id,
    arena_id: p.arena_id,
    title: p.title,
    description: p.description,
    priority: p.priority === "high" ? 1 : p.priority === "medium" ? 2 : 3,
    source: "orkym",
    correlation_id: p.correlation_id,
    related_entity_type: p.related_entity_type,
    related_entity_id: p.related_entity_id,
    metadata: { proposal_id: p.id, action_type: p.action_type, ...(payload.metadata ?? {}) },
  };

  switch (p.action_type) {
    case "create_followup":
    case "open_communication_thread":
    case "recovery_campaign_draft": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const taskType =
        p.action_type === "open_communication_thread" ? "outreach"
        : p.action_type === "recovery_campaign_draft" ? "recovery"
        : "followup";
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: taskType })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { task_id: data.id, kind: "task" } };
    }
    case "create_reminder":
    case "schedule_operational_review": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const dueAt = payload.due_at ?? new Date(Date.now() + 24 * 3600_000).toISOString();
      const taskType = p.action_type === "schedule_operational_review" ? "review" : "reminder";
      const priority = p.action_type === "schedule_operational_review" ? 1 : baseTask.priority;
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: taskType, priority, due_at: dueAt })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { task_id: data.id, due_at: dueAt } };
    }
    case "flag_enrollment_attention": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      // marca enrollment + cria task
      if (p.related_entity_type === "enrollment" && p.related_entity_id) {
        await admin
          .from("arena_class_enrollments")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", p.related_entity_id);
      }
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: "enrollment_attention" })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { task_id: data.id, flagged_enrollment: p.related_entity_id } };
    }
    case "create_occurrence": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const { data, error } = await admin
        .from("arena_occurrences")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          title: p.title,
          description: p.description,
          severity: payload.severity ?? "medium",
          category: payload.category ?? "general",
          status: "open",
          related_entity_type: p.related_entity_type,
          related_entity_id: p.related_entity_id,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { occurrence_id: data.id } };
    }
    case "propose_manual_charge": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const subId = payload.subscription_id;
      if (!subId) return { ok: false, error: "subscription_id_required" };
      // Reusa a função existente
      const { data, error } = await admin.rpc("arena_generate_billing_cycle", {
        _subscription_id: subId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { billing_cycle_id: data, proposed_by: "orkym" } };
    }
    case "propose_promotion": {
      const { data, error } = await admin
        .from("ad_campaigns")
        .insert({
          tenant_id: p.tenant_id,
          company_id: payload.company_id,
          name: p.title,
          title: p.title,
          kind: payload.kind ?? "feed",
          status: "pending",
          priority: 5,
          budget: payload.budget ?? 0,
          target_type: payload.target_type ?? null,
          target_id: payload.target_id ?? null,
          starts_at: payload.starts_at ?? new Date().toISOString(),
          ends_at: payload.ends_at ?? new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { ad_campaign_id: data.id, status: "pending" } };
    }
    default:
      return { ok: false, error: `unknown_action_type:${p.action_type}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return safeJson({ ok: false, error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claims?.claims) {
      return safeJson({ ok: false, error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const proposalId = body?.proposal_id;
    const isAutoDispatch = body?.auto_dispatch === true;
    if (!proposalId) return safeJson({ ok: false, error: "proposal_id_required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carrega proposal
    const { data: proposal, error: pErr } = await admin
      .from("orkym_action_proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();
    if (pErr || !proposal) return safeJson({ ok: false, error: "proposal_not_found" }, 404);

    // Phase 9: re-check execution_mode (defesa em profundidade)
    if (proposal.execution_mode === "suggest") {
      return safeJson({ ok: false, error: "suggest_mode_not_executable" }, 400);
    }

    // Phase 9: re-verificar kill switch antes de executar
    const { data: killActive } = await admin
      .from("autonomy_kill_switches")
      .select("id")
      .eq("is_active", true)
      .or([
        `scope_level.eq.global`,
        `and(scope_level.eq.tenant,tenant_id.eq.${proposal.tenant_id})`,
        proposal.arena_id ? `and(scope_level.eq.arena,arena_id.eq.${proposal.arena_id})` : "",
        `and(scope_level.eq.action_type,action_type.eq.${proposal.action_type})`,
      ].filter(Boolean).join(","))
      .limit(1)
      .maybeSingle();
    if (killActive) {
      await admin.rpc("orkym_action_mark_failed", {
        _proposal_id: proposalId,
        _reason: "kill_switch_activated",
        _executed_by: isAutoDispatch ? null : userId,
        _duration_ms: 0,
      });
      return safeJson({ ok: false, status: "canceled", error: "kill_switch_activated" });
    }

    // Permissão (auto dispatch usa service role e pula check)
    if (!isAutoDispatch) {
      const allowed = await checkPermission(admin, userId, proposal);
      if (!allowed) return safeJson({ ok: false, error: "forbidden" }, 403);
    }

    // Phase 10: re-check de quota auto-actions em runtime (defesa em profundidade)
    if (proposal.execution_mode === "auto" && !proposal.auto_executed) {
      try {
        const { data: q } = await admin.rpc("orkym_check_quota", {
          _tenant: proposal.tenant_id,
          _kind: "auto_actions",
        });
        const row = Array.isArray(q) ? q[0] : q;
        if (row && row.allowed === false) {
          await admin
            .from("orkym_action_proposals")
            .update({
              status: "canceled",
              failure_reason: "quota_exhausted_runtime",
              updated_at: new Date().toISOString(),
            })
            .eq("id", proposalId);
          await admin.rpc("orkym_increment_usage", {
            _tenant: proposal.tenant_id,
            _calls: 0, _suggestions: 0, _proposed: 0, _auto: 0,
            _approved: 0, _rejected: 0, _blocked: 1, _time_saved: 0,
          });
          return safeJson({
            ok: false,
            status: "canceled",
            error: "quota_exhausted_runtime",
            tier: row.tier,
            limit: row.limit_value,
            current: row.current,
          });
        }
      } catch (e) {
        console.warn("quota recheck failed", e);
      }
    }

    // CAS approved → executing
    const { data: marked, error: markErr } = await admin.rpc("orkym_action_mark_executing", {
      _proposal_id: proposalId,
    });
    if (markErr) return safeJson({ ok: false, error: markErr.message }, 500);
    if (!marked) return safeJson({ ok: false, error: "already_executing_or_invalid_state" }, 409);

    // Dispatch
    const result = await handleAction(admin, proposal);
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      await admin.rpc("orkym_action_mark_failed", {
        _proposal_id: proposalId,
        _reason: result.error ?? "unknown",
        _executed_by: userId,
        _duration_ms: durationMs,
      });
      if (proposal.arena_id) {
        await admin.from("arena_operational_events").insert({
          tenant_id: proposal.tenant_id,
          arena_id: proposal.arena_id,
          entity_type: "orkym_action",
          entity_id: proposalId,
          event_type: "orkym.action_failed",
          payload: { action_type: proposal.action_type, reason: result.error },
          source: "system",
        });
      }
      return safeJson({ ok: false, status: "failed", error: result.error });
    }

    await admin.rpc("orkym_action_mark_executed", {
      _proposal_id: proposalId,
      _result: result.result ?? {},
      _executed_by: isAutoDispatch ? null : userId,
      _duration_ms: durationMs,
    });
    // Phase 9: marca auto_executed se for execução automática
    if (isAutoDispatch || proposal.execution_mode === "auto") {
      await admin.from("orkym_action_proposals")
        .update({ auto_executed: true })
        .eq("id", proposalId);
      // Phase 10: track auto execution + manual approval counters
      try {
        await admin.rpc("orkym_increment_usage", {
          _tenant: proposal.tenant_id,
          _calls: 0, _suggestions: 0, _proposed: 0,
          _auto: 1, _approved: 0, _rejected: 0, _blocked: 0,
          _time_saved: 5,
        });
      } catch (e) { console.warn("usage increment failed", e); }
    } else {
      // Approved + executed manualmente
      try {
        await admin.rpc("orkym_increment_usage", {
          _tenant: proposal.tenant_id,
          _calls: 0, _suggestions: 0, _proposed: 0,
          _auto: 0, _approved: 1, _rejected: 0, _blocked: 0,
          _time_saved: 2,
        });
      } catch (e) { console.warn("usage increment failed", e); }
    }
    if (proposal.arena_id) {
      await admin.from("arena_operational_events").insert({
        tenant_id: proposal.tenant_id,
        arena_id: proposal.arena_id,
        entity_type: "orkym_action",
        entity_id: proposalId,
        event_type: "orkym.action_executed",
        payload: { action_type: proposal.action_type, result: result.result, auto: isAutoDispatch },
        source: "system",
      });
    }
    return safeJson({ ok: true, status: "executed", result: result.result, auto: isAutoDispatch });
  } catch (err: any) {
    return safeJson({ ok: false, error: err?.message ?? "internal" }, 500);
  }
});
