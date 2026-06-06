// Cria pagamento real no MP para uma reserva. NUNCA confirma reserva sem cobrança.
// A confirmação acontece via webhook (trg_apply_payment_side_effects).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, resolveCollectorId } from "../_shared/mp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOOD_COMMISSION_PERCENT = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      return new Response(
        JSON.stringify({ error: "payment_provider_not_configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { booking_id, payment_method } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, arenas(*)")
      .eq("id", booking_id).single();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "booking_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti overbooking
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("court_id", booking.court_id)
      .eq("booking_date", booking.booking_date)
      .eq("start_time", booking.start_time)
      .in("status", ["confirmed"])
      .neq("id", booking_id);
    if ((count || 0) > 0) {
      await supabase.from("bookings").update({ status: "canceled" }).eq("id", booking_id);
      return new Response(JSON.stringify({ error: "slot_taken" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arena = booking.arenas;
    const tenantId = booking.tenant_id ?? arena?.tenant_id ?? null;
    const arenaId = booking.arena_id;
    const totalAmount = Number(booking.amount);

    const collectorId = await resolveCollectorId(supabase, { tenantId, arenaId });
    const commissionAmount = Math.round(totalAmount * MOOD_COMMISSION_PERCENT) / 100;

    const externalRef = {
      source_type: "booking",
      source_id: booking_id,
      tenant_id: tenantId,
      arena_id: arenaId,
      has_split: !!collectorId,
    };

    const paymentBody: any = {
      transaction_amount: totalAmount,
      description: `Reserva ${arena?.name || "Arena"}`,
      payment_method_id: payment_method || "pix",
      external_reference: JSON.stringify(externalRef),
      payer: {
        email: booking.customer_email,
        first_name: booking.customer_name,
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };
    if (collectorId) {
      paymentBody.application_fee = commissionAmount;
      paymentBody.collector_id = collectorId;
    }

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": booking_id,
      },
      body: JSON.stringify(paymentBody),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("[create-booking-payment] MP error:", mpData);
      return new Response(JSON.stringify({ error: "payment_provider_error", details: mpData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Booking permanece pending_payment até webhook confirmar.
    // Apenas registra a referência do pagamento.
    await supabase.from("bookings").update({
      payment_provider: "mercadopago",
      payment_ref: String(mpData.id),
      status: "pending_payment",
    }).eq("id", booking_id);

    // Cria linha pendente em financial_transactions (idempotente via uq_fin_tx_provider_ref).
    if (tenantId) {
      await supabase.from("financial_transactions").upsert({
        tenant_id: tenantId,
        arena_id: arenaId,
        source_type: "booking",
        source_id: booking_id,
        total_amount: totalAmount,
        currency: "BRL",
        status: mpData.status === "approved" ? "paid" : "pending",
        payment_provider: "mercadopago",
        payment_reference: String(mpData.id),
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
        metadata: { external_reference: externalRef, mp_status: mpData.status },
      }, { onConflict: "payment_provider,payment_reference" });
    }

    return new Response(JSON.stringify({
      success: true,
      status: mpData.status === "approved" ? "confirmed" : "pending_payment",
      payment_id: mpData.id,
      mp_status: mpData.status,
      point_of_interaction: mpData.point_of_interaction,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-booking-payment] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
