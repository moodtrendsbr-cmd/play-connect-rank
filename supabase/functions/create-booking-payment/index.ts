import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id, payment_method } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get booking
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, arenas(*)")
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Reserva não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check overbooking
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("court_id", booking.court_id)
      .eq("booking_date", booking.booking_date)
      .eq("start_time", booking.start_time)
      .in("status", ["confirmed", "pending_payment"])
      .neq("id", booking_id);

    if ((count || 0) > 0) {
      await supabase.from("bookings").update({ status: "canceled" }).eq("id", booking_id);
      return new Response(JSON.stringify({ error: "Horário já reservado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      // No payment provider - just confirm directly
      await supabase.from("bookings").update({ status: "confirmed" }).eq("id", booking_id);
      return new Response(JSON.stringify({ success: true, status: "confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve collector via canonical payment_accounts (with legacy fallback)
    const arena = booking.arenas;
    const { resolveCollectorId } = await import("../_shared/mp.ts");
    const collectorId = await resolveCollectorId(supabase, {
      tenantId: booking.tenant_id ?? arena?.tenant_id ?? null,
      arenaId: booking.arena_id,
    });

    const paymentBody: any = {
      transaction_amount: Number(booking.amount),
      description: `Reserva ${arena?.name || "Arena"}`,
      payment_method_id: payment_method || "pix",
      payer: {
        email: booking.customer_email,
        first_name: booking.customer_name,
      },
    };

    // If a collector is configured, use split (marketplace)
    if (collectorId) {
      paymentBody.marketplace_fee = Number(booking.amount) * 0.1; // 10% Mood commission
      // In production, use application_id and collector_id for split
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
      return new Response(JSON.stringify({ error: "Erro no pagamento", details: mpData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update booking with payment reference
    const newStatus = mpData.status === "approved" ? "confirmed" : "pending_payment";
    await supabase.from("bookings").update({
      payment_provider: "mercadopago",
      payment_ref: String(mpData.id),
      status: newStatus,
    }).eq("id", booking_id);

    return new Response(JSON.stringify({
      success: true,
      status: newStatus,
      payment_id: mpData.id,
      point_of_interaction: mpData.point_of_interaction,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
