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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const { pix_key, amount } = await req.json();
    if (!pix_key || !amount || amount <= 0) {
      throw new Error("Chave PIX e valor são obrigatórios");
    }

    // Calculate available balance server-side
    const { data: balances } = await supabase
      .from("organizer_balances")
      .select("amount")
      .eq("organizer_id", user.id)
      .eq("status", "paid");

    const totalBalance = (balances || []).reduce((sum: number, b: any) => sum + Number(b.amount), 0);

    // Get already requested withdrawals (pending/approved)
    const { data: pendingWithdrawals } = await supabase
      .from("withdrawal_requests")
      .select("amount")
      .eq("organizer_id", user.id)
      .in("status", ["pending", "approved"]);

    const pendingTotal = (pendingWithdrawals || []).reduce((sum: number, w: any) => sum + Number(w.amount), 0);

    const availableBalance = totalBalance - pendingTotal;

    if (amount > availableBalance) {
      throw new Error(`Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}`);
    }

    // Create withdrawal request
    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawal_requests")
      .insert({
        organizer_id: user.id,
        amount,
        pix_key,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, withdrawal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Withdrawal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
