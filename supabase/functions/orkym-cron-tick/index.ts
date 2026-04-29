import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ORKYM cron tick — runs every ~15min via pg_cron.
 * Reads unprocessed arena_operational_events, groups per (arena_id, domain)
 * and sends a batched signal to ORKYM via orkym-invoke. Marks processed.
 */

const EVENT_TO_DOMAIN: Record<string, { domain: string; action: string }> = {
  "billing.overdue":          { domain: "finance",          action: "overdue_review" },
  "billing.paid":             { domain: "finance",          action: "payment_received" },
  "attendance.absent":        { domain: "arena_operations", action: "attendance_signal" },
  "finance.payment_received": { domain: "finance",          action: "payment_received" },
  "finance.refund_created":   { domain: "finance",          action: "refund_signal" },
  "finance.payment_canceled": { domain: "finance",          action: "cancel_signal" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pull a bounded backlog
  const { data: events, error } = await admin
    .from("arena_operational_events")
    .select("id, tenant_id, arena_id, event_type, entity_type, entity_id, payload, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group by (arena_id, domain, action)
  type Bucket = { arena_id: string; tenant_id: string; domain: string; action: string; events: any[] };
  const buckets = new Map<string, Bucket>();
  const unmapped: string[] = [];

  for (const ev of events) {
    const map = EVENT_TO_DOMAIN[ev.event_type as string];
    if (!map || !ev.arena_id) {
      unmapped.push(ev.id);
      continue;
    }
    const key = `${ev.arena_id}|${map.domain}|${map.action}`;
    if (!buckets.has(key)) {
      buckets.set(key, { arena_id: ev.arena_id, tenant_id: ev.tenant_id, domain: map.domain, action: map.action, events: [] });
    }
    buckets.get(key)!.events.push({
      id: ev.id, type: ev.event_type, entity_type: ev.entity_type,
      entity_id: ev.entity_id, payload: ev.payload, created_at: ev.created_at,
    });
  }

  // Internal service-token call to orkym-invoke per bucket.
  // We re-use the edge function to keep dedup/retry/log behaviour consistent.
  const invokeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/orkym-invoke`;
  const serviceJwt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let invokedOk = 0;
  const processedIds: string[] = [...unmapped];

  for (const bucket of buckets.values()) {
    try {
      const resp = await fetch(invokeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceJwt}`,
          "Content-Type": "application/json",
          "apikey": serviceJwt,
        },
        body: JSON.stringify({
          domain: bucket.domain,
          action: bucket.action,
          payload: {
            tenant_id: bucket.tenant_id,
            arena_id: bucket.arena_id,
            context: { source: "cron_tick", event_count: bucket.events.length },
            entity: { events: bucket.events.slice(0, 50) },
            metadata: { batch: true },
          },
        }),
      });
      await resp.text();
      if (resp.ok) invokedOk += 1;
    } catch (e) {
      console.error("orkym-cron-tick bucket failed", e);
    }
    // Mark events of this bucket processed regardless (avoid replay storms).
    for (const ev of bucket.events) processedIds.push(ev.id);
  }

  if (processedIds.length > 0) {
    await admin
      .from("arena_operational_events")
      .update({ processed_at: new Date().toISOString() })
      .in("id", processedIds);
  }

  // Opportunistic dedup cleanup
  await admin.rpc("orkym_purge_dedup");

  // Phase 12.7 — expire stale conversation sessions
  let expiredSessions = 0;
  try {
    const { data: exp } = await admin.rpc("expire_stale_sessions", {
      _resume_window_minutes: 30,
    });
    expiredSessions = (exp as number) ?? 0;
  } catch (e) {
    console.error("expire_stale_sessions failed", e);
  }

  // Phase 12.8 — memory decay + periodic extraction (best-effort)
  let memoryDecay: unknown = null;
  let memoryExtract: unknown = null;
  try {
    const { data: d } = await admin.rpc("memory_apply_decay");
    memoryDecay = d;
  } catch (e) { console.error("memory_apply_decay failed", e); }
  try {
    const { data: x } = await admin.rpc("memory_extract_all", { _batch_size: 100 });
    memoryExtract = x;
  } catch (e) { console.error("memory_extract_all failed", e); }

  // Phase 12.9 — proactive ops: generate periodic triggers, then process queue
  let proactiveGen: unknown = null;
  let proactiveProcess: unknown = null;
  let optimizationGen: unknown = null;
  let growthGen: unknown = null;
  try {
    const { data: g } = await admin.rpc("orkym_generate_periodic_triggers");
    proactiveGen = g;
  } catch (e) { console.error("orkym_generate_periodic_triggers failed", e); }
  // Phase 13 — conversational revenue: emit optimization signals
  try {
    const { data: o } = await admin.rpc("orkym_generate_optimization_triggers");
    optimizationGen = o;
  } catch (e) { console.error("orkym_generate_optimization_triggers failed", e); }
  // Phase G — Autonomous Growth Engine: emit opportunity triggers
  try {
    const { data: gg } = await admin.rpc("growth_generate_opportunity_triggers");
    growthGen = gg;
  } catch (e) { console.error("growth_generate_opportunity_triggers failed", e); }
  try {
    const internalToken = Deno.env.get("ORKYM_INTERNAL_TOKEN") || "";
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/orkym-proactive-process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceJwt}`,
        "x-internal-token": internalToken,
      },
      body: JSON.stringify({ limit: 100 }),
    });
    proactiveProcess = await r.json().catch(() => ({ ok: false }));
  } catch (e) { console.error("orkym-proactive-process failed", e); }

  return new Response(JSON.stringify({
    ok: true,
    processed: processedIds.length,
    buckets: buckets.size,
    invoked_ok: invokedOk,
    expired_sessions: expiredSessions,
    memory_decay: memoryDecay,
    memory_extract: memoryExtract,
    proactive_generated: proactiveGen,
    proactive_processed: proactiveProcess,
    optimization_generated: optimizationGen,
    growth_generated: growthGen,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
