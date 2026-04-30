// control-tower-execute — Phase H "1-click execution"
// Single endpoint that turns a Control Tower recommendation into a real
// growth flow (campaign / queued message / boost). All decisions are
// deterministic (no local AI). Reuses existing tables and the shared
// orkym-handlers dispatcher. Guardrails: kill-switch + budget + dedup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchAction, type ProposalLike } from "../_shared/orkym-handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ScopeIn {
  type: "admin" | "tenant" | "arena" | "organizer" | "company";
  id?: string | null;
}

interface RecommendationIn {
  id?: string;
  title?: string;
  body?: string;
  action_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
}

// Action types that consume growth budget.
const BUDGETED_ACTIONS = new Set([
  "tournament_boost",
  "create_campaign",
  "product_boost",
  "company_boost",
]);

// Symbolic cost per click (BRL). Real boost spend already tracked by
// trg_growth_record_boost_spend on financial_transactions paid.
const SYMBOLIC_COST = 1;

async function resolveScope(
  admin: any,
  userId: string,
  scope: ScopeIn,
): Promise<{ tenant_id: string; arena_id: string | null } | null> {
  // Admin global → no tenant resolution; pick a default tenant from any
  // arena/tenant the admin has visibility on. For Phase H we accept admin
  // running against a system-wide default tenant if none provided.
  if (scope.type === "tenant" && scope.id) {
    const { data: ok } = await admin.rpc("is_tenant_admin", {
      _tenant_id: scope.id,
      _user_id: userId,
    });
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (!ok && !isAdmin) return null;
    return { tenant_id: scope.id, arena_id: null };
  }
  if (scope.type === "arena" && scope.id) {
    const { data: arena } = await admin
      .from("arenas")
      .select("id, tenant_id")
      .eq("id", scope.id)
      .maybeSingle();
    if (!arena) return null;
    const { data: owner } = await admin.rpc("is_arena_owner", {
      _arena_id: scope.id,
      _user_id: userId,
    });
    const { data: tAdmin } = await admin.rpc("is_tenant_admin", {
      _tenant_id: arena.tenant_id,
      _user_id: userId,
    });
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (!owner && !tAdmin && !isAdmin) return null;
    return { tenant_id: arena.tenant_id, arena_id: scope.id };
  }
  if (scope.type === "company" && scope.id) {
    const { data: c } = await admin
      .from("companies")
      .select("id, tenant_id, user_id")
      .eq("id", scope.id)
      .maybeSingle();
    if (!c) return null;
    const { data: tAdmin } = await admin.rpc("is_tenant_admin", {
      _tenant_id: c.tenant_id,
      _user_id: userId,
    });
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (c.user_id !== userId && !tAdmin && !isAdmin) return null;
    return { tenant_id: c.tenant_id, arena_id: null };
  }
  if (scope.type === "admin") {
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) return null;
    // Fall back to the default tenant for global ops.
    return { tenant_id: "00000000-0000-0000-0000-000000000001", arena_id: null };
  }
  return null;
}

async function killSwitchActive(
  admin: any,
  tenantId: string,
  arenaId: string | null,
  actionType: string,
): Promise<boolean> {
  const ors = [
    `scope_level.eq.global`,
    `and(scope_level.eq.tenant,tenant_id.eq.${tenantId})`,
    arenaId ? `and(scope_level.eq.arena,arena_id.eq.${arenaId})` : "",
    `and(scope_level.eq.action_type,action_type.eq.${actionType})`,
  ].filter(Boolean).join(",");
  const { data } = await admin
    .from("autonomy_kill_switches")
    .select("id")
    .eq("is_active", true)
    .or(ors)
    .limit(1)
    .maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return safeJson({ ok: false, error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPA_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claims?.claims) {
      return safeJson({ ok: false, error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const scope = body?.scope as ScopeIn | undefined;
    const rec = body?.recommendation as RecommendationIn | undefined;
    if (!scope?.type || !rec?.action_type) {
      return safeJson({ ok: false, error: "scope_and_action_type_required" }, 400);
    }

    const admin = createClient(SUPA_URL, SERVICE_KEY);

    const resolved = await resolveScope(admin, userId, scope);
    if (!resolved) return safeJson({ ok: false, error: "forbidden" }, 403);
    const { tenant_id, arena_id } = resolved;

    // 1) Kill switch
    if (await killSwitchActive(admin, tenant_id, arena_id, rec.action_type)) {
      return safeJson({ ok: true, status: "blocked", reason: "kill_switch" });
    }

    // 2) Budget gate (only for budgeted actions)
    if (BUDGETED_ACTIONS.has(rec.action_type)) {
      try {
        const budgetScopeType = arena_id ? "arena" : "tenant";
        const budgetScopeId = arena_id ?? tenant_id;
        const { data: bud } = await admin.rpc("growth_check_budget", {
          _scope_type: budgetScopeType,
          _scope_id: budgetScopeId,
          _amount_brl: SYMBOLIC_COST,
        });
        const row = Array.isArray(bud) ? bud[0] : bud;
        if (row && row.allowed === false) {
          return safeJson({ ok: true, status: "blocked", reason: "budget" });
        }
      } catch (e) {
        console.warn("growth_check_budget failed (fail-open)", e);
      }
    }

    // 3) Idempotency dedup
    const hourBucket = new Date().toISOString().slice(0, 13);
    const dedupKey =
      `ct:${tenant_id}:${arena_id ?? "-"}:${rec.action_type}:${rec.entity_id ?? "-"}:${hourBucket}`;

    // 4) Build proposal (auto-mode) and persist for audit/attribution
    const proposalRow = {
      tenant_id,
      arena_id,
      domain: "growth",
      action_type: rec.action_type,
      title: rec.title ?? "Ação da Visão Geral",
      description: rec.body ?? null,
      priority: "medium",
      status: "executing" as const,
      related_entity_type: rec.entity_type ?? null,
      related_entity_id: rec.entity_id ?? null,
      proposed_payload: { ...(rec.payload ?? {}), source: "control_tower" },
      human_summary: { source: "control_tower", dedup_key: dedupKey },
      source: "orkym",
      execution_mode: "auto",
      auto_executed: false,
      orkym_request_id: dedupKey,
    };

    const { data: ins, error: insErr } = await admin
      .from("orkym_action_proposals")
      .insert(proposalRow)
      .select("*")
      .single();

    let proposal: any;
    if (insErr) {
      // Likely dedup hit on (orkym_request_id, action_type, related_entity_id)
      const { data: existing } = await admin
        .from("orkym_action_proposals")
        .select("*")
        .eq("orkym_request_id", dedupKey)
        .eq("action_type", rec.action_type)
        .maybeSingle();
      if (existing && (existing.status === "executed" || existing.status === "executing")) {
        return safeJson({
          ok: true,
          status: "blocked",
          reason: "already_running",
        });
      }
      if (!existing) {
        return safeJson({ ok: false, error: insErr.message }, 500);
      }
      proposal = existing;
    } else {
      proposal = ins;
    }

    // 5) Dispatch via shared handler
    const proposalLike: ProposalLike = {
      id: proposal.id,
      tenant_id: proposal.tenant_id,
      arena_id: proposal.arena_id,
      title: proposal.title,
      description: proposal.description,
      priority: proposal.priority,
      action_type: proposal.action_type,
      proposed_payload: proposal.proposed_payload ?? {},
      related_entity_type: proposal.related_entity_type,
      related_entity_id: proposal.related_entity_id,
      correlation_id: proposal.correlation_id ?? null,
    };

    const startedAt = Date.now();
    const result = await dispatchAction(admin, proposalLike);
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      await admin
        .from("orkym_action_proposals")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          failure_reason: result.error ?? "unknown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      // Surface as user-friendly blocked instead of failed
      return safeJson({ ok: true, status: "blocked", reason: "no_targets" });
    }

    await admin
      .from("orkym_action_proposals")
      .update({
        status: "executed",
        auto_executed: true,
        executed_at: new Date().toISOString(),
        execution_result: result.result ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposal.id);

    // Record symbolic budget spend
    if (BUDGETED_ACTIONS.has(rec.action_type)) {
      try {
        const budgetScopeType = arena_id ? "arena" : "tenant";
        const budgetScopeId = arena_id ?? tenant_id;
        await admin.rpc("growth_record_spend", {
          _scope_type: budgetScopeType,
          _scope_id: budgetScopeId,
          _amount_brl: SYMBOLIC_COST,
          _is_boost: true,
        });
      } catch (e) {
        console.warn("growth_record_spend failed", e);
      }
    }

    if (arena_id) {
      await admin.from("arena_operational_events").insert({
        tenant_id,
        arena_id,
        entity_type: "control_tower_action",
        entity_id: proposal.id,
        event_type: "control_tower.action_executed",
        payload: {
          action_type: rec.action_type,
          result: result.result,
          duration_ms: durationMs,
        },
        source: "system",
      });
    }

    return safeJson({
      ok: true,
      status: "executed",
      action_type: rec.action_type,
      result: result.result ?? {},
    });
  } catch (err: any) {
    console.error("control-tower-execute error", err);
    return safeJson({ ok: false, error: err?.message ?? "internal" }, 500);
  }
});
