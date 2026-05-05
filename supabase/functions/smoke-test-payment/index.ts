// Smoke-test BRUTAL: cria torneio + modality + enrollment com modality_id,
// força paid e valida cada etapa do fluxo. Falha se entry/member/attribution
// não vierem. Apenas super admin.
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
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out: Record<string, unknown> = {};
  const checks: Record<string, boolean> = {};

  try {
    // 1. tenant + tournament
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

    // 2. tournament_modality
    const { data: mod, error: me } = await admin
      .from("tournament_modalities")
      .insert({
        tournament_id: t.id,
        tenant_id: tenant.id,
        name: "Smoke Open",
        type: "individual",
        team_size: 1,
        sport: "Beach Tennis",
        gender: "Misto",
        level: "Open",
        max_entries: 4,
        status: "open",
        bracket_format: "single_elimination",
        phase: "groups_then_ko",
      })
      .select("id")
      .single();
    if (me) throw me;
    out.modality_id = mod.id;

    // 3. enrollment pending COM modality_id
    const { data: en, error: ee } = await admin
      .from("enrollments")
      .insert({
        tournament_id: t.id,
        user_id: u.user.id,
        tenant_id: tenant.id,
        modality_id: mod.id,
        status: "pending",
        amount_paid: 1,
      })
      .select("id")
      .single();
    if (ee) throw ee;
    out.enrollment_id = en.id;

    // 4. paid
    const { error: ue } = await admin
      .from("enrollments")
      .update({ status: "paid", payment_id: `smoke-${Date.now()}` })
      .eq("id", en.id);
    if (ue) throw ue;

    // 5. esperar triggers
    await new Promise((r) => setTimeout(r, 700));

    // 6. coletar evidências
    const [
      { data: enrAfter },
      { data: acts },
      { data: ftx },
      { data: attr },
      { data: queue },
    ] = await Promise.all([
      admin.from("enrollments").select("id, status, modality_id, entry_id").eq("id", en.id).maybeSingle(),
      admin.from("athlete_activities").select("activity_type, reference_id").eq("athlete_id", u.user.id).order("created_at", { ascending: false }).limit(5),
      admin.from("financial_transactions").select("id, status, total_amount, source_type, source_id, paid_at").eq("source_id", en.id),
      admin.from("orkym_revenue_attribution").select("id, attribution_type, attribution_confidence, revenue_amount").eq("entity_id", en.id),
      admin.from("orkym_triggers_queue").select("id, trigger_type, status, dedup_key").eq("entity_id", t.id),
    ]);

    out.enrollment_after = enrAfter;
    out.athlete_activities = acts;
    out.financial_transactions = ftx;
    out.revenue_attribution = attr;
    out.triggers_queued = queue;

    // entry + member
    let entryRow: any = null;
    let memberRow: any = null;
    if (enrAfter?.entry_id) {
      const { data: e } = await admin.from("modality_entries").select("id, modality_id, name").eq("id", enrAfter.entry_id).maybeSingle();
      entryRow = e;
      const { data: m } = await admin.from("modality_entry_members").select("entry_id, user_id").eq("entry_id", enrAfter.entry_id);
      memberRow = m;
    }
    out.modality_entry = entryRow;
    out.modality_entry_members = memberRow;

    // 7. checks
    checks.enrollment_paid = enrAfter?.status === "paid";
    checks.enrollment_has_modality = !!enrAfter?.modality_id;
    checks.enrollment_has_entry = !!enrAfter?.entry_id;
    checks.entry_created = !!entryRow && entryRow.modality_id === mod.id;
    checks.member_created = Array.isArray(memberRow) && memberRow.length > 0;
    checks.financial_transaction_paid = Array.isArray(ftx) && ftx.some((f: any) => f.status === "paid");
    checks.athlete_activity_created = Array.isArray(acts) && acts.length > 0;
    checks.revenue_attribution_created = Array.isArray(attr) && attr.length > 0;

    const failed = Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k);
    const ok = failed.length === 0;

    return new Response(
      JSON.stringify({ ok, checks, failed, ...out }),
      {
        status: ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? String(e), checks, partial: out }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
