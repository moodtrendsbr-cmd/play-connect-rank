// ORKYM WhatsApp Connection Bridge — Phase 13
// MoodPlay never owns the WhatsApp channel. This function is a thin server-side
// proxy: it validates the caller's scope authorization, calls ORKYM with the
// service token + HMAC, and mirrors the resulting instance/binding into the
// MoodPlay DB. Always returns HTTP 200 with `{ok, degraded?, ...}` so the UI
// never breaks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Action =
  | "start_connection"
  | "get_status"
  | "disconnect"
  | "reconnect"
  | "sync_instance";

type ScopeType = "tenant" | "arena" | "organizer" | "company";

interface RequestBody {
  action: Action;
  scope_type: ScopeType;
  tenant_id?: string | null;
  arena_id?: string | null;
  organizer_user_id?: string | null;
  company_id?: string | null;
}

interface OrkymInstance {
  external_instance_id: string;
  provider?: string;
  display_name?: string;
  phone_number?: string;
  status?: string; // pending | qr | paired | connected | disconnected | revoked
  qr_code?: string | null;
  pairing_code?: string | null;
  metadata?: Record<string, unknown>;
}

interface OrkymResponse {
  ok: boolean;
  instance?: OrkymInstance;
  qr_code?: string | null;
  pairing_code?: string | null;
  status?: string;
  error?: string;
}

const ACTION_PATH: Record<Action, string> = {
  start_connection: "/whatsapp/instances/connect",
  get_status: "/whatsapp/instances/status",
  disconnect: "/whatsapp/instances/disconnect",
  reconnect: "/whatsapp/instances/reconnect",
  sync_instance: "/whatsapp/instances/status",
};

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

function normalizeStatus(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  if (["connected", "paired", "active", "open"].includes(s)) return "active";
  if (["pending", "qr", "pairing", "connecting"].includes(s)) return "pending";
  if (["paused", "disconnected"].includes(s)) return "paused";
  if (["revoked", "logged_out"].includes(s)) return "revoked";
  return s || "pending";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return safeJson({ ok: false, degraded: true, error: "supabase_env_missing" });
  }

  // 1) Auth — validate caller JWT
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return safeJson({ ok: false, error: "unauthorized" }, 401);
  }
  const uid = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  // 2) Parse + validate body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return safeJson({ ok: false, error: "invalid_json" });
  }

  const VALID_ACTIONS: Action[] = ["start_connection", "get_status", "disconnect", "reconnect", "sync_instance"];
  const VALID_SCOPES: ScopeType[] = ["tenant", "arena", "organizer", "company"];
  if (!body?.action || !VALID_ACTIONS.includes(body.action)) {
    return safeJson({ ok: false, error: "invalid_action" });
  }
  if (!body?.scope_type || !VALID_SCOPES.includes(body.scope_type)) {
    return safeJson({ ok: false, error: "invalid_scope_type" });
  }

  // 3) Scope authorization (Super admin always allowed)
  const { data: isAdminData } = await admin.rpc("is_admin", { _user_id: uid });
  const isAdmin = Boolean(isAdminData);

  if (!isAdmin) {
    let allowed = false;
    if (body.scope_type === "tenant" && body.tenant_id) {
      const { data } = await admin.rpc("is_tenant_admin", { _tenant_id: body.tenant_id, _user_id: uid });
      allowed = Boolean(data);
    } else if (body.scope_type === "arena" && body.arena_id) {
      const { data } = await admin.rpc("is_arena_owner", { _arena_id: body.arena_id, _user_id: uid });
      allowed = Boolean(data);
    } else if (body.scope_type === "company" && body.company_id) {
      const { data } = await admin.rpc("is_company_owner", { _company_id: body.company_id, _user_id: uid });
      allowed = Boolean(data);
    } else if (body.scope_type === "organizer") {
      allowed = !body.organizer_user_id || body.organizer_user_id === uid;
    }
    if (!allowed) {
      return safeJson({ ok: false, error: "scope_forbidden" }, 403);
    }
  }

  // 4) Audit "received"
  await admin.from("security_audit_log").insert({
    user_id: uid,
    action: `wa_connection_${body.action}_received`,
    target_type: "whatsapp_instance",
    metadata: {
      scope_type: body.scope_type,
      tenant_id: body.tenant_id ?? null,
      arena_id: body.arena_id ?? null,
      organizer_user_id: body.organizer_user_id ?? null,
      company_id: body.company_id ?? null,
    },
  } as never).catch(() => {});

  // 5) Lookup existing binding/instance for this scope (so we can disconnect/sync without payload)
  let bindingQuery = admin
    .from("whatsapp_bindings")
    .select("id, instance_id, whatsapp_instances!inner(id, external_instance_id, provider, display_name, phone_number, status, metadata)")
    .eq("scope_type", body.scope_type)
    .order("priority", { ascending: true })
    .limit(1);

  if (body.tenant_id) bindingQuery = bindingQuery.eq("tenant_id", body.tenant_id);
  if (body.arena_id) bindingQuery = bindingQuery.eq("arena_id", body.arena_id);
  if (body.organizer_user_id) bindingQuery = bindingQuery.eq("organizer_user_id", body.organizer_user_id);
  if (body.company_id) bindingQuery = bindingQuery.eq("company_id", body.company_id);

  const { data: existingBinding } = await bindingQuery.maybeSingle();
  const existingInstance = (existingBinding as any)?.whatsapp_instances ?? null;

  // get_status with no instance yet → return idle
  if (body.action === "get_status" && !existingInstance) {
    return safeJson({ ok: true, status: "not_connected", instance: null });
  }

  // 6) Call ORKYM (degraded mode if secrets missing)
  const orkymBase = Deno.env.get("ORKYM_API_BASE_URL");
  const orkymToken = Deno.env.get("ORKYM_SERVICE_TOKEN");
  const orkymHmac = Deno.env.get("ORKYM_HMAC_SECRET");
  const timeoutMs = Number(Deno.env.get("ORKYM_TIMEOUT_MS") || "8000");

  if (!orkymBase || !orkymToken) {
    return safeJson({
      ok: false,
      degraded: true,
      error: "orkym_not_configured",
      message: "Conexão com ORKYM indisponível no momento. Tente novamente.",
      instance: existingInstance,
      status: existingInstance ? normalizeStatus(existingInstance.status) : "not_connected",
    });
  }

  const requestId = crypto.randomUUID();
  const orkymPayload = {
    request_id: requestId,
    scope_type: body.scope_type,
    tenant_id: body.tenant_id ?? null,
    arena_id: body.arena_id ?? null,
    organizer_user_id: body.organizer_user_id ?? null,
    company_id: body.company_id ?? null,
    external_instance_id: existingInstance?.external_instance_id ?? null,
    initiated_by: uid,
  };
  const rawBody = JSON.stringify(orkymPayload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${orkymToken}`,
    "X-Request-Id": requestId,
  };
  if (orkymHmac) {
    headers["X-HMAC-Signature"] = await hmacHex(orkymHmac, requestId + rawBody);
  }

  const url = `${orkymBase.replace(/\/+$/, "")}${ACTION_PATH[body.action]}`;

  // Retry 5xx up to 2x
  let orkymResp: OrkymResponse | null = null;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      const resp = await fetch(url, { method: "POST", headers, body: rawBody, signal: ac.signal });
      clearTimeout(t);
      const text = await resp.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
      if (resp.status >= 500) {
        lastErr = `orkym_${resp.status}`;
        if (attempt < 2) { await new Promise((r) => setTimeout(r, attempt === 0 ? 200 : 800)); continue; }
        break;
      }
      if (!resp.ok) {
        lastErr = parsed?.error || `orkym_${resp.status}`;
        break;
      }
      orkymResp = parsed as OrkymResponse;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "orkym_fetch_failed";
      if (attempt < 2) { await new Promise((r) => setTimeout(r, attempt === 0 ? 200 : 800)); continue; }
    }
  }

  if (!orkymResp) {
    await admin.from("security_audit_log").insert({
      user_id: uid,
      action: `wa_connection_${body.action}_failed`,
      target_type: "whatsapp_instance",
      metadata: { error: lastErr, scope_type: body.scope_type },
    } as never).catch(() => {});
    return safeJson({
      ok: false,
      degraded: true,
      error: lastErr || "orkym_unreachable",
      message: "ORKYM não respondeu. Tente novamente em instantes.",
      instance: existingInstance,
      status: existingInstance ? normalizeStatus(existingInstance.status) : "not_connected",
    });
  }

  // 7) Sync DB
  const inst = orkymResp.instance;
  const normalizedStatus = normalizeStatus(orkymResp.status ?? inst?.status ?? null);

  let syncedInstance: any = existingInstance;

  if (inst?.external_instance_id) {
    const upsertPayload = {
      provider: inst.provider || "evolution",
      display_name: inst.display_name || existingInstance?.display_name || `${body.scope_type} instance`,
      phone_number: (inst.phone_number || existingInstance?.phone_number || `pending_${inst.external_instance_id}`).toString(),
      external_instance_id: inst.external_instance_id,
      status: body.action === "disconnect" ? "paused" : normalizedStatus,
      metadata: {
        ...(existingInstance?.metadata || {}),
        ...(inst.metadata || {}),
        last_synced_at: new Date().toISOString(),
        last_action: body.action,
      },
    };

    const { data: up, error: upErr } = await admin
      .from("whatsapp_instances")
      .upsert(upsertPayload, { onConflict: "external_instance_id" })
      .select("*")
      .maybeSingle();

    if (!upErr && up) {
      syncedInstance = up;
      // ensure binding
      const bindingPayload: Record<string, unknown> = {
        instance_id: up.id,
        scope_type: body.scope_type,
        tenant_id: body.tenant_id ?? null,
        arena_id: body.arena_id ?? null,
        organizer_user_id: body.organizer_user_id ?? null,
        company_id: body.company_id ?? null,
        is_default: true,
        priority: 10,
        metadata: { synced_via: "orkym-whatsapp-connection" },
      };
      if (existingBinding?.id) {
        await admin.from("whatsapp_bindings").update(bindingPayload).eq("id", existingBinding.id);
      } else {
        await admin.from("whatsapp_bindings").insert(bindingPayload as never);
      }
    }
  } else if (body.action === "disconnect" && existingInstance?.id) {
    await admin.from("whatsapp_instances").update({ status: "paused" }).eq("id", existingInstance.id);
    syncedInstance = { ...existingInstance, status: "paused" };
  } else if (existingInstance?.id) {
    // status-only sync
    await admin
      .from("whatsapp_instances")
      .update({
        status: body.action === "disconnect" ? "paused" : normalizedStatus,
        metadata: { ...(existingInstance.metadata || {}), last_synced_at: new Date().toISOString() },
      })
      .eq("id", existingInstance.id);
    syncedInstance = { ...existingInstance, status: body.action === "disconnect" ? "paused" : normalizedStatus };
  }

  // 8) Audit success
  await admin.from("security_audit_log").insert({
    user_id: uid,
    action: `wa_connection_${body.action}_executed`,
    target_type: "whatsapp_instance",
    target_id: syncedInstance?.id ?? null,
    metadata: { scope_type: body.scope_type, status: normalizedStatus },
  } as never).catch(() => {});

  return safeJson({
    ok: true,
    status: normalizedStatus,
    qr_code: orkymResp.qr_code ?? inst?.qr_code ?? null,
    pairing_code: orkymResp.pairing_code ?? inst?.pairing_code ?? null,
    instance: syncedInstance,
  });
});
