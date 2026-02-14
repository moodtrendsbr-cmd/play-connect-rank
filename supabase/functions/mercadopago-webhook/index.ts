import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json();

    // Mercado Pago sends notification with topic and id
    if (body.type === "payment" || body.topic === "payment") {
      const paymentId = body.data?.id || body.id;

      // Fetch payment details from Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      });

      const payment = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(`MP payment fetch error [${paymentResponse.status}]: ${JSON.stringify(payment)}`);
      }

      if (payment.status === "approved") {
        const enrollmentId = payment.external_reference;

        if (enrollmentId) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Update enrollment to paid
          const { error } = await supabase
            .from("enrollments")
            .update({ status: "paid", payment_id: String(paymentId) })
            .eq("id", enrollmentId);

          if (error) {
            console.error("Error updating enrollment:", error);
          } else {
            console.log(`Enrollment ${enrollmentId} marked as paid`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
