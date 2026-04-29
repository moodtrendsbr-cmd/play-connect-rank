// Smoke-test: cria um torneio fictício R$ 1, gera enrollment paid manualmente
// e força os triggers a rodar (athlete_activities + financial_transactions +
// orkym_revenue_attribution + orkym_triggers_queue). Apenas super admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPA_URL, ANON, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPA_URL, SERVICE);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out: Record<string, unknown> = {};
  try {
    // 1. Tenant + tournament
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!tenant) throw new Error("no_tenant_available");

    const today = new Date().toISOString().slice(0, 10);
    const { data: t, error: te } = await admin
      .from("tournaments")
      .insert({
        name: `[SMOKE] ${new Date().toISOString().slice(11, 19)}`,
        organizer_id: u.user.id,
        tenant_id: tenant.id,
        modality: "Beach Tennis",
        arena: "Smoke Arena",
        city: "Smoke",
        state: "SP",
        start_date: today,
        end_date: today,
        entry_fee: 1,
        max_slots: 4,
      })
      .select("id")
      .single();
    if (te) throw te;
    out.tournament_id = t.id;

    // 2. Enrollment (insert pending → triggers activity + memory + notification)
    const { data: en, error: ee } = await admin
      .from("enrollments")
      .insert({
        tournament_id: t.id,
        user_id: u.user.id,
        tenant_id: tenant.id,
        status: "pending",
        amount_paid: 1,
      })
      .select("id")
      .single();
    if (ee) throw ee;
    out.enrollment_id = en.id;

    // 3. Update to paid → triggers record_payment + checked_in activity + notify
    const { error: ue } = await admin
      .from("enrollments")
      .update({
        status: "paid",
        payment_id: `smoke-${Date.now()}`,
      })
      .eq("id", en.id);
    if (ue) throw ue;

    // 4. Pequena espera para triggers liquidar
    await new Promise((r) => setTimeout(r, 500));

    // 5. Coletar evidências
    const [{ data: acts }, { data: ftx }, { data: attr }, { data: queue }] =
      await Promise.all([
        admin.from("athlete_activities").select("activity_type, reference_id").eq("athlete_id", u.user.id).order("created_at", { ascending: false }).limit(5),
        admin.from("financial_transactions").select("id, status, total_amount, source_type, source_id, paid_at").eq("source_id", en.id),
        admin.from("orkym_revenue_attribution").select("id, attribution_type, attribution_confidence, revenue_amount").eq("entity_id", t.id),
        admin.from("orkym_triggers_queue").select("id, trigger_type, status, dedup_key").eq("entity_id", t.id),
      ]);

    out.athlete_activities = acts;
    out.financial_transactions = ftx;
    out.revenue_attribution = attr;
    out.triggers_queued = queue;

    return new Response(JSON.stringify({ ok: true, ...out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e), partial: out }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
