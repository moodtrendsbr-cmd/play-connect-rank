import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Format = "single_elimination" | "double_elimination" | "round_robin" | "groups";

interface Body {
  modality_id: string;
  format: Format;
  num_groups?: number;
}

interface Match {
  modality_id: string;
  tenant_id: string | null;
  group_id?: string | null;
  round_number: number;
  match_number: number;
  entry_a_id: string | null;
  entry_b_id: string | null;
  status?: string;
  winner_entry_id?: string | null;
  source_a_match_id?: string | null;
  source_b_match_id?: string | null;
  source_a_role?: "winner" | "loser" | null;
  source_b_role?: "winner" | "loser" | null;
  bracket_side?: "winners" | "losers" | "final" | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function seedingOrder(size: number): number[] {
  let rounds: number[][] = [[1, 2]];
  while (rounds[0].length < size) {
    const next: number[][] = [];
    const pairs = rounds[0];
    const total = pairs.length * 2 * 2;
    const flat: number[] = [];
    for (const s of pairs) flat.push(s);
    const out: number[] = [];
    for (const s of flat) {
      out.push(s);
      out.push(total + 1 - s);
    }
    rounds = [out];
  }
  return rounds[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body?.modality_id || !body?.format) {
      return new Response(JSON.stringify({ error: "modality_id and format are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: ownerOk } = await admin.rpc("is_modality_tournament_owner", {
      _modality_id: body.modality_id,
      _user_id: userId,
    });
    const { data: adminOk } = await admin.rpc("is_admin", { _user_id: userId });
    if (!ownerOk && !adminOk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: modality } = await admin
      .from("tournament_modalities")
      .select("id, tenant_id")
      .eq("id", body.modality_id)
      .single();

    const tenantId = modality?.tenant_id ?? null;

    const { data: entriesData } = await admin
      .from("modality_entries")
      .select("id, seed")
      .eq("modality_id", body.modality_id);

    const entries = entriesData || [];
    if (entries.length < 2) {
      return new Response(JSON.stringify({ error: "Mínimo de 2 inscritos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("modality_matches").delete().eq("modality_id", body.modality_id);
    await admin.from("modality_groups").delete().eq("modality_id", body.modality_id);

    const matches: Match[] = [];
    const numGroups = body.num_groups || 2;

    if (body.format === "round_robin") {
      const sh = shuffle(entries);
      let mn = 1;
      for (let i = 0; i < sh.length; i++) {
        for (let j = i + 1; j < sh.length; j++) {
          matches.push({
            modality_id: body.modality_id,
            tenant_id: tenantId,
            round_number: 1,
            match_number: mn++,
            entry_a_id: sh[i].id,
            entry_b_id: sh[j].id,
          });
        }
      }
    } else if (body.format === "groups") {
      const groupNames = "ABCDEFGH".split("").slice(0, numGroups);
      const { data: createdGroups } = await admin
        .from("modality_groups")
        .insert(groupNames.map((name) => ({ modality_id: body.modality_id, group_name: name, tenant_id: tenantId })))
        .select();

      if (createdGroups) {
        const sh = shuffle(entries);
        const groupMembers: any[] = [];
        sh.forEach((entry, idx) => {
          const g = createdGroups[idx % createdGroups.length];
          groupMembers.push({ group_id: g.id, entry_id: entry.id });
        });
        await admin.from("modality_group_members").insert(groupMembers);

        let mn = 1;
        for (const g of createdGroups) {
          const ge = groupMembers.filter((m) => m.group_id === g.id).map((m) => m.entry_id);
          for (let i = 0; i < ge.length; i++) {
            for (let j = i + 1; j < ge.length; j++) {
              matches.push({
                modality_id: body.modality_id,
                tenant_id: tenantId,
                group_id: g.id,
                round_number: 1,
                match_number: mn++,
                entry_a_id: ge[i],
                entry_b_id: ge[j],
                status: "scheduled",
              });
            }
          }
        }
      }
    } else {
      const N = entries.length;
      const size = nextPow2(N);
      const totalRounds = Math.log2(size);
      const order = seedingOrder(size);

      const seedShuffled = shuffle(entries);
      const seedToEntry = new Map<number, string | null>();
      for (let i = 0; i < size; i++) {
        seedToEntry.set(i + 1, i < N ? seedShuffled[i].id : null);
      }

      const winnersByRound: Match[][] = [];

      const r1: Match[] = [];
      for (let i = 0; i < size; i += 2) {
        const aSeed = order[i];
        const bSeed = order[i + 1];
        const aId = seedToEntry.get(aSeed) ?? null;
        const bId = seedToEntry.get(bSeed) ?? null;
        const isBye = aId === null || bId === null;
        const winner = isBye ? (aId ?? bId) : null;
        r1.push({
          modality_id: body.modality_id,
          tenant_id: tenantId,
          round_number: 1,
          match_number: i / 2 + 1,
          entry_a_id: aId,
          entry_b_id: bId,
          status: isBye && winner ? "finished" : "scheduled",
          winner_entry_id: isBye ? winner : null,
          bracket_side: "winners",
        });
      }
      winnersByRound.push(r1);

      let prev = r1;
      for (let r = 2; r <= totalRounds; r++) {
        const cur: Match[] = [];
        for (let i = 0; i < prev.length; i += 2) {
          cur.push({
            modality_id: body.modality_id,
            tenant_id: tenantId,
            round_number: r,
            match_number: i / 2 + 1,
            entry_a_id: null,
            entry_b_id: null,
            status: "scheduled",
            bracket_side: r === totalRounds ? "final" : "winners",
          });
        }
        winnersByRound.push(cur);
        prev = cur;
      }

      const allWinnersFlat = winnersByRound.flat();
      matches.push(...allWinnersFlat);

      let losersByRound: Match[][] = [];
      if (body.format === "double_elimination" && totalRounds >= 1) {
        const lRounds = Math.max(1, 2 * totalRounds - 1);
        let lMatchCount = Math.max(1, Math.floor(winnersByRound[0].length / 2));
        for (let lr = 1; lr <= lRounds; lr++) {
          const cur: Match[] = [];
          for (let i = 0; i < lMatchCount; i++) {
            cur.push({
              modality_id: body.modality_id,
              tenant_id: tenantId,
              round_number: lr,
              match_number: i + 1,
              entry_a_id: null,
              entry_b_id: null,
              status: "scheduled",
              bracket_side: "losers",
            });
          }
          losersByRound.push(cur);
          if (lr % 2 === 0) lMatchCount = Math.max(1, Math.floor(lMatchCount / 2));
        }
        matches.push(...losersByRound.flat());

        matches.push({
          modality_id: body.modality_id,
          tenant_id: tenantId,
          round_number: totalRounds + 1,
          match_number: 1,
          entry_a_id: null,
          entry_b_id: null,
          bracket_side: "final",
        });
      }
    }

    if (matches.length > 0) {
      const { error: insErr } = await admin.from("modality_matches").insert(matches);
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (body.format === "single_elimination" || body.format === "double_elimination") {
      const { data: dbMatches } = await admin
        .from("modality_matches")
        .select("id, round_number, match_number, bracket_side")
        .eq("modality_id", body.modality_id);

      const winners = (dbMatches || []).filter((m: any) => (m.bracket_side ?? "winners") === "winners" || m.bracket_side === "final");

      const key = (side: string, r: number, m: number) => `${side}:${r}:${m}`;
      const idx = new Map<string, string>();
      for (const m of dbMatches || []) {
        idx.set(key(((m as any).bracket_side ?? "winners"), (m as any).round_number, (m as any).match_number), (m as any).id);
      }

      const winnersRounds = winners.length > 0 ? Math.max(...winners.map((m: any) => m.round_number)) : 0;

      const updates: Array<{ id: string; patch: any }> = [];

      for (let r = 2; r <= winnersRounds; r++) {
        const sideForCurrent = r === winnersRounds ? "final" : "winners";
        const sideForPrev = "winners";
        const matchesInR = winners.filter((m: any) => m.round_number === r);
        for (const m of matchesInR) {
          const srcA = idx.get(key(sideForPrev, r - 1, (m as any).match_number * 2 - 1));
          const srcB = idx.get(key(sideForPrev, r - 1, (m as any).match_number * 2));
          updates.push({
            id: (m as any).id,
            patch: {
              source_a_match_id: srcA ?? null,
              source_b_match_id: srcB ?? null,
              source_a_role: "winner",
              source_b_role: "winner",
            },
          });
        }
      }

      for (const u of updates) {
        await admin.from("modality_matches").update(u.patch).eq("id", u.id);
      }

      const { data: byes } = await admin
        .from("modality_matches")
        .select("id, winner_entry_id")
        .eq("modality_id", body.modality_id)
        .eq("round_number", 1)
        .not("winner_entry_id", "is", null);
      for (const b of byes || []) {
        await admin.from("modality_matches").update({ winner_entry_id: (b as any).winner_entry_id }).eq("id", (b as any).id);
      }
    }

    await admin
      .from("tournament_modalities")
      .update({
        status: "bracket_generated",
        bracket_format: body.format,
        num_groups: body.format === "groups" ? numGroups : 0,
      })
      .eq("id", body.modality_id);

    return new Response(JSON.stringify({ ok: true, matches_inserted: matches.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bracket error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
