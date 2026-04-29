// orkym-proactive-process — Phase 12.9
// Internal-only worker. Pulls a batch of pending triggers, checks eligibility,
// asks ORKYM for the decision (orkym-invoke proactive/decide), and dispatches
// outbound WhatsApp via wa-send-message. All decisions stay in ORKYM; this
// function only orchestrates eligibility + cooldown + logging + feedback.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TOKEN = Deno.env.get("ORKYM_INTERNAL_TOKEN") || "";

interface QueueRow {
  id: string;
  tenant_id: string;
  arena_id: string | null;
  user_id: string | null;
  profile_type: string;
  trigger_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  priority: string;
  status: string;
  dedup_key: string | null;
  attempts: number;
}

const TRIGGER_TO_CATEGORY: Record<string, string> = {
  subscription_due: "billing",
  subscription_overdue: "billing",
  attendance_drop: "retention",
  idle_slot: "retention",
  favorite_slot_available: "retention",
  low_enrollment: "operations",
  top_product: "marketing",
  low_campaign_performance: "operations",
  revenue_drop: "operations",
  relevant_tournament: "marketing",
};

function safeJson(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authorize(req: Request): boolean {
  const t = req.headers.get("x-internal-token") || "";
  if (INTERNAL_TOKEN && t === INTERNAL_TOKEN) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${SERVICE_KEY}`;
}

function scopeFor(t: QueueRow): { scope_type: string; scope_id: string | null } {
  if (t.user_id) return { scope_type: "user", scope_id: t.user_id };
  if (t.arena_id) return { scope_type: "arena", scope_id: t.arena_id };
  if (t.profile_type === "tenant") return { scope_type: "tenant", scope_id: t.tenant_id };
  return { scope_type: "tenant", scope_id: t.tenant_id };
}

async function lookupPhone(admin: any, t: QueueRow): Promise<string | null> {
  if (t.user_id) {
    const { data: prof } = await admin
      .from("profiles")
      .select("whatsapp, phone")
      .eq("user_id", t.user_id)
      .maybeSingle();
    const p = (prof?.whatsapp || prof?.phone || "").toString().replace(/[^\d+]/g, "");
    if (p) return p;
  }
  // Fallback: arena-bound instance phone
  if (t.arena_id) {
    const { data: bind } = await admin
      .from("whatsapp_bindings")
      .select("whatsapp_instances!inner(phone_number)")
      .eq("arena_id", t.arena_id)
      .limit(1)
      .maybeSingle();
    const phone = (bind as any)?.whatsapp_instances?.phone_number;
    if (phone) return String(phone).replace(/[^\d+]/g, "");
  }
  return null;
}

async function processOne(admin: any, t: QueueRow): Promise<string> {
  const category = TRIGGER_TO_CATEGORY[t.trigger_type] || "operations";
  const { scope_type, scope_id } = scopeFor(t);

  // 1) Eligibility
  const { data: elig } = await admin.rpc("orkym_proactive_check_eligibility", {
    _user_id: t.user_id,
    _tenant_id: t.tenant_id,
    _category: category,
    _trigger_type: t.trigger_type,
    _scope_type: scope_type,
    _scope_id: scope_id,
  } as never);
  const eligible = (elig as any)?.eligible === true;
  if (!eligible) {
    await admin.rpc("orkym_trigger_complete", {
      _id: t.id,
      _status: "skipped",
      _error: (elig as any)?.reason || "ineligible",
    } as never);
    await admin.from("orkym_trigger_feedback").insert({
      trigger_id: t.id,
      event: "ignored",
      metadata: elig ?? {},
    } as never);
    return "skipped";
  }

  // 2) Memory context
  let memory_context: unknown = null;
  try {
    memory_context = await getMemoryContext(admin, {
      profile_type: t.profile_type,
      user_id: t.user_id ?? undefined,
      arena_id: t.arena_id ?? undefined,
      tenant_id: t.tenant_id,
      max_items: 15,
    } as never);
  } catch (_e) { memory_context = null; }

  // 3) ORKYM decision
  const decisionPayload = {
    domain: "proactive",
    action: "decide",
    payload: {
      tenant_id: t.tenant_id,
      arena_id: t.arena_id,
      context: {
        profile_type: t.profile_type,
        trigger: {
          id: t.id,
          type: t.trigger_type,
          priority: t.priority,
          entity_type: t.entity_type,
          entity_id: t.entity_id,
          payload: t.payload,
        },
        memory_context,
        user_id: t.user_id,
      },
      metadata: { source: "proactive", trigger_id: t.id },
    },
  };

  const invokeUrl = `${SUPA_URL}/functions/v1/orkym-invoke`;
  let decision: any = null;
  try {
    const resp = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify(decisionPayload),
    });
    const text = await resp.text();
    try { decision = text ? JSON.parse(text) : null; } catch { decision = null; }
  } catch (e) {
    await admin.rpc("orkym_trigger_complete", {
      _id: t.id, _status: "failed", _error: `orkym_invoke_error:${(e as Error).message}`,
    } as never);
    return "failed";
  }

  const orkymResp = decision?.orkym_response ?? decision?.data ?? decision ?? {};
  const shouldSend = Boolean(orkymResp?.should_send ?? orkymResp?.result?.should_send);
  const message = String(orkymResp?.message ?? orkymResp?.result?.message ?? "").trim();

  if (!shouldSend || !message) {
    await admin.rpc("orkym_trigger_complete", {
      _id: t.id, _status: "skipped", _error: "orkym_no_send",
    } as never);
    await admin.from("orkym_trigger_feedback").insert({
      trigger_id: t.id, event: "ignored", metadata: { reason: "orkym_no_send" },
    } as never);
    return "no_send";
  }

  // 4) Resolve phone + outbound command
  const phone = await lookupPhone(admin, t);
  if (!phone) {
    await admin.rpc("orkym_trigger_complete", {
      _id: t.id, _status: "failed", _error: "no_phone",
    } as never);
    return "no_phone";
  }

  const correlationId = crypto.randomUUID();
  const { data: cmdRow } = await admin
    .from("conversational_commands")
    .insert({
      tenant_id: t.tenant_id,
      arena_id: t.arena_id,
      user_id: t.user_id,
      channel: "whatsapp",
      profile_type: t.profile_type,
      input_text: message.slice(0, 1000),
      response_text: message.slice(0, 1000),
      direction: "outbound",
      initiated_by: "orkym",
      status: "dispatched",
      linked_entity_type: "trigger",
      linked_entity_id: t.id,
      orkym_correlation_id: correlationId,
    } as never)
    .select("id")
    .single();
  const commandId = (cmdRow as { id?: string } | null)?.id ?? null;

  // 5) Send via wa-send-message
  const sendUrl = `${SUPA_URL}/functions/v1/wa-send-message`;
  let sendResp: any = null;
  try {
    const r = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "x-internal-token": INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        wa_phone: phone,
        body: message,
        tenant_id: t.tenant_id,
        arena_id: t.arena_id,
        user_id: t.user_id,
        category: TRIGGER_TO_CATEGORY[t.trigger_type] || "operations",
        correlation_id: correlationId,
        idempotency_key: t.dedup_key || `trigger:${t.id}`,
        command_id: commandId,
        initiated_by: "orkym",
      }),
    });
    sendResp = await r.json().catch(() => null);
  } catch (e) {
    sendResp = { ok: false, error: (e as Error).message };
  }

  if (!sendResp?.ok) {
    await admin.rpc("orkym_trigger_complete", {
      _id: t.id, _status: "failed", _error: `send_failed:${sendResp?.error ?? "unknown"}`,
    } as never);
    return "send_failed";
  }

  // 6) Cooldown + feedback + complete
  await admin.rpc("orkym_proactive_record_send", {
    _scope_type: scope_type, _scope_id: scope_id, _trigger_type: t.trigger_type,
  } as never);
  await admin.from("orkym_trigger_feedback").insert({
    trigger_id: t.id,
    event: "message_sent",
    correlation_id: correlationId,
    metadata: { message_id: sendResp.message_id, external_message_id: sendResp.external_message_id },
  } as never);
  await admin.rpc("orkym_trigger_complete", {
    _id: t.id, _status: "processed", _error: null,
  } as never);

  return "sent";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, error: "method_not_allowed" }, 405);
  if (!authorize(req)) return safeJson({ ok: false, error: "unauthorized" }, 401);

  let limit = 100;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.limit) limit = Math.max(1, Math.min(500, Number(body.limit)));
  } catch { /* noop */ }

  const admin = createClient(SUPA_URL, SERVICE_KEY);
  const { data: rows, error } = await admin.rpc("orkym_trigger_claim_batch", { _limit: limit } as never);
  if (error) return safeJson({ ok: false, error: error.message });

  const triggers = (rows ?? []) as QueueRow[];
  const summary: Record<string, number> = { total: triggers.length, sent: 0, skipped: 0, failed: 0, no_send: 0, no_phone: 0, send_failed: 0 };

  for (const t of triggers) {
    let outcome = "failed";
    try {
      outcome = await processOne(admin, t);
    } catch (e) {
      console.error("processOne error", t.id, e);
      try {
        await admin.rpc("orkym_trigger_complete", {
          _id: t.id, _status: "failed", _error: `exception:${(e as Error).message}`,
        } as never);
      } catch { /* noop */ }
    }
    summary[outcome] = (summary[outcome] ?? 0) + 1;
  }

  return safeJson({ ok: true, ...summary });
});
