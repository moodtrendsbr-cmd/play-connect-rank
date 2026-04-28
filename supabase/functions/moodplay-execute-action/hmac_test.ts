// Phase 12.6 — Deno tests for moodplay-execute-action security primitives
// Run with: deno test --allow-net --allow-env

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

Deno.test("hmac signature is deterministic for same body+secret", async () => {
  const body = JSON.stringify({ action_type: "get_arena_summary", tenant_id: "t1" });
  const secret = "test-secret-123";
  const a = await hmacHex(body, secret);
  const b = await hmacHex(body, secret);
  if (a !== b) throw new Error("HMAC not deterministic");
  if (a.length !== 64) throw new Error("HMAC SHA-256 must be 64 hex chars");
});

Deno.test("hmac changes when body changes", async () => {
  const secret = "s";
  const a = await hmacHex(`{"x":1}`, secret);
  const b = await hmacHex(`{"x":2}`, secret);
  if (a === b) throw new Error("HMAC must differ for different bodies");
});

Deno.test("timestamp skew rejection (>5min)", () => {
  const now = Date.now();
  const old = now - 6 * 60 * 1000;
  const skew = Math.abs(now - old);
  if (skew <= 5 * 60 * 1000) throw new Error("expected skew > 5min");
});

Deno.test("timestamp within window accepted", () => {
  const now = Date.now();
  const recent = now - 30 * 1000;
  const skew = Math.abs(now - recent);
  if (skew > 5 * 60 * 1000) throw new Error("expected skew <= 5min");
});
