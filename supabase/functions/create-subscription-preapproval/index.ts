// Cria assinatura recorrente real no Mercado Pago (Preapproval API).
// Usado por Tenant, Arena e Company para SaaS.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      return new Response(JSON.stringify({ error: "payment_provider_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const {
      plan_id, payer_email, amount, frequency = 1, frequency_type = "months",
      trial_days = 0, back_url, tenant_id, arena_id, company_id,
    } = await req.json();

    if (!plan_id || !payer_email || !amount) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cria a row de subscriptions primeiro (status=pending), depois envia external_reference=subscription.id
    const trialEnds = trial_days > 0 ? new Date(Date.now() + trial_days * 86400000).toISOString() : null;
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .insert({
        company_id: company_id ?? null,
        tenant_id: tenant_id ?? null,
        arena_id: arena_id ?? null,
        plan_id,
        status: trial_days > 0 ? "trial" : "pending",
        provider: "mercadopago",
        trial_ends_at: trialEnds,
      } as any)
      .select("id").single();
    if (subErr || !sub) {
      console.error("[create-subscription] insert error:", subErr);
      return new Response(JSON.stringify({ error: subErr?.message ?? "insert_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startDate = trialEnds ?? new Date(Date.now() + 60_000).toISOString();
    const preapprovalBody = {
      reason: `Assinatura ${plan_id}`,
      external_reference: sub.id,
      payer_email,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: Number(amount),
        currency_id: "BRL",
        start_date: startDate,
      },
      back_url: back_url || "https://play-connect-rank.lovable.app/",
      status: "pending",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": sub.id,
      },
      body: JSON.stringify(preapprovalBody),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
      console.error("[create-subscription] MP error:", mpData);
      return new Response(JSON.stringify({ error: "payment_provider_error", details: mpData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("subscriptions").update({
      provider_subscription_id: String(mpData.id),
    }).eq("id", sub.id);

    return new Response(JSON.stringify({
      success: true,
      subscription_id: sub.id,
      preapproval_id: mpData.id,
      init_point: mpData.init_point,
      status: mpData.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-subscription] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
