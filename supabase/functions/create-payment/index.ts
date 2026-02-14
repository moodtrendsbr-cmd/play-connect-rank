import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
    }

    const { tournament_id, tournament_name, entry_fee, enrollment_id, user_email } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const preference = {
      items: [
        {
          title: `Inscrição - ${tournament_name}`,
          quantity: 1,
          unit_price: Number(entry_fee),
          currency_id: "BRL",
        },
      ],
      payer: {
        email: user_email,
      },
      back_urls: {
        success: `${req.headers.get("origin")}/payment/${tournament_id}?status=approved`,
        failure: `${req.headers.get("origin")}/payment/${tournament_id}?status=failure`,
        pending: `${req.headers.get("origin")}/payment/${tournament_id}?status=pending`,
      },
      auto_return: "approved",
      external_reference: enrollment_id,
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Mercado Pago API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ init_point: data.init_point, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating payment:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
