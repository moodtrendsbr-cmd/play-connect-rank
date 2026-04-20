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
    const body = await req.json();
    const paymentId = body?.data?.id || body?.id;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: "No payment ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      return new Response(JSON.stringify({ error: "MP not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idemClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: idemErr } = await idemClient.from("webhook_events").insert({
      provider: "mercadopago-booking", event_id: String(paymentId), payload: body, processed_at: new Date().toISOString(),
    });
    if (idemErr && (idemErr as any).code === "23505") {
      return new Response(JSON.stringify({ received: true, replay: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment from MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "Could not fetch payment" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find booking by payment_ref
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("payment_ref", String(paymentId))
      .maybeSingle();

    if (!booking) {
      return new Response(JSON.stringify({ message: "Booking not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus = booking.status;
    if (mpData.status === "approved") {
      newStatus = "confirmed";
    } else if (mpData.status === "rejected" || mpData.status === "cancelled") {
      newStatus = "canceled";
    }

    if (newStatus !== booking.status) {
      await supabase.from("bookings").update({ status: newStatus }).eq("id", booking.id);
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
