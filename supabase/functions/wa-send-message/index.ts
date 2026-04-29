// wa-send-message — Phase 12.9
// Internal-only outbound WhatsApp sender. Always proxies through ORKYM
// (which owns the WhatsApp Business OS). Never invokes any provider directly.
// Auth: x-internal-token must equal ORKYM_INTERNAL_TOKEN OR caller must be
// service role (verified via SUPABASE_SERVICE_ROLE_KEY in Authorization).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORKYM_BASE = Deno.env.get("ORKYM_API_BASE_URL") || "";
const ORKYM_TOKEN = Deno.env.get("ORKYM_SERVICE_TOKEN") || "";
const ORKYM_HMAC = Deno.env.get("ORKYM_HMAC_SECRET") || "";
const INTERNAL_TOKEN = Deno.env.get("ORKYM_INTERNAL_TOKEN") || "";

interface SendBody {
  instance_id?: string | null;
  wa_phone: string;
  body?: string;
  template_name?: string;
  template_vars?: Record<string, unknown>;
  tenant_id?: string | null;
  arena_id?: string | null;
  user_id?: string | null;
  category?: string;
  correlation_id?: string;
  idempotency_key?: string;
  command_id?: string | null;
  initiated_by?: "orkym" | "system";
}

function safeJson(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function authorize(req: Request): boolean {
  const internal = req.headers.get("x-internal-token") || "";
  if (INTERNAL_TOKEN && internal && internal === INTERNAL_TOKEN) return true;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${SERVICE_KEY}`) return true;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, error: "method_not_allowed" }, 405);

  if (!authorize(req)) return safeJson({ ok: false, error: "unauthorized" }, 401);

  let body: SendBody;
  try { body = await req.json(); } catch { return safeJson({ ok: false, error: "invalid_json" }, 400); }

  const phone = (body.wa_phone || "").replace(/[^\d+]/g, "");
  if (!phone) return safeJson({ ok: false, error: "wa_phone_required" }, 400);
  if (!body.body && !body.template_name) {
    return safeJson({ ok: false, error: "body_or_template_required" }, 400);
  }

  const admin = createClient(SUPA_URL, SERVICE_KEY);

  // Idempotency check
  if (body.idempotency_key) {
    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("id, external_message_id, delivery_status")
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();
    if (existing) {
      return safeJson({ ok: true, deduplicated: true, message_id: existing.id, external_message_id: existing.external_message_id });
    }
  }

  // Resolve instance if missing
  let instanceId: string | null = body.instance_id ?? null;
  if (!instanceId) {
    try {
      const { data } = await admin.rpc("resolve_whatsapp_instance", {
        _tenant_id: body.tenant_id ?? null,
        _arena_id: body.arena_id ?? null,
        _user_id: body.user_id ?? null,
      } as never);
      if (data) instanceId = String(data);
    } catch (_e) {
      // fall through — try by phone
    }
    if (!instanceId) {
      try {
        const { data } = await admin.rpc("resolve_whatsapp_instance_by_phone", { _wa_phone: phone } as never);
        if (data) instanceId = String(data);
      } catch (_e) { /* noop */ }
    }
  }

  // Insert outbound row (queued)
  const insertPayload: Record<string, unknown> = {
    instance_id: instanceId,
    command_id: body.command_id ?? null,
    direction: "outbound",
    wa_phone: phone,
    user_id: body.user_id ?? null,
    tenant_id: body.tenant_id ?? null,
    arena_id: body.arena_id ?? null,
    message_type: body.template_name ? "template" : "text",
    body: body.body ?? null,
    template_name: body.template_name ?? null,
    template_vars: body.template_vars ?? null,
    delivery_status: "queued",
    initiated_by: body.initiated_by ?? "orkym",
    category: body.category ?? null,
    correlation_id: body.correlation_id ?? null,
    idempotency_key: body.idempotency_key ?? null,
  };

  const { data: msgRow, error: insertErr } = await admin
    .from("whatsapp_messages")
    .insert(insertPayload as never)
    .select("id")
    .single();

  if (insertErr || !msgRow) {
    return safeJson({ ok: false, error: "db_insert_failed", detail: insertErr?.message });
  }

  const messageId = (msgRow as { id: string }).id;

  // If ORKYM env not configured → degraded, leave queued
  if (!ORKYM_BASE || !ORKYM_TOKEN) {
    return safeJson({ ok: true, degraded: true, message_id: messageId, status: "queued" });
  }

  // Forward to ORKYM /whatsapp/send
  const payload = {
    instance_id: instanceId,
    to: phone,
    body: body.body ?? null,
    template_name: body.template_name ?? null,
    template_vars: body.template_vars ?? null,
    correlation_id: body.correlation_id ?? messageId,
    idempotency_key: body.idempotency_key ?? messageId,
    metadata: {
      tenant_id: body.tenant_id ?? null,
      arena_id: body.arena_id ?? null,
      user_id: body.user_id ?? null,
      category: body.category ?? null,
    },
  };
  const raw = JSON.stringify(payload);
  const sig = ORKYM_HMAC ? await hmacHex(ORKYM_HMAC, raw) : "";
  const url = `${ORKYM_BASE.replace(/\/+$/, "")}/whatsapp/send`;

  let externalId: string | null = null;
  let status: "sent" | "failed" = "failed";
  let failure: string | null = null;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ORKYM_TOKEN}`,
        ...(sig ? { "X-Orkym-Signature": `sha256=${sig}` } : {}),
      },
      body: raw,
    });
    const text = await resp.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (resp.ok) {
      status = "sent";
      externalId = parsed?.external_message_id ?? parsed?.id ?? null;
    } else {
      failure = `orkym_${resp.status}: ${text.slice(0, 200)}`;
    }
  } catch (e) {
    failure = `orkym_network: ${(e as Error).message}`;
  }

  await admin
    .from("whatsapp_messages")
    .update({
      delivery_status: status,
      external_message_id: externalId,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      failure_reason: failure,
    } as never)
    .eq("id", messageId);

  return safeJson({
    ok: status === "sent",
    message_id: messageId,
    external_message_id: externalId,
    status,
    error: failure,
  });
});
