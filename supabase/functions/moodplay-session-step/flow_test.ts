// Phase 12.7 — Unit tests for conversation flow schema
// Run with: deno test --allow-net --allow-env --allow-read

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalJson,
  evaluateFlow,
  getFlow,
  listSupportedIntents,
  sha256Hex,
} from "../_shared/conversation-flows.ts";

Deno.test("listSupportedIntents includes all 5 phase 12.7 flows", () => {
  const intents = listSupportedIntents();
  assertEquals(intents.sort(), [
    "create_class",
    "create_tournament",
    "enroll_student",
    "generate_billing_cycle",
    "reserve_court",
  ]);
});

Deno.test("getFlow returns null for unknown intent", () => {
  assertEquals(getFlow("ride_unicorn"), null);
});

Deno.test("evaluateFlow: empty context → all required fields missing, no errors", () => {
  const flow = getFlow("reserve_court")!;
  const out = evaluateFlow(flow, {});
  assertEquals(out.ready, false);
  assertEquals(out.validation_errors.length, 0);
  assertEquals(out.missing_fields.length, 5);
});

Deno.test("evaluateFlow: invalid date → validation error, not missing", () => {
  const flow = getFlow("reserve_court")!;
  const out = evaluateFlow(flow, {
    arena_id: "11111111-1111-1111-1111-111111111111",
    court_id: "22222222-2222-2222-2222-222222222222",
    date: "23/04/2026", // wrong format
    start_time: "20:00",
    duration_hours: 2,
  });
  assertEquals(out.ready, false);
  const dateErr = out.validation_errors.find((e) => e.field === "date");
  assert(dateErr, "expected date error");
  assertEquals(dateErr!.message, "date_invalid_date");
});

Deno.test("evaluateFlow: integer out of range → below_min", () => {
  const flow = getFlow("reserve_court")!;
  const out = evaluateFlow(flow, {
    arena_id: "11111111-1111-1111-1111-111111111111",
    court_id: "22222222-2222-2222-2222-222222222222",
    date: "2026-04-23",
    start_time: "20:00",
    duration_hours: 0,
  });
  assertEquals(out.ready, false);
  const dh = out.validation_errors.find((e) => e.field === "duration_hours");
  assertEquals(dh?.message, "duration_hours_below_min");
});

Deno.test("evaluateFlow: complete valid context → ready=true", () => {
  const flow = getFlow("reserve_court")!;
  const out = evaluateFlow(flow, {
    arena_id: "11111111-1111-1111-1111-111111111111",
    court_id: "22222222-2222-2222-2222-222222222222",
    date: "2026-04-23",
    start_time: "20:00",
    duration_hours: 2,
  });
  assertEquals(out.ready, true);
  assertEquals(out.validation_errors.length, 0);
  assertEquals(out.missing_fields.length, 0);
});

Deno.test("summarize produces human-readable confirmation text", () => {
  const flow = getFlow("create_class")!;
  const text = flow.summarize({
    title: "Padel Iniciante",
    modality: "padel",
    start_at: "2026-05-01T19:00:00Z",
    end_at: "2026-05-01T20:00:00Z",
    capacity: 10,
  });
  assert(text.includes("Padel Iniciante"));
  assert(text.includes("padel"));
  assert(text.includes("10 vagas"));
});

Deno.test("canonicalJson is order-independent", () => {
  const a = canonicalJson({ b: 2, a: 1, c: { z: 9, y: 8 } });
  const b = canonicalJson({ a: 1, c: { y: 8, z: 9 }, b: 2 });
  assertEquals(a, b);
});

Deno.test("sha256Hex produces stable 64-char hash", async () => {
  const h1 = await sha256Hex("hello");
  const h2 = await sha256Hex("hello");
  assertEquals(h1, h2);
  assertEquals(h1.length, 64);
});

Deno.test("snapshot hash is stable across key reorder", async () => {
  const snap1 = { _intent: "reserve_court", date: "2026-04-23", court_id: "x" };
  const snap2 = { court_id: "x", _intent: "reserve_court", date: "2026-04-23" };
  const h1 = await sha256Hex(canonicalJson(snap1));
  const h2 = await sha256Hex(canonicalJson(snap2));
  assertEquals(h1, h2);
});
