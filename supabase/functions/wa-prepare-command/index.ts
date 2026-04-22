// wa-prepare-command: creates a placeholder conversational_commands row
// for dashboard CTAs ("Continuar no WhatsApp"), returning a 6-char shortcode
// that wa-bridge resolves when the user actually sends the message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function shortcode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = auth.replace("Bearer ", "");
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const inputText = String(body?.input_text || "").slice(0, 1000);
  const profileType = String(body?.profile_type || "athlete");
  const tenantId = body?.tenant_id || null;
  const arenaId = body?.arena_id || null;
  const parsedIntent = body?.parsed_intent || null;

  if (!inputText) {
    return new Response(JSON.stringify({ error: "input_text_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPA_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Retry shortcode up to 5x in case of collision
  let code = "";
  let inserted: any = null;
  for (let i = 0; i < 5; i++) {
    code = shortcode();
    const { data, error } = await admin
      .from("conversational_commands")
      .insert({
        channel: "dashboard_cta",
        user_id: userId,
        tenant_id: tenantId,
        arena_id: arenaId,
        profile_type: profileType,
        input_text: inputText,
        status: "pending",
        shortcode: code,
        parsed_intent: parsedIntent,
      })
      .select("id, shortcode")
      .single();
    if (!error) { inserted = data; break; }
  }

  if (!inserted) {
    return new Response(JSON.stringify({ error: "shortcode_exhausted" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ command_id: inserted.id, shortcode: inserted.shortcode }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
