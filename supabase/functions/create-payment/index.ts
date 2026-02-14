import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOOD_COMMISSION_PERCENT = 10; // 10% commission

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      tournament_id,
      tournament_name,
      entry_fee,
      enrollment_ids,
      payer_email,
      payer_first_name,
      payer_last_name,
      payer_doc_type,
      payer_doc_number,
      payment_method,
      token,
      installments,
      issuer_id,
    } = await req.json();

    const totalAmount = Number(entry_fee) * enrollment_ids.length;
    const commissionAmount = Math.round(totalAmount * MOOD_COMMISSION_PERCENT) / 100;

    // Lookup organizer's mp_collector_id
    let mpCollectorId: string | null = null;
    if (tournament_id) {
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("organizer_id")
        .eq("id", tournament_id)
        .single();

      if (tournament) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("mp_collector_id")
          .eq("user_id", tournament.organizer_id)
          .single();

        mpCollectorId = profile?.mp_collector_id || null;
      }
    }

    const paymentBody: any = {
      transaction_amount: totalAmount,
      description: `Inscrição ${tournament_name} (${enrollment_ids.length} atleta${enrollment_ids.length > 1 ? "s" : ""})`,
      external_reference: JSON.stringify({ enrollment_ids, tournament_id, has_split: !!mpCollectorId }),
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

    // Split payment if organizer has MP account
    if (mpCollectorId) {
      paymentBody.application_fee = commissionAmount;
      paymentBody.collector_id = mpCollectorId;
    }

    if (payment_method === "pix") {
      paymentBody.payment_method_id = "pix";
    } else if (payment_method === "credit_card") {
      paymentBody.token = token;
      paymentBody.installments = installments || 1;
      paymentBody.issuer_id = issuer_id;
    }

    const idempotencyKey = `${enrollment_ids.join("-")}-${Date.now()}`;

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Mercado Pago API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    const result: any = {
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
    };

    if (payment_method === "pix" && data.point_of_interaction?.transaction_data) {
      result.pix_qr_code = data.point_of_interaction.transaction_data.qr_code;
      result.pix_qr_code_base64 = data.point_of_interaction.transaction_data.qr_code_base64;
      result.pix_copy_paste = data.point_of_interaction.transaction_data.qr_code;
    }

    // If approved immediately (credit card)
    if (data.status === "approved") {
      for (const enrollmentId of enrollment_ids) {
        await supabase
          .from("enrollments")
          .update({ status: "paid", payment_id: String(data.id) })
          .eq("id", enrollmentId);
      }

      // If no split, credit organizer balance
      if (!mpCollectorId && tournament_id) {
        const { data: tournament } = await supabase
          .from("tournaments")
          .select("organizer_id")
          .eq("id", tournament_id)
          .single();

        if (tournament) {
          const orgAmount = totalAmount - commissionAmount;
          await supabase.from("organizer_balances").insert({
            organizer_id: tournament.organizer_id,
            tournament_id,
            amount: orgAmount,
            commission: commissionAmount,
            payment_id: String(data.id),
            status: "paid",
          });
        }
      }
    }

    return new Response(JSON.stringify(result), {
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
