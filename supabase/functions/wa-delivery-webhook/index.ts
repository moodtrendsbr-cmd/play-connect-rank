// ============================================================
// wa-delivery-webhook — Phase 12.6.2
// Receives delivery callbacks from Twilio / Meta / Evolution and
// updates whatsapp_messages.delivery_status idempotently.
// Public endpoint (verify_jwt = false). Validates per-provider signature.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMetaSignature, shouldUpdateStatus } from "../_shared/wa-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-hub-signature-256",
};

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map provider-specific status to our internal enum
function normalizeTwilioStatus(s: string): string {
  switch (s) {
    case "queued": case "accepted": case "sending": return "queued";
    case "sent": return "sent";
    case "delivered": return "delivered";
    case "read": return "read";
    case "failed": case "undelivered": return "failed";
    default: return "queued";
  }
}
function normalizeMetaStatus(s: string): string {
  switch (s) {
    case "sent": return "sent";
    case "delivered": return "delivered";
    case "read": return "read";
    case "failed": return "failed";
    default: return "queued";
  }
}
function normalizeEvolutionStatus(s: string): string {
  const k = (s ?? "").toLowerCase();
  if (k.includes("read")) return "read";
  if (k.includes("deliver")) return "delivered";
  if (k.includes("sent") || k.includes("server_ack")) return "sent";
  if (k.includes("fail") || k.includes("error")) return "failed";
  return "queued";
}

interface StatusUpdate {
  external_id: string;
  status: string;
  failure_reason?: string | null;
}

async function applyStatusUpdate(admin: any, provider: string, u: StatusUpdate) {
  const { data: row } = await admin
    .from("whatsapp_messages")
    .select("id, delivery_status")
    .eq("external_message_id", u.external_id)
    .maybeSingle();

  if (!row) return { matched: false };

  if (!shouldUpdateStatus(row.delivery_status, u.status)) {
    return { matched: true, skipped: true };
  }

  const patch: Record<string, unknown> = { delivery_status: u.status };
  if (u.status === "sent") patch.sent_at = new Date().toISOString();
  if (u.status === "delivered") patch.delivered_at = new Date().toISOString();
  if (u.status === "read") patch.read_at = new Date().toISOString();
  if (u.status === "failed") patch.failure_reason = u.failure_reason ?? "provider_reported_failure";

  await admin.from("whatsapp_messages").update(patch).eq("id", row.id);

  // Audit log
  try {
    await admin.from("security_audit_log").insert({
      action: `wa_delivery.${u.status}`,
      resource_type: "whatsapp_message",
      resource_id: row.id,
      metadata: { provider, external_message_id: u.external_id, failure_reason: u.failure_reason ?? null },
    });
  } catch { /* best-effort */ }

  return { matched: true, updated: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Accept /wa-delivery-webhook/<provider> or ?provider=<provider>
  const segs = url.pathname.split("/").filter(Boolean);
  const provider = (segs[segs.length - 1] || url.searchParams.get("provider") || "").toLowerCase();

  if (!["twilio", "meta", "evolution"].includes(provider)) {
    return safeJson({ ok: false, error: "unknown_provider" }, 400);
  }

  // Meta verification handshake (GET)
  if (req.method === "GET" && provider === "meta") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WA_META_VERIFY_TOKEN");
    if (mode === "subscribe" && token && expected && token === expected) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return safeJson({ ok: false, error: "verification_failed" }, 403);
  }

  if (req.method !== "POST") return safeJson({ ok: false, error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const updates: StatusUpdate[] = [];

  try {
    if (provider === "twilio") {
      // Form-encoded
      const params = new URLSearchParams(rawBody);
      const sid = params.get("MessageSid") || params.get("SmsSid");
      const status = params.get("MessageStatus") || params.get("SmsStatus");
      const errorCode = params.get("ErrorCode");
      if (sid && status) {
        updates.push({
          external_id: sid,
          status: normalizeTwilioStatus(status),
          failure_reason: errorCode ? `twilio_error_${errorCode}` : null,
        });
      }
    } else if (provider === "meta") {
      const appSecret = Deno.env.get("WA_META_APP_SECRET") || "";
      const sig = req.headers.get("x-hub-signature-256");
      if (appSecret) {
        const valid = await verifyMetaSignature(rawBody, sig, appSecret);
        if (!valid) return safeJson({ ok: false, error: "invalid_signature" }, 401);
      }
      const payload = JSON.parse(rawBody);
      const entries = payload?.entry ?? [];
      for (const e of entries) {
        for (const c of e?.changes ?? []) {
          for (const s of c?.value?.statuses ?? []) {
            updates.push({
              external_id: String(s.id),
              status: normalizeMetaStatus(String(s.status)),
              failure_reason: s.errors?.[0]?.title ?? null,
            });
          }
        }
      }
    } else if (provider === "evolution") {
      const apiKey = req.headers.get("apikey");
      const expected = Deno.env.get("WA_EVOLUTION_API_KEY");
      if (expected && apiKey !== expected) {
        return safeJson({ ok: false, error: "invalid_apikey" }, 401);
      }
      const payload = JSON.parse(rawBody);
      const id = payload?.key?.id ?? payload?.data?.key?.id ?? payload?.id;
      const status = payload?.status ?? payload?.data?.status;
      if (id && status) {
        updates.push({
          external_id: String(id),
          status: normalizeEvolutionStatus(String(status)),
          failure_reason: payload?.error ?? null,
        });
      }
    }
  } catch (e) {
    return safeJson({ ok: false, error: `parse_error:${(e as Error).message}` }, 400);
  }

  const results = [];
  for (const u of updates) {
    results.push(await applyStatusUpdate(admin, provider, u));
  }

  return safeJson({ ok: true, provider, processed: results.length, results });
});
