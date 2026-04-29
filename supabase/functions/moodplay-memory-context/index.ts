// Phase 12.8 — moodplay-memory-context
// Bridge endpoint for ORKYM to fetch deterministic memory context.
// Same HMAC + timestamp scheme as moodplay-execute-action. Zero AI/LLM.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moodplay-signature, x-request-timestamp",
};

function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHmac(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  if (req.method === "GET" || url.searchParams.get("ping") === "1") {
    return safeJson({
      ok: true,
      service: "moodplay-memory-context",
      version: "12.8",
      contexts: ["booking", "billing", "tournament", "marketplace", "growth", "general"],
      profile_types: ["athlete", "arena", "organizer", "company", "tenant"],
    });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-moodplay-signature");
  const ts = req.headers.get("x-request-timestamp");

  const secret = Deno.env.get("ORKYM_HMAC_SECRET") || Deno.env.get("ORKYM_SERVICE_TOKEN") || "";
  if (!secret) return safeJson({ ok: false, error: "server_secret_not_configured" }, 503);

  if (!ts) return safeJson({ ok: false, error: "timestamp_required" }, 401);
  const skew = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(skew) || skew > 5 * 60 * 1000) {
    return safeJson({ ok: false, error: "timestamp_skew" }, 401);
  }

  const ok = await verifyHmac(rawBody, sig, secret);
  if (!ok) return safeJson({ ok: false, error: "invalid_signature" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return safeJson({ ok: false, error: "invalid_json" }, 400);
  }

  const { tenant_id, arena_id, user_id, company_id, organizer_user_id, profile_type, context, max_items } = body ?? {};
  if (!tenant_id || !profile_type) {
    return safeJson({ ok: false, error: "missing_required_fields", details: ["tenant_id", "profile_type"] }, 400);
  }
  const allowedProfiles = ["athlete", "arena", "organizer", "company", "tenant"];
  if (!allowedProfiles.includes(profile_type)) {
    return safeJson({ ok: false, error: "invalid_profile_type" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cross-tenant guard for arena scope
  if (arena_id) {
    const { data: arena } = await admin.from("arenas").select("tenant_id").eq("id", arena_id).maybeSingle();
    if (!arena || arena.tenant_id !== tenant_id) {
      return safeJson({ ok: false, error: "cross_tenant_violation" }, 403);
    }
  }

  const memory_context = await getMemoryContext(admin, {
    tenant_id, arena_id: arena_id ?? null, user_id: user_id ?? null,
    company_id: company_id ?? null, organizer_user_id: organizer_user_id ?? null,
    profile_type, context: context ?? "general",
    max_items: max_items ?? 20,
  });

  if (!memory_context) {
    return safeJson({ ok: true, memory_context: null, degraded: true });
  }

  return safeJson({ ok: true, memory_context });
});
