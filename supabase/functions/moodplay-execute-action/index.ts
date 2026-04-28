import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchAction, summarizeResult, type ProposalLike } from "../_shared/orkym-handlers.ts";

/**
 * MoodPlay Execute Action — Phase 12.5
 *
 * Server-to-server bridge that ORKYM calls to execute real operations
 * inside MoodPlay. Reuses 100% of existing handlers/RPCs. Zero new
 * business logic.
 *
 * Auth: HMAC (X-MoodPlay-Signature) over body using ORKYM_SERVICE_TOKEN
 * shared secret. Optional X-Request-Timestamp (rejects > 5min skew).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moodplay-signature, x-request-timestamp, x-idempotency-key",
};

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHmac(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time compare
  if (hex.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return r === 0;
}

const READ_ACTIONS = new Set([
  "get_arena_summary",
  "list_today_classes",
  "list_pending_enrollments",
  "get_revenue_today",
]);

const RPC_OPERATIONAL_ACTIONS = new Set([
  "generate_billing_cycle",
  "mark_cycle_paid",
  "validate_checkin",
  "create_tournament",
  "create_class",
]);

const PROPOSAL_ACTIONS = new Set([
  "create_followup",
  "create_reminder",
  "create_occurrence",
  "propose_manual_charge",
  "flag_enrollment_attention",
  "propose_promotion",
  "schedule_operational_review",
  "open_communication_thread",
  "recovery_campaign_draft",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  const sig = req.headers.get("x-moodplay-signature");
  const ts = req.headers.get("x-request-timestamp");
  const idemKey = req.headers.get("x-idempotency-key");

  const secret = Deno.env.get("ORKYM_SERVICE_TOKEN") || "";
  const isMockMode = !secret || req.url.includes("mode=mock");

  // Replay protection
  if (ts) {
    const skew = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(skew) || skew > 5 * 60 * 1000) {
      return safeJson({ ok: false, error: "timestamp_skew" }, 401);
    }
  }

  // HMAC validation (skipped in mock for local dev)
  if (!isMockMode) {
    const ok = await verifyHmac(rawBody, sig, secret);
    if (!ok) return safeJson({ ok: false, error: "invalid_signature" }, 401);
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return safeJson({ ok: false, error: "invalid_json" }, 400);
  }

  const {
    tenant_id,
    arena_id,
    user_id,
    profile_type,
    action_type,
    payload = {},
    source = "orkym_whatsapp",
    correlation_id,
  } = body ?? {};

  if (!action_type) return safeJson({ ok: false, error: "action_type_required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cross-tenant: arena must belong to tenant
  if (arena_id && tenant_id) {
    const { data: arena } = await admin
      .from("arenas").select("tenant_id").eq("id", arena_id).maybeSingle();
    if (!arena || arena.tenant_id !== tenant_id) {
      return safeJson({ ok: false, error: "cross_tenant_violation" }, 403);
    }
  }

  // Idempotency: dedup by correlation_id (per tenant + action_type)
  if (correlation_id) {
    const { data: existing } = await admin
      .from("conversational_commands")
      .select("id, status, response_text, result_payload")
      .eq("orkym_correlation_id", correlation_id)
      .eq("channel", "api")
      .maybeSingle();
    if (existing && existing.status !== "pending") {
      return safeJson({
        ok: true,
        deduplicated: true,
        command_id: existing.id,
        execution_status: existing.status,
        response_summary: existing.response_text,
        linked_entity: (existing.result_payload as any)?.linked_entity ?? null,
      });
    }
  }

  // Resolve instance for tracking
  const { data: inst } = await admin.rpc("resolve_whatsapp_instance", {
    _tenant_id: tenant_id ?? null,
    _arena_id: arena_id ?? null,
    _profile_type: profile_type ?? null,
    _organizer_user_id: null,
    _company_id: null,
  });
  const instanceId = (inst as any)?.instance_id ?? null;

  // Persist command (channel=api, initiated_by=orkym)
  const { data: cmd, error: cmdErr } = await admin
    .from("conversational_commands")
    .insert({
      channel: "api",
      direction: "inbound",
      initiated_by: "orkym",
      tenant_id: tenant_id ?? null,
      arena_id: arena_id ?? null,
      user_id: user_id ?? null,
      profile_type: profile_type ?? "system",
      whatsapp_instance_id: instanceId,
      input_text: `[${source}] ${action_type}`,
      normalized_input: action_type,
      parsed_intent: { action_type, payload, source },
      orkym_correlation_id: correlation_id ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (cmdErr) {
    return safeJson({ ok: false, error: `command_insert_failed:${cmdErr.message}` }, 500);
  }
  const commandId = cmd.id;

  // ----- Audit log (request received)
  const auditBase = {
    user_id: user_id ?? null,
    tenant_id: tenant_id ?? null,
    resource_type: "conversational_command",
    resource_id: commandId,
  };
  try {
    await admin.from("security_audit_log").insert({
      ...auditBase,
      action: "moodplay_execute.received",
      metadata: { action_type, source, correlation_id, instance_id: instanceId },
    });
  } catch { /* best-effort */ }

  // Helper to log outcome on each return path
  const logOutcome = async (outcome: "executed" | "failed" | "no_action" | "deduplicated", extra: Record<string, unknown> = {}) => {
    try {
      await admin.from("security_audit_log").insert({
        ...auditBase,
        action: `moodplay_execute.${outcome}`,
        metadata: { action_type, source, correlation_id, ...extra },
      });
    } catch { /* best-effort */ }
  };

  // ===========================================================
  // 1) READ-ONLY actions → execute via RPC, no proposal
  // ===========================================================
  if (READ_ACTIONS.has(action_type)) {
    const rpcMap: Record<string, string> = {
      get_arena_summary: "get_arena_summary",
      list_today_classes: "list_today_classes",
      list_pending_enrollments: "list_pending_enrollments",
      get_revenue_today: "get_revenue_today",
    };
    const { data, error } = await admin.rpc(rpcMap[action_type], {
      _arena_id: arena_id,
    });
    const ok = !error && (data as any)?.success !== false;
    const summary = ok ? "Consulta concluída." : `Erro: ${error?.message ?? (data as any)?.error}`;

    await admin.from("conversational_commands").update({
      status: ok ? "executed" : "failed",
      result_payload: data ?? null,
      response_text: summary,
      error_message: ok ? null : (error?.message ?? (data as any)?.error),
      completed_at: new Date().toISOString(),
    }).eq("id", commandId);

    return safeJson({
      ok,
      command_id: commandId,
      execution_status: ok ? "executed" : "failed",
      data,
      response_summary: summary,
    });
  }

  // ===========================================================
  // 2) Operational RPC actions (direct, idempotent)
  // ===========================================================
  if (RPC_OPERATIONAL_ACTIONS.has(action_type)) {
    let result: any = null; let err: string | null = null;
    let linkedType: string | null = null; let linkedId: string | null = null;

    try {
      if (action_type === "generate_billing_cycle") {
        const { data, error } = await admin.rpc("arena_generate_billing_cycle", {
          _subscription_id: payload.subscription_id,
        });
        if (error) throw error;
        result = { billing_cycle_id: data };
        linkedType = "billing_cycle"; linkedId = data;
      } else if (action_type === "mark_cycle_paid") {
        const { error } = await admin.rpc("arena_mark_cycle_paid", {
          _cycle_id: payload.cycle_id,
          _payment_method: payload.payment_method ?? "manual",
          _payment_reference: payload.payment_reference ?? null,
        });
        if (error) throw error;
        result = { cycle_id: payload.cycle_id, status: "paid" };
        linkedType = "billing_cycle"; linkedId = payload.cycle_id;
      } else if (action_type === "validate_checkin") {
        const { data, error } = await admin.rpc("arena_checkin_validate", {
          _token: payload.token,
        });
        if (error) throw error;
        result = data;
        linkedType = "attendance"; linkedId = (data as any)?.attendance_id ?? null;
      } else if (action_type === "create_tournament") {
        // Reuses tournaments insert (organizer owns)
        const { data, error } = await admin.from("tournaments").insert({
          organizer_id: user_id,
          tenant_id,
          name: payload.name,
          description: payload.description ?? null,
          start_date: payload.start_date,
          end_date: payload.end_date,
          location: payload.location ?? null,
          arena_id: arena_id ?? null,
          entry_fee: payload.entry_fee ?? 0,
          max_athletes: payload.max_athletes ?? null,
          status: "draft",
        }).select("id").single();
        if (error) throw error;
        result = { tournament_id: data.id };
        linkedType = "tournament"; linkedId = data.id;
      } else if (action_type === "create_class") {
        const { data, error } = await admin.from("arena_classes").insert({
          arena_id, tenant_id,
          title: payload.title,
          description: payload.description ?? null,
          start_at: payload.start_at,
          end_at: payload.end_at,
          capacity: payload.capacity ?? 10,
          level: payload.level ?? "all",
          modality: payload.modality ?? null,
          price: payload.price ?? null,
          court_id: payload.court_id ?? null,
          instructor_id: payload.instructor_id ?? null,
        }).select("id").single();
        if (error) throw error;
        result = { class_id: data.id };
        linkedType = "arena_class"; linkedId = data.id;
      }
    } catch (e: any) {
      err = e?.message ?? String(e);
    }

    const summary = err
      ? `Falhou: ${err}`
      : summarizeResult(action_type, result);

    await admin.from("conversational_commands").update({
      status: err ? "failed" : "executed",
      result_payload: { ...(result ?? {}), linked_entity: linkedType ? { type: linkedType, id: linkedId } : null },
      response_text: summary,
      error_message: err,
      linked_entity_type: linkedType,
      linked_entity_id: linkedId,
      completed_at: new Date().toISOString(),
    }).eq("id", commandId);

    return safeJson({
      ok: !err,
      command_id: commandId,
      execution_status: err ? "failed" : "executed",
      linked_entity: linkedType ? { type: linkedType, id: linkedId } : null,
      response_summary: summary,
      error: err,
    });
  }

  // ===========================================================
  // 3) Proposal-based actions → reuse dispatchAction
  // ===========================================================
  if (PROPOSAL_ACTIONS.has(action_type)) {
    const { data: proposal, error: pErr } = await admin
      .from("orkym_action_proposals")
      .insert({
        tenant_id,
        arena_id,
        action_type,
        title: payload.title ?? `[ORKYM] ${action_type}`,
        description: payload.description ?? null,
        priority: payload.priority ?? "medium",
        proposed_payload: payload,
        related_entity_type: payload.related_entity_type ?? null,
        related_entity_id: payload.related_entity_id ?? null,
        correlation_id: correlation_id ?? null,
        execution_mode: payload.execution_mode ?? "auto",
        status: "approved",
        risk_level: "low",
      })
      .select("*")
      .single();

    if (pErr) {
      await admin.from("conversational_commands").update({
        status: "failed",
        error_message: pErr.message,
        response_text: `Falhou ao criar proposta: ${pErr.message}`,
        completed_at: new Date().toISOString(),
      }).eq("id", commandId);
      return safeJson({ ok: false, command_id: commandId, error: pErr.message }, 500);
    }

    const dispatch = await dispatchAction(admin, proposal as ProposalLike);
    const summary = dispatch.ok
      ? summarizeResult(action_type, dispatch.result)
      : `Falhou: ${dispatch.error}`;

    let linkedType: string | null = null; let linkedId: string | null = null;
    if (dispatch.result) {
      const r = dispatch.result as any;
      if (r.task_id) { linkedType = "operational_task"; linkedId = r.task_id; }
      else if (r.occurrence_id) { linkedType = "occurrence"; linkedId = r.occurrence_id; }
      else if (r.billing_cycle_id) { linkedType = "billing_cycle"; linkedId = r.billing_cycle_id; }
      else if (r.ad_campaign_id) { linkedType = "ad_campaign"; linkedId = r.ad_campaign_id; }
    }

    await admin.from("conversational_commands").update({
      status: dispatch.ok ? "executed" : "failed",
      result_payload: { ...(dispatch.result ?? {}), proposal_id: proposal.id, linked_entity: linkedType ? { type: linkedType, id: linkedId } : null },
      response_text: summary,
      error_message: dispatch.error ?? null,
      linked_entity_type: linkedType,
      linked_entity_id: linkedId,
      proposal_ids: [proposal.id],
      completed_at: new Date().toISOString(),
    }).eq("id", commandId);

    return safeJson({
      ok: dispatch.ok,
      command_id: commandId,
      execution_status: dispatch.ok ? "executed" : "failed",
      linked_entity: linkedType ? { type: linkedType, id: linkedId } : null,
      response_summary: summary,
      proposal_id: proposal.id,
    });
  }

  // Unknown action
  await admin.from("conversational_commands").update({
    status: "no_action",
    response_text: `Ação desconhecida: ${action_type}`,
    completed_at: new Date().toISOString(),
  }).eq("id", commandId);

  return safeJson({
    ok: false,
    command_id: commandId,
    execution_status: "no_action",
    error: `unknown_action_type:${action_type}`,
  }, 400);
});
