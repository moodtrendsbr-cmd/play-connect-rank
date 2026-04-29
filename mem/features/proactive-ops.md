---
name: Proactive ORKYM Operations
description: Phase 12.9 — triggers queue, eligibility, ORKYM-decided outbound WhatsApp, rate limits, feedback
type: feature
---

# Phase 12.9 — Proactive ORKYM Operations

MoodPlay enqueues operational signals. ORKYM decides if/what to send. MoodPlay enforces eligibility, cooldown, and dispatches outbound WhatsApp.

## Tables
- `orkym_triggers_queue`: pending/claimed/processed/skipped/failed; unique partial index on `dedup_key`.
- `orkym_trigger_feedback`: events `message_sent | delivered | read | responded | ignored | converted`.
- `orkym_proactive_cooldowns`: PK `(scope_type, scope_id, trigger_type)`.

## RPCs (all SECURITY DEFINER, locked to service_role)
- `orkym_trigger_enqueue` — conflict-do-nothing on `dedup_key`.
- `orkym_trigger_claim_batch(_limit)` — `FOR UPDATE SKIP LOCKED`, ordered `priority,scheduled_for`.
- `orkym_trigger_complete(_id,_status,_error)`.
- `orkym_proactive_check_eligibility(...)` — opt-in, user/tenant daily caps, per-trigger cooldown.
- `orkym_proactive_record_send(...)`.
- `orkym_generate_periodic_triggers()` — cross-row aggregates (subscriptions due, low enrollment).

## Table triggers
- `arena_student_subscriptions` AFTER INSERT/UPDATE → `subscription_due` / `subscription_overdue`.
- `arena_attendance` AFTER INSERT (status=absent) → `attendance_drop` (≥3 in 28d).
- `marketplace_orders` AFTER INSERT/UPDATE (status=paid) → `top_product`.

## Edge functions
- `wa-send-message` — internal-only (`x-internal-token` or service-role bearer). Inserts `whatsapp_messages` (direction=outbound, initiated_by=orkym), proxies to ORKYM `/whatsapp/send` with HMAC. Idempotency via `idempotency_key`.
- `orkym-proactive-process` — claim batch → eligibility → memory_context → orkym-invoke `proactive/decide` → wa-send-message → cooldown + feedback.
- `orkym-cron-tick` calls `orkym_generate_periodic_triggers()` then `orkym-proactive-process` each tick.
- `wa-bridge` registers `responded` feedback on inbound when a recent (24h) outbound trigger exists.

## Defaults
- User cap: 3 msg / 24h (override via `orkym_proactive_eligibility.metadata.daily_cap`).
- Tenant cap: 200 / 24h.
- Cooldowns: 24h default; `subscription_overdue`=4h, `idle_slot`=72h, `low_enrollment`=48h.

## Strict boundaries
- No local AI in MoodPlay. ORKYM always decides text + should_send.
- No outbound WA without ORKYM `should_send=true`.
- No bypass of eligibility/cooldown.
- All proactive sends MUST go through `wa-send-message`.

## Files
- Migration: `20260429*phase_12_9*.sql`
- Edge: `supabase/functions/wa-send-message/`, `supabase/functions/orkym-proactive-process/`
- Hook: `src/hooks/useOrkymTriggers.ts`
- UI: `src/components/orkym/ProactiveTriggersPanel.tsx`
