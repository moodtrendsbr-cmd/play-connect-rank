// Phase M — Boost payment (PIX via Mercado Pago)
// Reuses ad_campaigns + financial_transactions. No split: 100% MoodPlay revenue.
// On webhook 'paid' → trg_boost_activate_on_paid activates the campaign.
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
    if (!MP_TOKEN) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      campaign_id,
      payer_email,
      payer_first_name,
      payer_last_name,
      payer_doc_type,
      payer_doc_number,
    } = await req.json();

    if (!campaign_id) throw new Error("campaign_id required");

    // Load pending campaign
    const { data: campaign, error: cErr } = await supabase
      .from("ad_campaigns")
      .select("id, kind, target_type, target_id, boost_level, duration_days, budget, status, tenant_id, company_id")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) throw new Error("campaign not found");
    if (campaign.status !== "pending") {
      return new Response(JSON.stringify({ error: "campaign not pending", status: campaign.status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(campaign.budget);
    if (!(amount > 0)) throw new Error("invalid amount");

    const description = `Boost ${campaign.kind} L${campaign.boost_level} (${campaign.duration_days}d)`;

    const paymentBody: any = {
      transaction_amount: amount,
      description,
      payment_method_id: "pix",
      external_reference: JSON.stringify({ source_type: "boost", campaign_id }),
      payer: {
        email: payer_email,
        first_name: payer_first_name || "",
        last_name: payer_last_name || "",
        identification: {
          type: payer_doc_type || "CPF",
          number: payer_doc_number || "",
        },
      },
    };

    const idempotencyKey = `boost-${campaign_id}-${Date.now()}`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });
    const mp = await mpRes.json();
    if (!mpRes.ok) {
      throw new Error(`MP error [${mpRes.status}]: ${JSON.stringify(mp)}`);
    }

    // Record financial_transaction (pending). Webhook will mark paid → trigger activates.
    await supabase.from("financial_transactions").insert({
      source_type: "boost",
      source_id: campaign_id,
      tenant_id: campaign.tenant_id,
      company_id: campaign.company_id,
      payer_user_id: userId,
      amount,
      currency: "BRL",
      provider: "mercadopago",
      provider_payment_id: String(mp.id),
      status: mp.status === "approved" ? "paid" : "pending",
      metadata: { kind: campaign.kind, boost_level: campaign.boost_level },
    });

    const result: any = {
      payment_id: mp.id,
      status: mp.status,
      amount,
    };
    if (mp.point_of_interaction?.transaction_data) {
      result.pix_qr_code = mp.point_of_interaction.transaction_data.qr_code;
      result.pix_qr_code_base64 = mp.point_of_interaction.transaction_data.qr_code_base64;
      result.pix_copy_paste = mp.point_of_interaction.transaction_data.qr_code;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("create-boost-payment error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
