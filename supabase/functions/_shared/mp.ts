// Shared Mercado Pago helpers — extracts duplication across MP webhooks/handlers.
// Idempotency, signature verification, payment fetch.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Verify MP webhook signature (HMAC-SHA256) when MP_WEBHOOK_SECRET is set. */
export async function verifyMpSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("MP_WEBHOOK_SECRET not configured — signature verification skipped");
    return true; // compat mode
  }
  const sigHeader = req.headers.get("x-signature");
  const reqId = req.headers.get("x-request-id");
  if (!sigHeader || !reqId) return false;

  // x-signature: "ts=...,v1=..."
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.trim().split("=").map((s) => s.trim())) as [string, string][]
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v1;
}

/**
 * Idempotency: register webhook event. Returns true if first time, false if replay.
 */
export async function recordWebhookEvent(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
  payload: unknown,
): Promise<boolean> {
  const { error } = await supabase
    .from("webhook_events")
    .insert({ provider, event_id: String(eventId), payload, processed_at: new Date().toISOString() });
  if (error) {
    if ((error as any).code === "23505") return false; // unique violation = replay
    console.error("recordWebhookEvent error:", error);
    return false;
  }
  return true;
}

export async function getMpPayment(paymentId: string | number): Promise<any> {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP fetch error: ${JSON.stringify(data)}`);
  return data;
}
