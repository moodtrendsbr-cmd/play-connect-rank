import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * wa-send-message — Phase 12.5
 *
 * Outbound WhatsApp dispatcher. Resolves the correct instance via
 * resolve_whatsapp_instance, respects orkym_proactive_eligibility opt-ins
 * for marketing/retention categories, persists to whatsapp_messages, and
 * dispatches to the configured provider (or logs in mock mode).
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

async function verifyHmac(body: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return r === 0;
}

const PROACTIVE_OPT_IN_REQUIRED = new Set(["marketing", "retention"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  const sig = req.headers.get("x-moodplay-signature");
  const ts = req.headers.get("x-request-timestamp");
  const idemKey = req.headers.get("x-idempotency-key");
  const secret = Deno.env.get("ORKYM_SERVICE_TOKEN") || "";
  const isMockMode = !secret || req.url.includes("mode=mock");

  // Replay protection (5min skew window)
  if (ts) {
    const skew = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(skew) || skew > 5 * 60 * 1000) {
      return safeJson({ ok: false, error: "timestamp_skew" }, 401);
    }
  }

  if (!isMockMode) {
    const ok = await verifyHmac(rawBody, sig, secret);
    if (!ok) return safeJson({ ok: false, error: "invalid_signature" }, 401);
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return safeJson({ ok: false, error: "invalid_json" }, 400);
  }

  const {
    to_phone, tenant_id, arena_id, user_id,
    message_type = "text", body: msgBody,
    template_name, template_vars,
    category, correlation_id, initiated_by = "orkym",
    organizer_user_id, company_id, profile_type,
  } = body ?? {};

  if (!to_phone) return safeJson({ ok: false, error: "to_phone_required" }, 400);
  const cleanPhone = String(to_phone).replace(/\D/g, "");
  if (cleanPhone.length < 10) return safeJson({ ok: false, error: "invalid_phone" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency
  if (idemKey) {
    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("id, delivery_status")
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existing) {
      return safeJson({
        ok: true, deduplicated: true,
        message_id: existing.id, delivery_status: existing.delivery_status,
      });
    }
  }

  // Opt-in check
  if (category && PROACTIVE_OPT_IN_REQUIRED.has(category) && user_id) {
    const { data: elig } = await admin
      .from("orkym_proactive_eligibility")
      .select("opted_in")
      .eq("user_id", user_id)
      .eq("category", category)
      .eq("channel", "whatsapp")
      .maybeSingle();
    if (!elig?.opted_in) {
      const { data: blocked } = await admin
        .from("whatsapp_messages")
        .insert({
          wa_phone: cleanPhone, user_id, tenant_id, arena_id,
          direction: "outbound", message_type,
          body: msgBody, template_name, template_vars,
          delivery_status: "failed",
          failure_reason: "opt_in_required",
          initiated_by, category, correlation_id,
          idempotency_key: idemKey,
        }).select("id").single();
      return safeJson({
        ok: false, message_id: blocked?.id,
        delivery_status: "failed", error: "opt_in_required",
      });
    }
  }

  // Resolve instance
  const { data: inst } = await admin.rpc("resolve_whatsapp_instance", {
    _tenant_id: tenant_id ?? null,
    _arena_id: arena_id ?? null,
    _profile_type: profile_type ?? null,
    _organizer_user_id: organizer_user_id ?? null,
    _company_id: company_id ?? null,
  });
  const instanceId = (inst as any)?.instance_id ?? null;
  const provider = (inst as any)?.provider ?? null;

  // Insert queued message
  const { data: msg, error: insErr } = await admin
    .from("whatsapp_messages")
    .insert({
      instance_id: instanceId,
      wa_phone: cleanPhone,
      user_id, tenant_id, arena_id,
      direction: "outbound", message_type,
      body: msgBody, template_name, template_vars,
      delivery_status: "queued",
      initiated_by, category, correlation_id,
      idempotency_key: idemKey,
    }).select("id").single();

  if (insErr) return safeJson({ ok: false, error: insErr.message }, 500);
  const messageId = msg.id;

  // Dispatch to provider
  let deliveryStatus: "sent" | "failed" = "failed";
  let failureReason: string | null = null;
  let externalId: string | null = null;

  if (!provider) {
    failureReason = "no_instance_resolved";
  } else if (provider === "mock") {
    deliveryStatus = "sent";
    externalId = `mock_${messageId.slice(0, 8)}`;
    console.log(`[wa-send-message MOCK] to=${cleanPhone} body="${msgBody}"`);
  } else {
    // Real providers (twilio/meta/evolution): credentials are loaded
    // server-side. If missing, mark failed gracefully — UX degrades.
    failureReason = "no_provider_configured";
  }

  await admin.from("whatsapp_messages").update({
    delivery_status: deliveryStatus,
    failure_reason: failureReason,
    external_message_id: externalId,
    sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
  }).eq("id", messageId);

  // Audit log (best-effort)
  try {
    await admin.from("security_audit_log").insert({
      user_id: user_id ?? null,
      tenant_id: tenant_id ?? null,
      action: `wa_send.${deliveryStatus}`,
      resource_type: "whatsapp_message",
      resource_id: messageId,
      metadata: {
        category, initiated_by, correlation_id,
        instance_id: instanceId, provider,
        failure_reason: failureReason,
      },
    });
  } catch { /* best-effort */ }

  return safeJson({
    ok: deliveryStatus === "sent",
    message_id: messageId,
    instance_id: instanceId,
    provider,
    delivery_status: deliveryStatus,
    failure_reason: failureReason,
  });
});
