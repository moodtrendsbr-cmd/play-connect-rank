## Phase 12.9 — Proactive ORKYM Operations

The MoodPlay stops being purely reactive. Operational events (enrollments, subscriptions, bookings, attendance, marketplace, campaigns, finance) feed a triggers queue. The cron processes the queue, checks eligibility + rate limits + cooldowns, asks ORKYM whether/what to send, then dispatches outbound WhatsApp via the ORKYM gateway. All decisions stay in ORKYM; MoodPlay only orchestrates.

### Architecture (data flow)

```text
operational tables (enrollments, bookings, subscriptions, ...)
        │  AFTER INSERT/UPDATE triggers
        ▼
public.orkym_triggers_queue  (pending)
        │  orkym-cron-tick  (priority high → medium → low)
        ▼
eligibility + rate-limit + cooldown + dedup
        │  pass
        ▼
POST orkym-invoke  domain=proactive action=decide
        │  { trigger, memory_context, profile_type, scope }
        ▼
ORKYM responds: { should_send, message, action?, priority }
        │  should_send = true
        ▼
resolve_whatsapp_instance → wa-send-message (NEW)
        │
        ▼
whatsapp_messages + conversational_commands (direction=outbound, initiated_by=orkym)
        │
        ▼
feedback events on delivery / reply / conversion
```

### 1. Database (one migration)

**`public.orkym_triggers_queue`**
- `id uuid pk`, `tenant_id uuid not null`, `arena_id uuid null`, `user_id uuid null`, `profile_type text` (`athlete|arena|organizer|company|tenant`)
- `trigger_type text not null` (e.g. `subscription_due`, `attendance_drop`, `idle_slot`, `low_enrollment`, `low_campaign_performance`, `revenue_drop`)
- `entity_type text`, `entity_id uuid`, `payload jsonb default '{}'`
- `priority text check in (high, medium, low) default 'medium'`
- `status text check in (pending, claimed, processed, skipped, failed) default 'pending'`
- `dedup_key text` (e.g. `subscription_due|<sub_id>|<period>`) — unique partial index `WHERE status IN ('pending','claimed','processed')`
- `attempts int default 0`, `last_error text`, `scheduled_for timestamptz default now()`
- `created_at`, `claimed_at`, `processed_at`
- Indexes: `(status, priority, scheduled_for)`, `(tenant_id, created_at desc)`, `(user_id, trigger_type, created_at desc)`
- RLS: tenant admin / arena owner / super admin read-only; service role writes.

**`public.orkym_trigger_feedback`** (lightweight)
- `id`, `trigger_id fk`, `event text` (`message_sent|delivered|read|responded|ignored|converted`), `correlation_id`, `metadata jsonb`, `created_at`.

**`public.orkym_proactive_cooldowns`**
- `(scope_type, scope_id, trigger_type)` PK with `last_sent_at`, `count_24h`. Used for cooldown lookups.

**RPCs**
- `orkym_trigger_enqueue(p_tenant, p_arena, p_user, p_profile_type, p_trigger_type, p_entity_type, p_entity_id, p_payload, p_priority, p_dedup_key, p_scheduled_for)` — security definer, conflict-do-nothing on `dedup_key`.
- `orkym_trigger_claim_batch(_limit int)` — picks N pending rows ordered `priority,scheduled_for`, marks `claimed`.
- `orkym_trigger_complete(_id, _status, _error)`.
- `orkym_proactive_check_eligibility(_user_id, _tenant_id, _category, _trigger_type)` returns `{ eligible boolean, reason text }` — checks `orkym_proactive_eligibility.opted_in`, daily user cap (configurable, default 3/day), tenant cap (default 200/day from `whatsapp_messages` count where `initiated_by='orkym'`), per-trigger cooldown (default 24h).
- `orkym_proactive_record_send(...)` — updates `orkym_proactive_cooldowns`.

**Triggers (deterministic enqueue)**
- `arena_student_subscriptions`: AFTER UPDATE/INSERT — when `next_due_at` within 5 days and `status='active'` enqueue `subscription_due` (priority=high if overdue).
- `arena_attendance`: AFTER INSERT `status='absent'` — count last 4 weeks; if ≥ 3 absences enqueue `attendance_drop` (priority=medium).
- `bookings`: AFTER INSERT — recompute idle slot pattern via existing memory; nightly cron job alternative (we'll keep it cron-only to avoid noise).
- `enrollments`: AFTER INSERT — count tournament fill rate; if < 30 % and start_date < 7 days → enqueue `low_enrollment` for organizer.
- `marketplace_orders`: AFTER UPDATE `status='paid'` — enqueue `top_product` for company (priority=low).
- `ad_campaigns`: nightly cron only (no row-level signal yet).
- `financial_transactions`: AFTER INSERT for tenant revenue drop — done in cron, not trigger, to compare deltas.

The cron-only triggers (`idle_slot`, `low_campaign_performance`, `revenue_drop`, `relevant_tournament`) are produced by a new SQL function `orkym_generate_periodic_triggers()` invoked from `orkym-cron-tick`.

### 2. Edge functions

**NEW `supabase/functions/wa-send-message/index.ts`**
- `verify_jwt = false`, service-token internal use only (asserted via `x-internal-token` matching `ORKYM_INTERNAL_TOKEN`).
- Input: `{ instance_id?, wa_phone, body, template_name?, template_vars?, tenant_id, arena_id?, user_id?, category, correlation_id, idempotency_key, command_id? }`.
- Resolves instance via `resolve_whatsapp_instance` if missing.
- Posts to ORKYM `/whatsapp/send` (existing ORKYM endpoint pattern, HMAC-signed using `ORKYM_HMAC_SECRET` like `orkym-whatsapp-connection`).
- Inserts `whatsapp_messages` (`direction='outbound', initiated_by='orkym'`) and updates with `external_message_id` + `delivery_status`.
- On success returns `{ ok, message_id, external_message_id }`.

**NEW `supabase/functions/orkym-proactive-process/index.ts`**
- Internal (service-token guarded). Params: `{ limit?: 100 }`.
- Calls `orkym_trigger_claim_batch`.
- For each trigger:
  1. Resolve scope (`tenant_id`, `arena_id`, `user_id`).
  2. Fetch `memory_context` via `getMemoryContext` shared helper.
  3. Call `orkym_proactive_check_eligibility`. If not eligible → `complete(skipped, reason)` + feedback `ignored`.
  4. POST to `orkym-invoke` with `domain='proactive'`, `action='decide'`, payload `{ trigger, memory_context, profile_type, tenant_id, arena_id, user_id }`.
  5. If `should_send`:
     - Insert outbound `conversational_commands` (`direction='outbound', initiated_by='orkym', status='dispatched'`, `linked_entity_type=trigger`).
     - Call `wa-send-message` with `command_id`, `category` (mapped from trigger), `idempotency_key = dedup_key`.
     - Record `orkym_proactive_record_send` and feedback `message_sent`.
     - `complete(processed)`.
  6. Else `complete(skipped, 'orkym_no_send')`.
- Robust try/catch per trigger; failures → `complete(failed, err)` and `attempts++`.

**EDIT `supabase/functions/orkym-cron-tick/index.ts`**
- After existing memory work add:
  - `await admin.rpc('orkym_generate_periodic_triggers')` (inside try/catch).
  - `fetch(orkym-proactive-process, { limit: 100 })`.

**EDIT `supabase/functions/wa-bridge/index.ts`** (feedback loop on inbound)
- When inbound message arrives and there's a recent outbound `conversational_commands` to the same phone within 24 h with `linked_entity_type='trigger'`, insert `orkym_trigger_feedback (event='responded')`. Already-existing multi-turn (12.7) and memory (12.8) wiring continues.
- Also when message-status webhooks (already handled) update `delivery_status`, mirror into feedback (`delivered`, `read`).

**EDIT `supabase/config.toml`** to register `wa-send-message` and `orkym-proactive-process` with `verify_jwt = false`.

### 3. Frontend

Light, observability-only (no new flows for end-users beyond opt-in already shipped):

- **NEW** `src/components/orkym/ProactiveTriggersPanel.tsx` — table of recent triggers (status, priority, trigger_type, entity, sent?). Visible in Tenant + Arena dashboards.
- **NEW** `src/hooks/useOrkymTriggers.ts` — fetches `orkym_triggers_queue` + feedback for current scope.
- **EDIT** existing tenant/arena dashboards to mount the panel under the existing ORKYM section.
- No new auth flows; opt-in already lives in `orkym_proactive_eligibility` and the existing settings UI.

### 4. Memory & rules

- Update `mem/index.md` Core: add line "Proactive ops: triggers queued in `orkym_triggers_queue`; ORKYM decides content; MoodPlay enforces eligibility/cooldown; outbound only via `wa-send-message`."
- Add `mem/features/proactive-ops.md` describing trigger types, priorities, default caps (3 msg/user/day, 24 h cooldown/trigger_type, 200/tenant/day), feedback events, and the strict "no AI in MoodPlay" boundary.

### 5. Rate-limit defaults

- Per user/day: 3 (configurable in `orkym_proactive_eligibility.metadata.daily_cap`).
- Per tenant/day: 200.
- Per `(scope, trigger_type)` cooldown: 24 h default; `subscription_due` overdue=4 h, `idle_slot`=72 h, `low_enrollment`=48 h.
- All defaults centralized in a SQL function `orkym_trigger_default_cooldown(_trigger_type)`.

### 6. Feedback loop fields

`orkym_trigger_feedback.event` ∈ `message_sent | delivered | read | responded | ignored | converted`.
- `delivered`/`read` mirrored from `whatsapp_messages` status updates.
- `responded` set by wa-bridge when a related inbound arrives.
- `converted` set by domain hooks (e.g. `enrollments` insert with metadata `source='orkym_proactive'`, marketplace order with `metadata.orkym_trigger_id`). We populate when present; other domains can be wired later.

### 7. Strict boundaries (do NOT)

- No local AI/LLM in MoodPlay. Decision text always from ORKYM.
- No outbound WhatsApp without ORKYM `should_send=true`.
- No bypassing eligibility/cooldown.
- No new schema in `auth/storage/realtime/supabase_functions/vault`.
- No raw SQL execution from edge functions.

### Deliverables checklist

- [ ] Migration: `orkym_triggers_queue`, `orkym_trigger_feedback`, `orkym_proactive_cooldowns`, RPCs, table triggers, `orkym_generate_periodic_triggers`, `orkym_proactive_check_eligibility`.
- [ ] Edge: `wa-send-message`, `orkym-proactive-process`.
- [ ] Edits: `orkym-cron-tick`, `wa-bridge`, `supabase/config.toml`.
- [ ] Frontend: `useOrkymTriggers`, `ProactiveTriggersPanel`, dashboard mounts.
- [ ] Memory: `mem/index.md` core line + `mem/features/proactive-ops.md`.

### Acceptance

- A subscription with `next_due_at` in 3 days enqueues `subscription_due` exactly once per period (dedup_key holds).
- Cron picks it up, checks eligibility, calls ORKYM, sends WhatsApp if approved, logs `whatsapp_messages` + `conversational_commands` (outbound, initiated_by=orkym), records cooldown.
- A second event within 24 h is skipped with `reason='cooldown'`.
- Replying on WhatsApp continues into existing 12.7 multi-turn flow and updates 12.8 memory.
- Opt-out (`orkym_proactive_eligibility.opted_in=false`) blocks all sends to that user.
