// Public arena check-in endpoint (no auth required).
// Used by /c/:shortcode (booking) and /c/qr/:token (arena QR) flows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// In-memory rate limit (best effort; resets when the function cold-starts)
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) return true;
  arr.push(now);
  recent.set(key, arr);
  return false;
}

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = body?.action as string;
  const supa = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (action === "resolve_qr") {
    const token = String(body?.token || "");
    if (!token) return json({ error: "missing_token" }, 400);
    const { data: qr } = await supa
      .from("wa_qr_tokens")
      .select("token, intent, kind, payload, arena_id, expires_at, is_active")
      .eq("token", token)
      .maybeSingle();
    if (!qr || qr.is_active === false || (qr.expires_at && new Date(qr.expires_at) < new Date())) {
      return json({ success: false, error: "invalid_or_expired" });
    }
    const { data: arena } = await supa
      .from("arenas")
      .select("id, name, slug, logo_url, modalities, checkin_enabled")
      .eq("id", qr.arena_id)
      .maybeSingle();
    if (!arena) return json({ success: false, error: "arena_not_found" });
    if (!arena.checkin_enabled) return json({ success: false, error: "checkin_disabled" });
    return json({ success: true, data: { ...arena, kind: qr.kind || qr.intent, qr_token: qr.token } });
  }

  if (action === "resolve_booking") {
    const code = String(body?.shortcode || "").toUpperCase();
    if (!code) return json({ error: "missing_shortcode" }, 400);
    const { data, error } = await supa.rpc("booking_checkin_resolve", { _shortcode: code });
    if (error) return json({ success: false, error: error.message });
    return json(data);
  }

  if (action === "complete") {
    const phone = normalizePhone(String(body?.phone || ""));
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!phone || phone.length < 8) return json({ success: false, error: "invalid_phone" }, 400);
    if (rateLimited(`p:${phone}`) || rateLimited(`ip:${ip}`)) {
      return json({ success: false, error: "rate_limited" }, 429);
    }
    const { data, error } = await supa.rpc("arena_checkin_complete", {
      _arena_id: body.arena_id,
      _phone: phone,
      _name: body.name || null,
      _sport: body.sport || null,
      _court_id: body.court_id || null,
      _booking_id: body.booking_id || null,
      _qr_token: body.qr_token || null,
      _user_id: null,
      _source: body.source || "qr",
      _visibility: body.visibility || "arena",
    });
    if (error) return json({ success: false, error: error.message }, 500);
    return json(data);
  }

  return json({ error: "unknown_action" }, 400);

  function json(payload: any, status = 200) {
    return new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
