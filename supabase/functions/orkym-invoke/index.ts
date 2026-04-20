import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ORKYM Bridge — single entrypoint for all intelligence/automation requests
 * coming from MoodPlay. In Phase 1 this is a structural placeholder: the
 * boundary is defined, JWT is validated, payload is logged. No intelligence
 * lives in MoodPlay — concrete routing to ORKYM happens in later phases.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimErr } = await supabase.auth.getClaims(token);
    if (claimErr || !claims?.claims) return json({ ok: false, error: "Unauthorized" }, 401);

    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const { domain, action } = body ?? {};
    if (!domain || !action) return json({ ok: false, error: "domain and action required" }, 400);

    console.log(JSON.stringify({
      bridge: "orkym-invoke",
      user: claims.claims.sub,
      domain, action,
      ts: new Date().toISOString(),
    }));

    // Phase 1: placeholder — no intelligence implemented locally.
    return json({
      ok: false,
      error: "ORKYM bridge not yet wired. This is a structural placeholder.",
      domain, action,
    }, 501);
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
