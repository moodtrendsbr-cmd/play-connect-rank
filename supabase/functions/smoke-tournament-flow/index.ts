// Smoke do fluxo completo: cria torneio + 4 enrollments pagos,
// gera bracket (2 semis + 1 final), registra placares e confere o pódio.
// Apenas super admin. Marca torneio com prefixo [SMOKE] para ser ignorado pelo backfill.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPA_URL, ANON, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(SUPA_URL, SERVICE);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!isAdmin) return json({ ok: false, error: "forbidden" }, 403);

  const out: Record<string, unknown> = {};
  const checks: Record<string, boolean> = {};
  let step = "init";

  try {
    // 0. precisamos de 4 atletas distintos
    step = "find_athletes";
    const { data: athletes, error: ae } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .not("user_id", "is", null)
      .neq("user_id", u.user.id)
      .limit(4);
    if (ae) throw ae;
    if (!athletes || athletes.length < 4) {
      throw new Error(`need_4_athletes_have_${athletes?.length ?? 0}`);
    }

    // 1. tenant
    step = "tenant";
    const { data: tenant } = await admin.from("tenants").select("id").limit(1).maybeSingle();
    if (!tenant) throw new Error("no_tenant_available");

    // 2. tournament
    step = "tournament";
    const today = new Date().toISOString().slice(0, 10);
    const ts = new Date().toISOString().slice(11, 19);
    const { data: t, error: te } = await admin
      .from("tournaments")
      .insert({
        name: `[SMOKE] flow ${ts}`,
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

    // 3. modality (single_elimination, 4 slots)
    step = "modality";
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
        phase: "knockout",
      })
      .select("id")
      .single();
    if (me) throw me;
    out.modality_id = mod.id;

    // 4. 4 enrollments pagas com modality_id
    step = "enrollments";
    const enrollmentIds: string[] = [];
    for (const a of athletes) {
      const { data: en, error: ee } = await admin
        .from("enrollments")
        .insert({
          tournament_id: t.id,
          user_id: a.user_id,
          tenant_id: tenant.id,
          modality_id: mod.id,
          status: "pending",
          amount_paid: 1,
          athlete_name: a.full_name ?? "Smoke Athlete",
        })
        .select("id")
        .single();
      if (ee) throw ee;
      enrollmentIds.push(en.id);
    }

    for (const id of enrollmentIds) {
      const { error: ue } = await admin
        .from("enrollments")
        .update({ status: "paid", payment_id: `smoke-${id.slice(0, 8)}` })
        .eq("id", id);
      if (ue) throw ue;
    }
    await new Promise((r) => setTimeout(r, 1200));

    // 5. confere entries e members criados pelos triggers
    step = "verify_entries";
    const { data: entries } = await admin
      .from("modality_entries")
      .select("id, name")
      .eq("modality_id", mod.id);
    out.entries_count = entries?.length ?? 0;
    checks.four_entries_created = (entries?.length ?? 0) === 4;

    const { data: members } = await admin
      .from("modality_entry_members")
      .select("entry_id, user_id")
      .in("entry_id", (entries ?? []).map((e: any) => e.id));
    out.members_count = members?.length ?? 0;
    checks.four_members_created = (members?.length ?? 0) === 4;

    if (!checks.four_entries_created) {
      throw new Error("entries_not_created_by_trigger");
    }

    // 6. invoca generate-bracket
    step = "generate_bracket";
    const genRes = await fetch(`${SUPA_URL}/functions/v1/generate-bracket`, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        "Content-Type": "application/json",
        apikey: ANON,
      },
      body: JSON.stringify({ modality_id: mod.id, format: "single_elimination" }),
    });
    const genBody = await genRes.json().catch(() => ({}));
    out.generate_bracket = { status: genRes.status, body: genBody };
    if (!genRes.ok) throw new Error(`generate_bracket_failed_${genRes.status}`);

    await new Promise((r) => setTimeout(r, 400));

    // 7. confere 2 semis + 1 final
    step = "verify_matches";
    const { data: matches } = await admin
      .from("modality_matches")
      .select("id, round_number, match_number, entry_a_id, entry_b_id, source_a_match_id, source_b_match_id")
      .eq("modality_id", mod.id)
      .order("round_number")
      .order("match_number");
    out.matches = matches;
    const semis = (matches ?? []).filter((m: any) => m.round_number === 1);
    const finals = (matches ?? []).filter((m: any) => m.round_number === 2);
    checks.two_semis = semis.length === 2;
    checks.one_final = finals.length === 1;
    if (!checks.two_semis || !checks.one_final) {
      throw new Error(`unexpected_bracket_shape_semis_${semis.length}_finals_${finals.length}`);
    }

    // 8. registra placar nas semis (entry_a vence)
    step = "score_semis";
    for (const s of semis) {
      if (!s.entry_a_id || !s.entry_b_id) continue;
      const { error } = await admin
        .from("modality_matches")
        .update({
          score_a: 6,
          score_b: 2,
          winner_entry_id: s.entry_a_id,
          status: "finished",
        })
        .eq("id", s.id);
      if (error) throw error;
    }
    await new Promise((r) => setTimeout(r, 800));

    // 9. confere avanço para a final
    step = "verify_advance";
    const { data: finalAfter } = await admin
      .from("modality_matches")
      .select("id, entry_a_id, entry_b_id")
      .eq("id", finals[0].id)
      .maybeSingle();
    out.final_after_semis = finalAfter;
    checks.final_filled = !!finalAfter?.entry_a_id && !!finalAfter?.entry_b_id;
    if (!checks.final_filled) {
      throw new Error("trg_matches_advance_did_not_fill_final");
    }

    // 10. registra placar da final (entry_a vence)
    step = "score_final";
    const { error: fe } = await admin
      .from("modality_matches")
      .update({
        score_a: 6,
        score_b: 4,
        winner_entry_id: finalAfter!.entry_a_id,
        status: "finished",
      })
      .eq("id", finals[0].id);
    if (fe) throw fe;
    await new Promise((r) => setTimeout(r, 800));

    // 11. confere pódio
    step = "verify_podium";
    const { data: placements } = await admin
      .from("modality_placements")
      .select("position, entry_id")
      .eq("modality_id", mod.id)
      .order("position");
    out.placements = placements;
    const positions = (placements ?? []).map((p: any) => p.position).sort();
    checks.podium_has_first = positions.includes(1);
    checks.podium_has_second = positions.includes(2);

    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const ok = failed.length === 0;
    return json({
      ok,
      step: ok ? "done" : step,
      checks,
      failed,
      tournament_id: t.id,
      modality_id: mod.id,
      summary: {
        enrollments: enrollmentIds.length,
        entries: out.entries_count,
        members: out.members_count,
        matches: (matches ?? []).length,
        placements: (placements ?? []).length,
      },
      detail: out,
    }, ok ? 200 : 500);
  } catch (e: any) {
    return json({
      ok: false,
      step,
      error: e?.message ?? String(e),
      checks,
      partial: out,
    }, 500);
  }
});
