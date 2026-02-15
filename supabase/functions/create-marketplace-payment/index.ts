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
    if (!MERCADO_PAGO_ACCESS_TOKEN) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      company_id,
      items,
      shipping_cost,
      shipping_zip,
      payer_email,
      payer_first_name,
      payer_last_name,
      payer_doc_number,
      payment_method,
      buyer_user_id,
    } = await req.json();

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, commission_rate")
      .eq("id", company_id)
      .single();

    if (!company) throw new Error("Company not found");

    const subtotal = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
    const totalAmount = subtotal + (shipping_cost || 0);
    const commissionRate = company.commission_rate || 10;

    // Create marketplace order
    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .insert({
        product_id: items[0].product_id, // Primary product reference
        buyer_user_id,
        total_amount: totalAmount,
        quantity: items.reduce((s: number, i: any) => s + i.quantity, 0),
        mood_commission: Math.round(totalAmount * commissionRate) / 100,
        company_amount: totalAmount - Math.round(totalAmount * commissionRate) / 100 - Math.round(totalAmount * 5) / 100,
        shipping_cost: shipping_cost || 0,
        shipping_zip: shipping_zip || null,
        payment_method,
        items: JSON.stringify(items),
        status: "pending",
      } as any)
      .select()
      .single();

    if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);

    // Create Mercado Pago payment
    const itemDescriptions = items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
    const paymentBody: any = {
      transaction_amount: totalAmount,
      description: `Compra: ${itemDescriptions}`,
      external_reference: JSON.stringify({ order_id: order.id, type: "marketplace", company_id }),
      payer: {
        email: payer_email,
        first_name: payer_first_name || "",
        last_name: payer_last_name || "",
        identification: { type: "CPF", number: payer_doc_number || "" },
      },
    };

    if (payment_method === "pix") {
      paymentBody.payment_method_id = "pix";
    }

    const idempotencyKey = `mkt-${order.id}-${Date.now()}`;
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
    if (!response.ok) throw new Error(`MP error [${response.status}]: ${JSON.stringify(data)}`);

    // Update order with payment_id
    await supabase
      .from("marketplace_orders")
      .update({ payment_id: String(data.id) } as any)
      .eq("id", order.id);

    const result: any = { id: data.id, status: data.status, status_detail: data.status_detail };

    if (payment_method === "pix" && data.point_of_interaction?.transaction_data) {
      result.pix_qr_code = data.point_of_interaction.transaction_data.qr_code;
      result.pix_qr_code_base64 = data.point_of_interaction.transaction_data.qr_code_base64;
    }

    // If approved immediately (credit card)
    if (data.status === "approved") {
      await supabase
        .from("marketplace_orders")
        .update({ status: "paid" } as any)
        .eq("id", order.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
