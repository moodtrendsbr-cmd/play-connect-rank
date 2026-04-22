// wa-bridge: WhatsApp → ORKYM bridge (Phase 12)
// verify_jwt = false (public webhook validated via HMAC OR mock mode)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wa-signature",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_SECRET = Deno.env.get("WA_WEBHOOK_SECRET") || "";

const PROFILE_TO_DOMAIN: Record<string, string> = {
  arena: "arena_operations",
  organizer: "tournaments",
  athlete: "arena_operations",
  company: "growth",
  tenant: "finance",
  admin: "arena_operations",
};

const SHORTCODE_RE = /#([A-Z0-9]{6})\b/i;
const QR_RE = /#QR-([a-f0-9]{8})\b/i;

function sanitize(t: string): string {
  return (t || "").replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").slice(0, 1000).trim();
}

async function verifyHmac(req: Request, raw: string): Promise<boolean> {
  if (!WA_SECRET) return true; // dev: no secret = skip
  const sig = req.headers.get("x-wa-signature") || "";
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WA_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === sig.toLowerCase().replace(/^sha256=/, "");
}

interface Payload {
  phone: string;
  text: string;
  qr_token?: string;
}

function parseGeneric(body: any): Payload | null {
  // Accepts {phone,text,qr_token?} OR Twilio-style {From,Body} OR Meta-style
  if (body?.phone && body?.text) {
    return { phone: body.phone, text: body.text, qr_token: body.qr_token };
  }
  if (body?.From && body?.Body) {
    return {
      phone: String(body.From).replace(/^whatsapp:/i, ""),
      text: String(body.Body),
    };
  }
  // Meta WhatsApp Business API
  const m = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (m?.from && m?.text?.body) {
    return { phone: m.from, text: m.text.body };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const isMock = url.searchParams.get("mode") === "mock";
  const raw = await req.text();

  if (!isMock) {
    const ok = await verifyHmac(req, raw);
    if (!ok) {
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = parseGeneric(body);
  if (!parsed) {
    return new Response(JSON.stringify({ error: "unrecognized_payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phone = parsed.phone.replace(/\D/g, "");
  const text = sanitize(parsed.text);
  if (!phone || !text) {
    return new Response(JSON.stringify({ error: "missing_phone_or_text" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supa = createClient(SUPA_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Identity lookup
  const { data: ident } = await supa
    .from("wa_identities")
    .select("id,user_id,tenant_id,default_arena_id,default_profile_type,verified_at")
    .eq("wa_phone", phone)
    .not("verified_at", "is", null)
    .maybeSingle();

  if (!ident) {
    // Log unidentified message (no user_id) and respond with onboarding
    await supa.from("conversational_commands").insert({
      channel: "whatsapp",
      profile_type: "athlete",
      input_text: text,
      status: "identity_required",
      response_text:
        "Olá! Conecte seu WhatsApp em moodplay.app/profile para usar comandos.",
    });
    return new Response(
      JSON.stringify({
        ok: true,
        response:
          "Olá! Conecte seu WhatsApp em moodplay.app/profile para usar comandos.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Resolve QR token (if # in text or explicit qr_token)
  let qrIntent: string | null = null;
  let qrPayload: any = {};
  let qrTokenUuid: string | null = parsed.qr_token ?? null;
  let qrArenaId: string | null = null;

  const qrMatch = text.match(QR_RE);
  if (qrMatch && !qrTokenUuid) {
    // Short QR ref: lookup full token
    const { data: qrRow } = await supa
      .from("wa_qr_tokens")
      .select("token")
      .ilike("token::text", `${qrMatch[1]}%`)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (qrRow) qrTokenUuid = qrRow.token;
  }

  if (qrTokenUuid) {
    const { data: consumed } = await supa.rpc("wa_consume_qr_token", {
      _token: qrTokenUuid,
      _consumer_user_id: ident.user_id,
    });
    if (consumed?.success) {
      qrIntent = consumed.intent;
      qrPayload = consumed.payload || {};
      qrArenaId = consumed.arena_id || null;
    }
  }

  // 3. Resolve dashboard CTA shortcode (link to pre-created command row)
  let existingCommandId: string | null = null;
  const scMatch = text.match(SHORTCODE_RE);
  if (scMatch) {
    const { data: scId } = await supa.rpc("wa_resolve_shortcode", {
      _shortcode: scMatch[1].toUpperCase(),
    });
    if (scId) existingCommandId = scId as string;
  }

  // 4. Create or load command row
  let commandId = existingCommandId;
  if (!commandId) {
    const { data: cmd, error } = await supa
      .from("conversational_commands")
      .insert({
        channel: qrTokenUuid ? "qr" : "whatsapp",
        tenant_id: ident.tenant_id,
        arena_id: qrArenaId || ident.default_arena_id,
        user_id: ident.user_id,
        profile_type: ident.default_profile_type,
        input_text: text,
        status: "pending",
        qr_token: qrTokenUuid,
        parsed_intent: qrIntent ? { qr_intent: qrIntent, qr_payload: qrPayload } : null,
      })
      .select("id")
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: "db_insert_failed", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    commandId = cmd.id;
  } else {
    await supa
      .from("conversational_commands")
      .update({ status: "pending", input_text: text })
      .eq("id", commandId);
  }

  // 5. Special-case: QR check-in goes straight to RPC (no ORKYM needed)
  if (qrIntent === "checkin" && qrPayload?.checkin_token) {
    // Call arena_checkin_validate with user's auth context
    // Create a user-scoped client by minting via service key + impersonation header
    const userClient = createClient(SUPA_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-user-id": ident.user_id } },
    });
    const { data: result } = await userClient.rpc("arena_checkin_validate", {
      _token: qrPayload.checkin_token,
    });
    const ok = result?.success === true;
    const responseText = ok
      ? `✅ Check-in confirmado em "${result.class_title}"`
      : `❌ Não foi possível: ${result?.error || "erro desconhecido"}`;
    await supa
      .from("conversational_commands")
      .update({
        status: ok ? "executed" : "failed",
        result_payload: result,
        response_text: responseText,
        completed_at: new Date().toISOString(),
      })
      .eq("id", commandId);
    return new Response(
      JSON.stringify({ ok: true, command_id: commandId, response: responseText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 6. Forward to ORKYM (interpret_natural_command)
  const domain = PROFILE_TO_DOMAIN[ident.default_profile_type] || "arena_operations";

  try {
    const invokeRes = await fetch(`${SUPA_URL}/functions/v1/orkym-invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        domain,
        action: "interpret_natural_command",
        tenant_id: ident.tenant_id,
        arena_id: qrArenaId || ident.default_arena_id,
        payload: {
          context: {
            user_input: text,
            command_id: commandId,
            profile_type: ident.default_profile_type,
            qr_intent: qrIntent,
            qr_payload: qrPayload,
            channel: qrTokenUuid ? "qr" : "whatsapp",
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const orkymResp = await invokeRes.json().catch(() => ({}));

    const proposalIds: string[] = Array.isArray(orkymResp?.proposal_ids)
      ? orkymResp.proposal_ids
      : Array.isArray(orkymResp?.actions)
      ? orkymResp.actions.map((a: any) => a.id).filter(Boolean)
      : [];
    const autoExecuted = orkymResp?.auto_executed_count ?? 0;
    const proposed = orkymResp?.proposed_count ?? proposalIds.length;
    const suggestionBody =
      orkymResp?.suggestions?.[0]?.body || orkymResp?.message || null;

    let responseText: string;
    let status: string;

    if (autoExecuted > 0) {
      responseText = `✅ Feito (${autoExecuted} ${autoExecuted === 1 ? "ação executada" : "ações executadas"})`;
      status = "executed";
    } else if (proposed > 0) {
      responseText = `📋 ${proposed} sugestão criada. Aprove em moodplay.app/${ident.default_profile_type}/commands`;
      status = "dispatched";
    } else if (suggestionBody) {
      responseText = String(suggestionBody).slice(0, 1000);
      status = "executed";
    } else if (orkymResp?.error) {
      responseText = `🤖 ORKYM: ${orkymResp.error}`;
      status = orkymResp.error === "rate_limited" ? "rate_limited" : "failed";
    } else {
      responseText = `🤖 Não consegui interpretar. Tente algo como "criar torneio sábado" ou "ver meus jogos".`;
      status = "no_action";
    }

    await supa
      .from("conversational_commands")
      .update({
        status,
        orkym_request_id: orkymResp?.request_id || null,
        orkym_correlation_id: orkymResp?.correlation_id || null,
        proposal_ids: proposalIds,
        result_payload: orkymResp,
        response_text: responseText,
        completed_at: new Date().toISOString(),
      })
      .eq("id", commandId);

    return new Response(
      JSON.stringify({ ok: true, command_id: commandId, response: responseText, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    await supa
      .from("conversational_commands")
      .update({
        status: "failed",
        error_message: String(err?.message || err).slice(0, 500),
        response_text: "🤖 Erro ao processar comando. Tente novamente.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", commandId);
    return new Response(
      JSON.stringify({ ok: false, command_id: commandId, error: "orkym_invoke_failed" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
