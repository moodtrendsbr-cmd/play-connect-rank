// MercadoPago webhook unificado — roteia payment + preapproval para o handler
// compartilhado em _shared/mp.ts. Idempotente, assinatura validada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getServiceClient, recordWebhookEvent, verifyMpSignature,
  processMpPayment, getMpPreapproval, mapMpStatus,
} from "../_shared/mp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const type = body.type || body.topic;
    const dataId = String(body.data?.id ?? body.id ?? "");
    if (!dataId) {
      return new Response(JSON.stringify({ received: true, skipped: "no_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica assinatura quando MP_WEBHOOK_SECRET configurado
    const sigOk = await verifyMpSignature(req, dataId);
    if (!sigOk) {
      console.warn("[mp-webhook] invalid signature for", dataId);
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    // Idempotência (provider, event_id)
    const eventKey = `${type}:${dataId}:${body.action ?? ""}`;
    const fresh = await recordWebhookEvent(supabase, "mercadopago", eventKey, body);
    if (!fresh) {
      return new Response(JSON.stringify({ received: true, replay: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "payment") {
      const result = await processMpPayment(supabase, dataId);
      return new Response(JSON.stringify({ received: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "preapproval" || type === "subscription_preapproval") {
      const pre = await getMpPreapproval(dataId);
      // pre.status: authorized | paused | cancelled | pending
      const subId = pre.external_reference;
      if (subId) {
        let nextStatus = "active";
        if (pre.status === "paused") nextStatus = "overdue";
        else if (pre.status === "cancelled") nextStatus = "cancelled";
        else if (pre.status === "pending") nextStatus = "pending";
        await supabase.from("subscriptions").update({
          status: nextStatus,
          provider: "mercadopago",
          provider_subscription_id: String(pre.id),
        }).eq("id", subId);
      }
      return new Response(JSON.stringify({ received: true, preapproval: pre.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "authorized_payment" || type === "subscription_authorized_payment") {
      // Cobrança recorrente paga — MP envia paymentId; processa normalmente
      const result = await processMpPayment(supabase, dataId);
      return new Response(JSON.stringify({ received: true, recurring: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true, ignored: type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[mp-webhook] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
