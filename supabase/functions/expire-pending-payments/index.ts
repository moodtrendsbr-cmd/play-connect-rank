import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Expire pending enrollments and bookings older than 30 minutes.
 * Invokable manually (admin) or by a future scheduler.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);

    // Verify admin
    const { data: roleRow } = await userClient
      .from("user_roles").select("role")
      .eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: nEnrollments, error: e1 } = await admin.rpc("expire_pending_enrollments");
    if (e1) throw e1;

    // Bookings: cancel pending_payment older than 30min
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: bookings, error: e2 } = await admin
      .from("bookings")
      .update({ status: "canceled" })
      .eq("status", "pending_payment")
      .lt("created_at", cutoff)
      .select("id");
    if (e2) throw e2;

    // Subscriptions: marca como overdue quando next_billing_at vencido há > 3 dias
    const overdueCutoff = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    const { data: overdueSubs, error: e3 } = await admin
      .from("subscriptions")
      .update({ status: "overdue" })
      .in("status", ["active", "trial"])
      .lt("next_billing_at", overdueCutoff)
      .select("id");
    if (e3) throw e3;

    return json({
      ok: true,
      expired_enrollments: nEnrollments ?? 0,
      expired_bookings: bookings?.length ?? 0,
      overdue_subscriptions: overdueSubs?.length ?? 0,
    });
  } catch (err: any) {
    return json({ error: err?.message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
