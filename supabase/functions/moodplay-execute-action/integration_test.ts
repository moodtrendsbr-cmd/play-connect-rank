// Phase 12.6 — Integration tests for moodplay-execute-action
// Run with: deno test --allow-net --allow-env --allow-read
//
// These tests boot the edge function against a running Supabase project,
// using credentials from the root .env file. They cover the 7 contract
// scenarios documented in mem/integration/orkym-contract.md.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const HMAC_SECRET =
  Deno.env.get("ORKYM_HMAC_SECRET") ??
  Deno.env.get("ORKYM_SERVICE_TOKEN") ??
  "";

const FN_URL = `${SUPABASE_URL}/functions/v1/moodplay-execute-action`;

async function hmacHex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function skipIfNoEnv(): boolean {
  if (!SUPABASE_URL || !HMAC_SECRET) {
    console.warn("⚠️  Skipping: VITE_SUPABASE_URL or ORKYM_HMAC_SECRET missing");
    return true;
  }
  return false;
}

// ---------- 1) ping (no HMAC required) ----------
Deno.test("ping returns 200 with supported_actions catalog", async () => {
  if (!SUPABASE_URL) return;
  const res = await fetch(`${FN_URL}?ping=1`);
  const json = await res.json();
  assertEquals(res.status, 200);
  assertEquals(json.ok, true);
  assertEquals(json.service, "moodplay-execute-action");
  if (!Array.isArray(json.supported_actions)) {
    throw new Error("supported_actions must be an array");
  }
});

// ---------- 2) missing timestamp → 401 ----------
Deno.test("missing X-Request-Timestamp → 401 timestamp_required", async () => {
  if (skipIfNoEnv()) return;
  const body = JSON.stringify({ action_type: "get_arena_summary" });
  const sig = await hmacHex(body, HMAC_SECRET);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": sig,
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "timestamp_required");
});

// ---------- 3) timestamp skew > 5min → 401 ----------
Deno.test("timestamp skew > 5min → 401 timestamp_skew", async () => {
  if (skipIfNoEnv()) return;
  const body = JSON.stringify({ action_type: "get_arena_summary" });
  const sig = await hmacHex(body, HMAC_SECRET);
  const oldTs = String(Date.now() - 6 * 60 * 1000);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": sig,
      "X-Request-Timestamp": oldTs,
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "timestamp_skew");
});

// ---------- 4) invalid HMAC → 401 ----------
Deno.test("invalid HMAC signature → 401 invalid_signature", async () => {
  if (skipIfNoEnv()) return;
  const body = JSON.stringify({ action_type: "get_arena_summary" });
  const badSig = "0".repeat(64);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": badSig,
      "X-Request-Timestamp": String(Date.now()),
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "invalid_signature");
});

// ---------- 5) malformed JSON (with valid HMAC) → 400 ----------
Deno.test("malformed JSON body → 400 invalid_json", async () => {
  if (skipIfNoEnv()) return;
  const body = "{not json";
  const sig = await hmacHex(body, HMAC_SECRET);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": sig,
      "X-Request-Timestamp": String(Date.now()),
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_json");
});

// ---------- 6) missing action_type → 400 ----------
Deno.test("missing action_type → 400 action_type_required", async () => {
  if (skipIfNoEnv()) return;
  const body = JSON.stringify({ tenant_id: null, payload: {} });
  const sig = await hmacHex(body, HMAC_SECRET);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": sig,
      "X-Request-Timestamp": String(Date.now()),
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "action_type_required");
});

// ---------- 7) valid HMAC + known read action → 200 ----------
Deno.test("valid HMAC + known read action → 200 (executed or failed gracefully)", async () => {
  if (skipIfNoEnv()) return;
  const body = JSON.stringify({
    action_type: "get_revenue_today",
    arena_id: null,
    tenant_id: null,
    profile_type: "system",
    source: "orkym_api",
  });
  const sig = await hmacHex(body, HMAC_SECRET);
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MoodPlay-Signature": sig,
      "X-Request-Timestamp": String(Date.now()),
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body,
  });
  const json = await res.json();
  assertEquals(res.status, 200);
  // Auth + parsing passed; execution_status is data-dependent
  if (!json.command_id) throw new Error("expected command_id in response");
  if (!["executed", "failed"].includes(json.execution_status)) {
    throw new Error(`unexpected status: ${json.execution_status}`);
  }
});
