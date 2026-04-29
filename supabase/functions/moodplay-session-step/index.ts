import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canonicalJson,
  evaluateFlow,
  getFlow,
  listSupportedIntents,
  sha256Hex,
} from "../_shared/conversation-flows.ts";
import { getMemoryContext, type MemoryContext } from "../_shared/memory.ts";

/**
 * MoodPlay Session Step — Phase 12.7 (Hardened)
 *
 * Stateful conversational bridge. ORKYM owns intent + values; MoodPlay
 * owns lock, validation, snapshot, idempotent execution and event
 * emission. Zero NLP, zero IA.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moodplay-signature, x-request-timestamp, x-idempotency-key",
};

const VERSION = "12.7";
const DEFAULT_SESSION_TTL_MIN = 15;
const RESUME_WINDOW_MIN = 30;
const LOCK_TTL_SECONDS = 30;

// Phase 12.8 — request-scoped memory context (best-effort)
let currentMemory: MemoryContext | null = null;

function safeJson(body: unknown, status = 200) {
  let payload = body;
  if (currentMemory && body && typeof body === "object" && (body as Record<string, unknown>).ok === true) {
    payload = { ...(body as Record<string, unknown>), memory_context: currentMemory };
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHmac(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) {
    r |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return r === 0;
}

async function emitEvent(
  admin: ReturnType<typeof createClient>,
  event: string,
  ctx: {
    user_id?: string | null;
    tenant_id?: string | null;
    session_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await admin.from("security_audit_log").insert({
      user_id: ctx.user_id ?? null,
      tenant_id: ctx.tenant_id ?? null,
      action: `session.${event}`,
      resource_type: "conversation_session",
      resource_id: ctx.session_id ?? null,
      metadata: ctx.metadata ?? {},
    });
  } catch { /* best effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (req.method === "GET" || url.searchParams.get("ping") === "1") {
    return safeJson({
      ok: true,
      service: "moodplay-session-step",
      version: VERSION,
      supported_intents: listSupportedIntents(),
      lock_ttl_seconds: LOCK_TTL_SECONDS,
      default_session_ttl_minutes: DEFAULT_SESSION_TTL_MIN,
      resume_window_minutes: RESUME_WINDOW_MIN,
    });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-moodplay-signature");
  const ts = req.headers.get("x-request-timestamp");
  const reqIdHeader = req.headers.get("x-idempotency-key");

  const secret =
    Deno.env.get("ORKYM_HMAC_SECRET") ||
    Deno.env.get("ORKYM_SERVICE_TOKEN") ||
    "";
  if (!secret) {
    return safeJson({ ok: false, error: "server_secret_not_configured" }, 503);
  }

  if (!ts) return safeJson({ ok: false, error: "timestamp_required" }, 401);
  const skew = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(skew) || skew > 5 * 60 * 1000) {
    return safeJson({ ok: false, error: "timestamp_skew" }, 401);
  }

  const ok = await verifyHmac(rawBody, sig, secret);
  if (!ok) return safeJson({ ok: false, error: "invalid_signature" }, 401);

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return safeJson({ ok: false, error: "invalid_json" }, 400);
  }

  const {
    tenant_id,
    arena_id = null,
    user_id,
    profile_type,
    whatsapp_instance_id,
    intent = null,
    values = {},
    confirm = false,
    abort = false,
    resume = false,
    expected_snapshot_hash = null,
    correlation_id = null,
  } = body ?? {};

  if (!tenant_id || !user_id || !profile_type || !whatsapp_instance_id) {
    return safeJson({
      ok: false,
      error: "missing_required_fields",
      details: ["tenant_id", "user_id", "profile_type", "whatsapp_instance_id"],
    }, 400);
  }

  // Validate intent (if supplied) before doing anything stateful
  if (intent !== null && !getFlow(intent)) {
    return safeJson({ ok: false, error: "unknown_intent", intent }, 400);
  }

  const requestId = reqIdHeader ?? crypto.randomUUID();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cross-tenant guard
  if (arena_id) {
    const { data: arena } = await admin
      .from("arenas").select("tenant_id").eq("id", arena_id).maybeSingle();
    if (!arena || arena.tenant_id !== tenant_id) {
      return safeJson({ ok: false, error: "cross_tenant_violation" }, 403);
    }
  }

  // 1. Resolve or create session
  const { data: resolveRes, error: resolveErr } = await admin.rpc(
    "resolve_or_create_session",
    {
      _tenant_id: tenant_id,
      _arena_id: arena_id,
      _user_id: user_id,
      _profile_type: profile_type,
      _whatsapp_instance_id: whatsapp_instance_id,
      _intent: intent,
      _ttl_minutes: DEFAULT_SESSION_TTL_MIN,
      _resume_window_minutes: RESUME_WINDOW_MIN,
      _correlation_id: correlation_id,
      _allow_resume: resume === true,
    },
  );
  if (resolveErr) {
    return safeJson({ ok: false, error: `resolve_failed:${resolveErr.message}` }, 500);
  }
  const session = (resolveRes as any)?.session;
  if (!session) {
    return safeJson({
      ok: false,
      error: (resolveRes as any)?.error ?? "no_session",
    }, 400);
  }
  const isNew = (resolveRes as any)?.is_new === true;
  const isResumable = (resolveRes as any)?.is_resumable === true;

  if (isNew) {
    await emitEvent(admin, "created", {
      user_id, tenant_id, session_id: session.id,
      metadata: { intent: session.current_intent, correlation_id, request_id: requestId },
    });
  }
  if (isResumable) {
    await emitEvent(admin, "resumed", {
      user_id, tenant_id, session_id: session.id,
      metadata: { intent: session.current_intent, request_id: requestId },
    });
  }

  // 2. Acquire lock
  const { data: locked, error: lockErr } = await admin.rpc(
    "acquire_session_lock",
    { _session_id: session.id, _request_id: requestId, _ttl_seconds: LOCK_TTL_SECONDS },
  );
  if (lockErr) {
    return safeJson({ ok: false, error: `lock_failed:${lockErr.message}` }, 500);
  }
  if (locked !== true) {
    await emitEvent(admin, "lock_denied", {
      user_id, tenant_id, session_id: session.id,
      metadata: { request_id: requestId },
    });
    return safeJson({
      ok: false,
      error: "session_locked",
      session_id: session.id,
      retry_after_ms: 500,
    }, 409);
  }

  try {
    // 3. Abort path
    if (abort === true) {
      await admin.rpc("abandon_session", {
        _session_id: session.id,
        _reason: "user_aborted",
        _resume_window_minutes: RESUME_WINDOW_MIN,
      });
      await emitEvent(admin, "abandoned", {
        user_id, tenant_id, session_id: session.id,
        metadata: { reason: "user_aborted", request_id: requestId },
      });
      return safeJson({
        ok: true,
        session_id: session.id,
        state: "abandoned",
        current_intent: session.current_intent,
      });
    }

    const flow = getFlow(session.current_intent);
    if (!flow) {
      // should not happen because we validated above, defensive
      return safeJson({ ok: false, error: "unknown_intent_in_session" }, 500);
    }

    // 4. Merge new values (if any) — never let confirm reach here without
    //    going through validation again.
    const incomingValues = (values && typeof values === "object" && !Array.isArray(values))
      ? values as Record<string, unknown>
      : {};

    if (Object.keys(incomingValues).length > 0) {
      await admin.rpc("update_session_context", {
        _session_id: session.id,
        _values: incomingValues,
        _ttl_minutes: flow.ttl_minutes ?? DEFAULT_SESSION_TTL_MIN,
      });
      await emitEvent(admin, "context_updated", {
        user_id, tenant_id, session_id: session.id,
        metadata: { keys: Object.keys(incomingValues), request_id: requestId },
      });
    }

    // Re-read session
    const { data: fresh, error: freshErr } = await admin
      .from("conversation_sessions")
      .select("*")
      .eq("id", session.id)
      .single();
    if (freshErr || !fresh) {
      return safeJson({ ok: false, error: "session_lost" }, 500);
    }

    const ctx = (fresh.context_data ?? {}) as Record<string, unknown>;
    const evaluation = evaluateFlow(flow, ctx);

    // 5. Validation errors → return collecting
    if (evaluation.validation_errors.length > 0) {
      return safeJson({
        ok: true,
        session_id: fresh.id,
        state: "collecting",
        current_intent: fresh.current_intent,
        context_data: ctx,
        validation_errors: evaluation.validation_errors,
        missing_fields: evaluation.missing_fields,
        next_prompt: evaluation.missing_fields[0]?.prompt ?? null,
      });
    }

    // 6. Confirmation prep — when ready and not yet confirming, freeze snapshot
    let currentState = fresh.state as string;
    let snapshotHash: string | null = fresh.snapshot_hash ?? null;
    let snapshot: Record<string, unknown> | null =
      (fresh.context_snapshot as Record<string, unknown> | null) ?? null;

    if (evaluation.ready && currentState !== "confirming" && !confirm) {
      snapshot = { ...ctx, _intent: flow.intent };
      snapshotHash = "sha256:" + (await sha256Hex(canonicalJson(snapshot)));
      await admin.rpc("prepare_session_confirmation", {
        _session_id: fresh.id,
        _snapshot: snapshot,
        _hash: snapshotHash,
      });
      currentState = "confirming";
      await emitEvent(admin, "confirmation_prepared", {
        user_id, tenant_id, session_id: fresh.id,
        metadata: { snapshot_hash: snapshotHash, request_id: requestId },
      });
    }

    // 7. Still missing fields → collecting
    if (!evaluation.ready) {
      return safeJson({
        ok: true,
        session_id: fresh.id,
        state: "collecting",
        current_intent: fresh.current_intent,
        context_data: ctx,
        missing_fields: evaluation.missing_fields,
        next_prompt: evaluation.missing_fields[0]?.prompt ?? null,
      });
    }

    // 8. Confirmation requested → execute
    if (confirm === true) {
      if (currentState !== "confirming") {
        return safeJson({
          ok: false,
          error: "not_in_confirming_state",
          state: currentState,
        }, 409);
      }

      // Recompute hash to detect tampering between prepare and execute
      const recomputed = "sha256:" + (await sha256Hex(canonicalJson(snapshot ?? {})));
      if (snapshotHash && recomputed !== snapshotHash) {
        return safeJson({
          ok: false,
          error: "snapshot_corrupted",
          stored_hash: snapshotHash,
          recomputed_hash: recomputed,
        }, 409);
      }
      if (expected_snapshot_hash && expected_snapshot_hash !== snapshotHash) {
        return safeJson({
          ok: false,
          error: "snapshot_mismatch",
          expected: expected_snapshot_hash,
          actual: snapshotHash,
        }, 409);
      }

      const idemKey = "sess:" + (await sha256Hex(fresh.id + "|" + (snapshotHash ?? "")));

      const { data: markRes, error: markErr } = await admin.rpc(
        "mark_session_executing",
        { _session_id: fresh.id, _idempotency_key: idemKey },
      );
      if (markErr) {
        return safeJson({ ok: false, error: `mark_failed:${markErr.message}` }, 500);
      }
      const mark = markRes as any;
      if (mark?.acquired === false && mark?.replay === true) {
        await emitEvent(admin, "replay_blocked", {
          user_id, tenant_id, session_id: fresh.id,
          metadata: { request_id: requestId, idempotency_key: idemKey },
        });
        return safeJson({
          ok: true,
          session_id: fresh.id,
          state: mark.state,
          current_intent: fresh.current_intent,
          execution_result: mark.existing_result,
          replay: true,
        });
      }
      if (mark?.acquired !== true) {
        return safeJson({
          ok: false,
          error: mark?.error ?? "mark_executing_failed",
        }, 409);
      }

      await emitEvent(admin, "execution_started", {
        user_id, tenant_id, session_id: fresh.id,
        metadata: { action_type: flow.action_type, request_id: requestId },
      });

      // Server-to-server call to moodplay-execute-action with same HMAC
      const execBody = JSON.stringify({
        tenant_id,
        arena_id,
        user_id,
        profile_type,
        action_type: flow.action_type,
        payload: snapshot ?? ctx,
        source: "orkym_session",
        correlation_id: correlation_id ?? fresh.id,
      });

      const execTs = Date.now().toString();
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, enc.encode(execBody));
      const execSig = Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const execUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/moodplay-execute-action`;
      let execResult: any = null;
      let execOk = false;
      try {
        const r = await fetch(execUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-moodplay-signature": execSig,
            "x-request-timestamp": execTs,
            "x-idempotency-key": idemKey,
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: execBody,
        });
        execResult = await r.json().catch(() => ({ ok: false, error: "non_json_response" }));
        execOk = r.ok && execResult?.ok !== false;
      } catch (e) {
        execResult = { ok: false, error: "execute_action_unreachable", details: String(e) };
        execOk = false;
      }

      // Detect graceful "unknown action" (handler not implemented yet)
      if (!execOk && execResult?.error?.toString().includes("unknown_action_type")) {
        execResult = { ok: false, error: "unknown_action_type", action_type: flow.action_type };
      }

      await admin.rpc("complete_session", {
        _session_id: fresh.id,
        _result: execResult,
        _success: execOk,
      });
      await emitEvent(admin, execOk ? "execution_completed" : "execution_failed", {
        user_id, tenant_id, session_id: fresh.id,
        metadata: { action_type: flow.action_type, request_id: requestId },
      });

      return safeJson({
        ok: true,
        session_id: fresh.id,
        state: execOk ? "completed" : "failed",
        current_intent: fresh.current_intent,
        execution_result: execResult,
      });
    }

    // 9. Ready but no confirm yet → return confirming + summary
    return safeJson({
      ok: true,
      session_id: fresh.id,
      state: "confirming",
      current_intent: fresh.current_intent,
      context_data: ctx,
      confirmation_summary: flow.summarize(ctx),
      snapshot_hash: snapshotHash,
    });
  } finally {
    await admin.rpc("release_session_lock", {
      _session_id: session.id,
      _request_id: requestId,
    });
  }
});
