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
- `wa-send-message` — internal-only. Inserts `whatsapp_messages` (direction=outbound, initiated_by=orkym), proxies to ORKYM `/whatsapp/send` with HMAC. Idempotency via `idempotency_key`.
- `orkym-proactive-process` — claim batch → eligibility → **deterministic local template** (`_shared/proactive-templates.ts`, no ORKYM round-trip for content) → daily cap (≤2 / 24h per user) → wa-send-message → cooldown + feedback. Outbound row stores `parsed_intent.pending_action` (action_type + entity + scope + 6h `expires_at`).
- `orkym-cron-tick` calls `orkym_generate_periodic_triggers()` then `orkym-proactive-process` each tick.
- `wa-bridge` (Phase H WA loop): on inbound, if text matches affirmative regex (`sim/pode/ok/manda/...`) AND a recent (≤6h) outbound proactive with `pending_action` exists, calls `control-tower-execute` (internal-token mode) to execute the action, then replies with `confirmationFor(action_type)`. Negative replies (`não/n/...`) close the loop with `declinedReply()`. Outbound is flipped to `pending_action_consumed` to prevent re-execute. `orkym_trigger_feedback` gets `accepted | declined | blocked`. Long/free text falls back to ORKYM as before.

## Templates (deterministic, 1 obs + 1 sug + 1 question)
File `_shared/proactive-templates.ts` maps trigger_type → message + pending_action:
- `tournament_low_enrollment` / `low_enrollment` → `tournament_boost`
- `idle_court_slot` / `idle_slot` → `fill_idle_slots`
- `inactive_athlete` → `reactivation_message`
- `low_message_performance` / `low_campaign_performance` → `create_campaign`
- `top_product` → `product_boost`
- `revenue_drop` → `create_campaign`
- `relevant_tournament` / `near_rank_up` → `send_proactive_message`
Triggers without a template are skipped with reason `no_template` (e.g. billing/transactional notices).

## Defaults
- Daily cap: ≤2 proactive outbound / 24h per user (enforced inline in `orkym-proactive-process`, in addition to existing `orkym_proactive_check_eligibility`).
- Pending-action TTL: 6h.
- Cooldowns: 24h default; `subscription_overdue`=4h, `idle_slot`=72h, `low_enrollment`=48h.

## Strict boundaries
- No local AI / no LLM. Templates are static strings with `{name}/{when}/{n}` placeholders.
- No outbound WA outside `wa-send-message`.
- No bypass of eligibility / cooldown / kill-switch / budget.
- Affirmative interceptor in `wa-bridge` ONLY runs for short replies (≤25 chars) matching the whitelist; everything else still goes to ORKYM.
- `pending_action_consumed` is a one-way flag; once set, the action cannot re-execute.

## Files
- Migration: `20260429*phase_12_9*.sql`
- Edge: `supabase/functions/wa-send-message/`, `supabase/functions/orkym-proactive-process/`
- Hook: `src/hooks/useOrkymTriggers.ts`
- UI: `src/components/orkym/ProactiveTriggersPanel.tsx`
