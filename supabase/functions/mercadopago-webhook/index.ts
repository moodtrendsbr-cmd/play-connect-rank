import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOOD_COMMISSION_PERCENT = 10;

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

    if (body.type === "payment" || body.topic === "payment") {
      const paymentId = body.data?.id || body.id;

      // Idempotency: skip if already processed
      const idemClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error: idemErr } = await idemClient.from("webhook_events").insert({
        provider: "mercadopago", event_id: String(paymentId), payload: body, processed_at: new Date().toISOString(),
      });
      if (idemErr && (idemErr as any).code === "23505") {
        return new Response(JSON.stringify({ received: true, replay: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}` },
      });

      const payment = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(`MP payment fetch error [${paymentResponse.status}]: ${JSON.stringify(payment)}`);
      }

      if (payment.status === "approved") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Parse external_reference (new format: JSON object, old format: array of IDs)
        let enrollmentIds: string[] = [];
        let tournamentId: string | null = null;
        let hasSplit = false;

        try {
          const ref = JSON.parse(payment.external_reference);
          if (Array.isArray(ref)) {
            enrollmentIds = ref;
          } else {
            enrollmentIds = ref.enrollment_ids || [];
            tournamentId = ref.tournament_id || null;
            hasSplit = ref.has_split || false;
          }
        } catch {
          enrollmentIds = [payment.external_reference];
        }

        // Update enrollments
        for (const enrollmentId of enrollmentIds) {
          const { error } = await supabase
            .from("enrollments")
            .update({ status: "paid", payment_id: String(paymentId) })
            .eq("id", enrollmentId);

          if (error) {
            console.error(`Error updating enrollment ${enrollmentId}:`, error);
          } else {
            console.log(`Enrollment ${enrollmentId} marked as paid`);
          }
        }

        // Credit organizer balance if no split was done
        if (!hasSplit && tournamentId) {
          const { data: tournament } = await supabase
            .from("tournaments")
            .select("organizer_id, entry_fee")
            .eq("id", tournamentId)
            .single();

          if (tournament) {
            const totalAmount = payment.transaction_amount || (Number(tournament.entry_fee) * enrollmentIds.length);
            const commission = Math.round(totalAmount * MOOD_COMMISSION_PERCENT) / 100;
            const orgAmount = totalAmount - commission;

            // Check if already credited
            const { data: existing } = await supabase
              .from("organizer_balances")
              .select("id")
              .eq("payment_id", String(paymentId))
              .limit(1);

            if (!existing || existing.length === 0) {
              await supabase.from("organizer_balances").insert({
                organizer_id: tournament.organizer_id,
                tournament_id: tournamentId,
                amount: orgAmount,
                commission,
                payment_id: String(paymentId),
                status: "paid",
              });
              console.log(`Credited organizer ${tournament.organizer_id}: R$${orgAmount}`);
            }
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
