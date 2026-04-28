---
name: Multi-Turn Conversational Flows
description: Phase 12.7 stateful conversation sessions; lock, snapshot, idempotent execution, multi-intent, resume window
type: feature
---

# Phase 12.7 — Multi-Turn Conversational Flows (Hardened)

ORKYM owns intent + value extraction; MoodPlay is a strict state machine.

## Endpoint
`POST /functions/v1/moodplay-session-step` (HMAC + timestamp + optional X-Idempotency-Key).

## Storage
Table `conversation_sessions` (1 active per user+instance enforced by partial unique index).
States: `collecting | confirming | executing | completed | abandoned | failed | superseded`.

## Lifecycle
1. **resolve_or_create_session** — finds active session for `(user_id, whatsapp_instance_id)`. New intent ≠ current → marks old as `superseded`. With `_allow_resume=true`, can reopen `abandoned` within `resumable_until`.
2. **acquire_session_lock** — `SELECT FOR UPDATE NOWAIT` + `is_locked` flag with 30s TTL. Concurrent request → 409 `session_locked`.
3. **update_session_context** — merges values, extends `expires_at`.
4. **prepare_session_confirmation** — when all required fields valid, freezes `context_snapshot` + `snapshot_hash` (sha256 of canonical JSON).
5. **mark_session_executing** — deterministic `idempotency_key = sha256(session_id + snapshot_hash)`. Replay returns cached `execution_result` (no double charge).
6. Calls `moodplay-execute-action` server-to-server with same idempotency key.
7. **complete_session** marks `completed`/`failed`, releases lock.
8. `abandon_session` (explicit abort) or `expire_stale_sessions` (cron) → state `abandoned`, `resumable_until = now() + 30min`.

## Defaults
- Session TTL: 15 min (per-flow override via `ttl_minutes`)
- Resume window: 30 min after abandonment
- Lock TTL: 30s
- Max one active session per `(user_id, whatsapp_instance_id)`

## Supported intents (5)
| Intent | action_type | Status |
|---|---|---|
| `reserve_court` | `book_court` | flow ready, handler pending → `failed:unknown_action_type` |
| `create_class` | `create_class` | end-to-end |
| `enroll_student` | `enroll_athlete_in_plan` | flow ready, handler pending |
| `create_tournament` | `create_tournament` | end-to-end |
| `generate_billing_cycle` | `generate_billing_cycle` | end-to-end |

## Events emitted (`security_audit_log`)
`session.created | session.lock_denied | session.context_updated | session.confirmation_prepared | session.execution_started | session.execution_completed | session.execution_failed | session.abandoned | session.resumed | session.replay_blocked`

## Hardening guarantees
- **Lock**: `FOR UPDATE NOWAIT` + advisory flag prevents concurrent state writes.
- **Idempotency**: deterministic key from snapshot hash; replay returns cached result.
- **Snapshot anti-tamper**: hash recomputed at execute time; mismatch → 409.
- **Multi-intent**: ORKYM-driven; old session marked `superseded`.
- **Cross-tenant**: arena/tenant FK validated on every call.
- **Authority**: MoodPlay never decides intent; rejects `unknown_intent` immediately.

## Files
- `supabase/functions/moodplay-session-step/index.ts`
- `supabase/functions/_shared/conversation-flows.ts`
- `supabase/functions/moodplay-session-step/{flow_test,integration_test}.ts`
- `src/lib/wa.ts` → `stepSession()` (debug helper)

## Cron
`orkym-cron-tick` calls `expire_stale_sessions(30)` every tick.
