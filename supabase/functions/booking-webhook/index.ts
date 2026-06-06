// Thin wrapper: delega para o handler compartilhado em _shared/mp.ts.
// Mantido para compat com URL antiga eventualmente registrada no MP.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, recordWebhookEvent, verifyMpSignature, processMpPayment } from "../_shared/mp.ts";

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
    if (type !== "payment" || !dataId) {
      return new Response(JSON.stringify({ received: true, ignored: type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigOk = await verifyMpSignature(req, dataId);
    if (!sigOk) {
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = getServiceClient();
    const fresh = await recordWebhookEvent(supabase, "mercadopago", `payment:${dataId}`, body);
    if (!fresh) {
      return new Response(JSON.stringify({ received: true, replay: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await processMpPayment(supabase, dataId);
    return new Response(JSON.stringify({ received: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[booking-webhook] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
