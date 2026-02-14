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

    const {
      tournament_name,
      entry_fee,
      enrollment_ids,
      payer_email,
      payer_first_name,
      payer_last_name,
      payer_doc_type,
      payer_doc_number,
      payment_method,
      token, // card token from MercadoPago.js
      installments,
      issuer_id,
    } = await req.json();

    const totalAmount = Number(entry_fee) * enrollment_ids.length;

    const paymentBody: any = {
      transaction_amount: totalAmount,
      description: `Inscrição ${tournament_name} (${enrollment_ids.length} atleta${enrollment_ids.length > 1 ? "s" : ""})`,
      external_reference: JSON.stringify(enrollment_ids),
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

    // For PIX, return QR code data
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

    // If approved immediately (credit card), update enrollments
    if (data.status === "approved") {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      for (const enrollmentId of enrollment_ids) {
        await supabase
          .from("enrollments")
          .update({ status: "paid", payment_id: String(data.id) })
          .eq("id", enrollmentId);
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
