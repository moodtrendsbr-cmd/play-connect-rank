import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * ORKYM Bridge — Phase 7 production wiring.
 * Server-to-server: validates user JWT, forwards to ORKYM with service token,
 * dedups, rate-limits, retries 5xx, logs every call. Never throws to client.
 */

// In-memory rate limit per tenant (cold starts reset; acceptable for v1).
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_PER_MIN = 60;

const SENSITIVE_KEYS = new Set([
  "password", "cpf", "email", "phone", "whatsapp", "token", "authorization",
  "service_token", "hmac_secret", "secret", "api_key",
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || lower.startsWith("_secret")) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "...";
  return value;
}

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(tenantId);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(tenantId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MIN) return false;
  bucket.count += 1;
  return true;
}

async function dedupKey(domain: string, action: string, payload: any): Promise<string> {
  const entityId = payload?.entity?.id ?? payload?.entity?.entity_id ?? "";
  const base = `${domain}|${action}|${payload?.tenant_id ?? ""}|${payload?.arena_id ?? ""}|${entityId}`;
  if (entityId) return base;
  // No entity → hash the payload context for stability
  const ctxStr = JSON.stringify(payload?.context ?? {});
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ctxStr));
  const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${base}|${hex.slice(0, 16)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  let logRow: Record<string, unknown> = {
    request_id: requestId,
    status: "failed",
    request_summary: {},
    response_summary: {},
    retried_count: 0,
  };
  const startedAt = Date.now();

  // Service-role client for logging + ingestion (never depends on user JWT)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const finishLog = async () => {
    try {
      logRow.duration_ms = Date.now() - startedAt;
      await adminClient.from("orkym_api_calls").insert(logRow as any);
    } catch (e) {
      console.error("orkym log insert failed", e);
    }
  };

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logRow.status = "failed";
      logRow.error_message = "unauthorized";
      logRow.domain = "unknown"; logRow.action = "unknown";
      await finishLog();
      return safeJson({ ok: false, error: "Unauthorized", request_id: requestId }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claims?.claims) {
      logRow.status = "failed";
      logRow.error_message = "invalid_jwt";
      logRow.domain = "unknown"; logRow.action = "unknown";
      await finishLog();
      return safeJson({ ok: false, error: "Unauthorized", request_id: requestId }, 401);
    }

    // 2. Validate body
    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const { domain, action, payload } = body ?? {};
    if (!domain || !action || !payload?.tenant_id) {
      logRow.status = "failed";
      logRow.error_message = "invalid_body";
      logRow.domain = domain ?? "unknown";
      logRow.action = action ?? "unknown";
      await finishLog();
      return safeJson({ ok: false, error: "domain, action and payload.tenant_id are required", request_id: requestId }, 400);
    }

    const correlationId = body.correlation_id ?? crypto.randomUUID();
    logRow.domain = domain;
    logRow.action = action;
    logRow.correlation_id = correlationId;
    logRow.tenant_id = payload.tenant_id;
    logRow.arena_id = payload.arena_id ?? null;
    logRow.request_summary = sanitize({ domain, action, payload });

    // 3. Secrets check → degraded mode
    const ORKYM_BASE = Deno.env.get("ORKYM_API_BASE_URL");
    const ORKYM_TOKEN = Deno.env.get("ORKYM_SERVICE_TOKEN");
    const ORKYM_HMAC = Deno.env.get("ORKYM_HMAC_SECRET");
    const ORKYM_TIMEOUT = parseInt(Deno.env.get("ORKYM_TIMEOUT_MS") ?? "8000", 10);
    if (!ORKYM_BASE || !ORKYM_TOKEN) {
      logRow.status = "degraded";
      logRow.error_message = "missing_orkym_secrets";
      await finishLog();
      return safeJson({ ok: false, degraded: true, error: "ORKYM not configured", request_id: requestId });
    }

    // 4. Rate limit
    if (!checkRateLimit(payload.tenant_id)) {
      logRow.status = "rate_limited";
      logRow.error_message = "tenant_rate_limit_exceeded";
      await finishLog();
      return safeJson({ ok: false, degraded: true, error: "rate_limited", request_id: requestId });
    }

    // 5. Dedup
    const dKey = await dedupKey(domain, action, payload);
    const { data: existingDedup } = await adminClient
      .from("orkym_dedup")
      .select("id")
      .eq("dedup_key", dKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existingDedup) {
      logRow.status = "deduped";
      await finishLog();
      return safeJson({ ok: true, deduped: true, request_id: requestId });
    }

    // 6. Build outbound request
    const orkymBody = JSON.stringify({
      request_id: requestId,
      correlation_id: correlationId,
      domain,
      action,
      tenant_id: payload.tenant_id,
      arena_id: payload.arena_id ?? null,
      payload: {
        context: payload.context ?? {},
        entity: payload.entity ?? {},
        metadata: payload.metadata ?? {},
      },
    });

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${ORKYM_TOKEN}`,
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      "X-Tenant-Id": payload.tenant_id,
    };
    if (ORKYM_HMAC) {
      headers["X-HMAC-Signature"] = await hmacHex(ORKYM_HMAC, requestId + orkymBody);
    }

    // 7. fetch + retry (only 5xx/timeout, max 2)
    const url = `${ORKYM_BASE.replace(/\/+$/, "")}/invoke`;
    const backoffs = [200, 800];
    let lastErr: string | null = null;
    let response: Response | null = null;
    let attempts = 0;
    for (let i = 0; i <= backoffs.length; i++) {
      attempts = i;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ORKYM_TIMEOUT);
      try {
        response = await fetch(url, { method: "POST", headers, body: orkymBody, signal: ctrl.signal });
        clearTimeout(timer);
        if (response.status < 500) break;
        lastErr = `http_${response.status}`;
        if (i < backoffs.length) await new Promise((r) => setTimeout(r, backoffs[i]));
      } catch (e: any) {
        clearTimeout(timer);
        lastErr = e?.name === "AbortError" ? "timeout" : (e?.message ?? "network_error");
        response = null;
        if (i < backoffs.length) await new Promise((r) => setTimeout(r, backoffs[i]));
      }
    }
    logRow.retried_count = attempts;

    if (!response) {
      logRow.status = lastErr === "timeout" ? "timeout" : "failed";
      logRow.error_message = lastErr ?? "no_response";
      await finishLog();
      return safeJson({ ok: false, degraded: true, error: lastErr ?? "network", request_id: requestId });
    }

    logRow.http_status = response.status;
    let parsed: any = null;
    try { parsed = await response.json(); } catch { /* fallthrough */ }

    if (response.status === 429) {
      logRow.status = "rate_limited";
      logRow.error_message = "upstream_429";
      logRow.response_summary = sanitize(parsed ?? {});
      await finishLog();
      return safeJson({ ok: false, degraded: true, error: "upstream_rate_limited", request_id: requestId });
    }

    if (response.status >= 400 || !parsed || parsed.ok === false) {
      logRow.status = "failed";
      logRow.error_message = parsed?.error ?? `http_${response.status}`;
      logRow.response_summary = sanitize(parsed ?? {});
      await finishLog();
      return safeJson({ ok: false, degraded: true, error: "upstream_error", request_id: requestId });
    }

    // 8. Ingest tasks if any
    let tasksCreated = 0;
    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0 && payload.arena_id) {
      const { data: ingested, error: ingErr } = await adminClient.rpc("orkym_ingest_tasks", {
        _payload: {
          tenant_id: payload.tenant_id,
          arena_id: payload.arena_id,
          correlation_id: correlationId,
          request_id: requestId,
          tasks: parsed.tasks,
        },
      });
      if (ingErr) console.error("orkym_ingest_tasks error", ingErr);
      else tasksCreated = ingested ?? 0;
    }

    // 8b. Ingest action proposals (Phase 8)
    let actionsProposed = 0;
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      const { data: ingestedActions, error: actErr } = await adminClient.rpc("orkym_ingest_actions", {
        _payload: {
          tenant_id: payload.tenant_id,
          arena_id: payload.arena_id ?? null,
          correlation_id: correlationId,
          request_id: requestId,
          actions: parsed.actions,
        },
      });
      if (actErr) console.error("orkym_ingest_actions error", actErr);
      else actionsProposed = ingestedActions ?? 0;
    }

    // 9. Dedup insert (5min TTL)
    await adminClient.from("orkym_dedup").insert({
      dedup_key: dKey,
      tenant_id: payload.tenant_id,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    logRow.status = "success";
    logRow.response_summary = sanitize({
      tasks_count: parsed.tasks?.length ?? 0,
      suggestions_count: parsed.suggestions?.length ?? 0,
      alerts_count: parsed.alerts?.length ?? 0,
      actions_count: parsed.actions?.length ?? 0,
      meta: parsed.meta,
    });
    await finishLog();

    return safeJson({
      ok: true,
      tasks_created: tasksCreated,
      actions_proposed: actionsProposed,
      suggestions: parsed.suggestions ?? [],
      alerts: parsed.alerts ?? [],
      meta: parsed.meta ?? {},
      request_id: requestId,
    });
  } catch (err: any) {
    logRow.status = "failed";
    logRow.error_message = err?.message ?? "unknown_error";
    await finishLog();
    return safeJson({ ok: false, degraded: true, error: "internal", request_id: requestId });
  }
});
