// Executa um saque (PIX) via Mercado Pago. Admin-only.
// Estados: pending → approved (admin) → processing → paid | failed.

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
    const adminId = claims.claims.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica role admin
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", adminId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { withdrawal_id, action } = await req.json();
    if (!withdrawal_id) {
      return new Response(JSON.stringify({ error: "withdrawal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wr, error: wErr } = await supabase
      .from("withdrawal_requests").select("*").eq("id", withdrawal_id).single();
    if (wErr || !wr) {
      return new Response(JSON.stringify({ error: "withdrawal_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aprovação
    if (action === "approve") {
      if (wr.status !== "pending") {
        return new Response(JSON.stringify({ error: "invalid_state", current: wr.status }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updErr } = await supabase.from("withdrawal_requests").update({
        status: "approved", approved_at: new Date().toISOString(), approved_by: adminId,
      }).eq("id", withdrawal_id);
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ ok: true, status: "approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { error: updErr } = await supabase.from("withdrawal_requests").update({
        status: "rejected", failure_reason: "rejected_by_admin",
      }).eq("id", withdrawal_id);
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "execute") {
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wr.status !== "approved") {
      return new Response(JSON.stringify({ error: "must_be_approved_first", current: wr.status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca tenant do organizador
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id, full_name, email").eq("user_id", wr.organizer_id).maybeSingle();
    const tenantId = (prof as any)?.tenant_id;

    await supabase.from("withdrawal_requests").update({ status: "processing" }).eq("id", withdrawal_id);

    // Payout PIX via /v1/payments do tipo transferência
    // NB: MP Money Out tradicional exige conta marketplace homologada. Para contas simples,
    // o pagamento PIX criado aqui simula o débito da conta Mood e credita o destinatário.
    const payoutBody: any = {
      transaction_amount: Number(wr.amount),
      description: `Saque MoodPlay #${withdrawal_id.slice(0, 8)}`,
      payment_method_id: "pix",
      external_reference: JSON.stringify({
        source_type: "withdrawal",
        source_id: withdrawal_id,
        tenant_id: tenantId,
        organizer_id: wr.organizer_id,
      }),
      payer: {
        email: (prof as any)?.email ?? "saque@moodplay.app",
        first_name: (prof as any)?.full_name ?? "Saque",
      },
      additional_info: {
        items: [{ id: withdrawal_id, title: "Saque PIX", quantity: 1, unit_price: Number(wr.amount) }],
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `withdraw-${withdrawal_id}`,
      },
      body: JSON.stringify(payoutBody),
    });
    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      await supabase.from("withdrawal_requests").update({
        status: "failed",
        failure_reason: JSON.stringify(mpData).slice(0, 500),
      }).eq("id", withdrawal_id);
      return new Response(JSON.stringify({ error: "payout_failed", details: mpData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("withdrawal_requests").update({
      provider: "mercadopago",
      provider_payment_id: String(mpData.id),
    }).eq("id", withdrawal_id);

    // Registra financial_transaction pending (webhook completa)
    if (tenantId) {
      await supabase.from("financial_transactions").upsert({
        tenant_id: tenantId,
        organizer_id: wr.organizer_id,
        source_type: "withdrawal",
        source_id: withdrawal_id,
        total_amount: Number(wr.amount),
        currency: "BRL",
        status: mpData.status === "approved" ? "paid" : "pending",
        payment_provider: "mercadopago",
        payment_reference: String(mpData.id),
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
        metadata: { mp_status: mpData.status, kind: "payout" },
      }, { onConflict: "payment_provider,payment_reference" });
    }

    return new Response(JSON.stringify({
      ok: true, status: "processing", payment_id: mpData.id, mp_status: mpData.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[execute-withdrawal] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
