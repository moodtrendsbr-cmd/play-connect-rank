
## Phase 13 — Conversational Revenue Engine

Track, attribute and analyze every revenue event that originated from (or was assisted by) an ORKYM/WhatsApp interaction. No new sales logic, no local AI: we sit on top of `financial_transactions`, `bookings`, `enrollments`, `marketplace_orders`, and the existing ORKYM tables (12.5/12.7/12.8/12.9).

### Data flow

```text
financial_transactions (paid)
        │  AFTER UPDATE/INSERT trigger
        ▼
attribution resolver  (window lookup vs ORKYM activity)
   ├── proactive  → outbound trigger msg in last 24h to same user/entity
   ├── assisted   → multi-turn session touched the entity in last 24h
   ├── reactive   → user-initiated command in last 24h
   └── none       → no attribution row (organic)
        │
        ▼
public.orkym_revenue_attribution
        │
        ▼
KPI views + RPCs  →  dashboards (Arena / Tenant / Company / Admin)
                  →  optimization signals back into orkym_triggers_queue
```

### 1. Database (one migration)

**`public.orkym_revenue_attribution`**
- `id uuid pk`
- `tenant_id uuid not null`, `arena_id uuid null`, `user_id uuid null`, `profile_type text`
- `trigger_id uuid null` → `orkym_triggers_queue(id)`
- `command_id uuid null` → `conversational_commands(id)`
- `message_id uuid null` → `whatsapp_messages(id)`
- `session_id uuid null` → `conversation_sessions(id)` (12.7)
- `entity_type text` ∈ `booking | enrollment | marketplace_order | arena_billing_cycle | sponsorship`
- `entity_id uuid`
- `financial_transaction_id uuid null` → `financial_transactions(id)`
- `revenue_amount numeric(10,2) not null`, `currency text default 'BRL'`
- `attribution_type text` ∈ `proactive | assisted | reactive`
- `attribution_confidence numeric(3,2)` (1.0 proactive, 0.75 assisted, 0.5 reactive)
- `conversion_window_seconds int`
- `metadata jsonb`, `created_at timestamptz default now()`
- Unique `(entity_type, entity_id)` — one attribution per revenue event.
- Indexes: `(tenant_id, created_at desc)`, `(arena_id, created_at desc)`, `(trigger_id)`, `(attribution_type, created_at desc)`.
- RLS: admin / tenant_admin / arena_owner read; service role writes.

**RPC `orkym_attribute_revenue(_source_type, _source_id)`** (security definer)
1. Loads `financial_transactions` row → `(tenant, arena, user, amount, currency, paid_at)`. Skip if not `paid`.
2. Resolves `entity_type/entity_id` from `source_type/source_id` (1:1 mapping; marketplace_order has buyer_user_id; bookings have user_id; enrollments have payer/user).
3. Window = 24h before `paid_at`.
4. Look up in priority order:
   - **proactive**: most recent `orkym_triggers_queue` row for `(user_id, entity_type)` with `status='processed'` + a feedback `message_sent` event in window. Capture trigger_id, command_id, message_id.
   - **assisted**: open `conversation_sessions` (12.7) for that user that referenced the entity (via `linked_entity_id` on conversational_commands within the session, or session payload).
   - **reactive**: most recent `conversational_commands` with `direction='inbound'`, `user_id=...`, status `completed`, in window, mentioning the entity (linked_entity_id) or the same domain shortcode.
5. Insert with conflict-do-nothing on `(entity_type, entity_id)`. Logs only when at least one of trigger/command/session matches.
6. If matched proactive trigger, also append `orkym_trigger_feedback (event='converted', metadata={amount,currency})`.

**Triggers**
- `financial_transactions` AFTER INSERT OR UPDATE OF `status` WHEN `NEW.status='paid'`: call `orkym_attribute_revenue(NEW.source_type, NEW.source_id)`.
- Backfill statement at end of migration to attribute the last 30 days of paid transactions.

**KPI helpers (SQL functions, all security definer + scope-checked)**
- `orkym_revenue_kpis_arena(_arena_id, _from, _to)` → `{ revenue_total, revenue_orkym, bookings_total, bookings_via_wa, conversion_rate }`.
- `orkym_revenue_kpis_tenant(_tenant_id, _from, _to)` + per-arena breakdown.
- `orkym_revenue_kpis_company(_company_user_id, _from, _to)` for marketplace orders.
- `orkym_revenue_kpis_admin(_from, _to)` global ROI.
- `orkym_message_performance(_scope_type, _scope_id, _from, _to)` aggregating `whatsapp_messages` (sent / replied) joined with attribution (converted / revenue / conv_rate).

**Optimization signals (no new schema)**
- New SQL function `orkym_generate_optimization_triggers()` invoked by `orkym-cron-tick`:
  - Finds `(tenant_id, trigger_type)` with ≥30 sends and conversion_rate < 5% in last 14d → enqueue `low_message_performance` trigger (priority=low, dedup=`opt|<scope>|<trigger_type>|<week>`).
  - Finds best 3-hour window per tenant where conversion_rate is highest → store as `payload.preferred_send_window` on the same enqueue. ORKYM consumes it via `memory_context`.
  - All it does is enqueue ORKYM-decidable triggers; no auto-actions.

**Adaptive rate-limit**
- Update `orkym_proactive_check_eligibility` to read a `roi_multiplier` from the new helper:
  - `effective_user_cap = base_cap * clamp(roi_multiplier, 0.5, 2.0)`.
  - `roi_multiplier = case when conversion_rate(tenant,trigger_type, 14d) >= 0.15 then 2.0 when <0.03 then 0.5 else 1.0`.
- Only multiplies caps; never bypasses opt-in or per-trigger cooldowns.

### 2. Edge functions

No new functions. Edits only:

- **`orkym-cron-tick`**: after the existing 12.9 block, run `orkym_generate_optimization_triggers()` (try/catch).
- **`wa-send-message`**: include the inserted `message_id` on the response and ensure it is logged in `whatsapp_messages.metadata.trigger_id` (already done) for attribution lookups.
- **`wa-bridge`**: when a conversion-related inbound is processed and a recent matching outbound trigger exists, run `orkym_attribute_revenue` opportunistically if the inbound led to an immediate paid event (defensive — main path is the financial_transactions trigger).

(All existing functions keep current `verify_jwt` settings — no `config.toml` changes needed.)

### 3. Frontend

New shared components in `src/components/revenue/`:
- `RevenueCard.tsx` — total revenue / ORKYM revenue / share %, sparkline placeholder.
- `ConversionRateCard.tsx` — messages sent vs converted, % rate, delta vs previous period.
- `MessagePerformanceCard.tsx` — table per `trigger_type`: sent, delivered, responded, converted, revenue, conv rate.

New hook `src/hooks/useRevenueKpis.ts` calling the scope-appropriate RPC.

Mounted in:
- `src/pages/arena-dashboard/...` main dashboard (under existing ORKYM section).
- `src/pages/tenant/TenantDashboard.tsx` (network view, with per-arena breakdown table).
- `src/pages/company/CompanyDashboard.tsx` (marketplace conversion only).
- `src/pages/admin/AdminControlTower.tsx` (global ROI).

Reuse existing card/typography styling. Sentence case, Bebas headings, `#2BFF88` for highlight numbers per project style.

### 4. Memory & rules

- Update `mem/index.md` Core: add line "Phase 13 revenue: `orkym_revenue_attribution` (proactive|assisted|reactive). Triggered by `financial_transactions` paid. Adaptive caps via ROI; never bypass opt-in."
- New `mem/features/conversational-revenue.md` documenting attribution rules, window, KPIs, optimization-trigger names, and the strict no-AI / no-finance-mutation boundary.

### 5. Strict boundaries (do NOT)

- No mutation of `financial_transactions`, `bookings`, `enrollments`, `marketplace_orders` (read-only).
- No local AI/LLM. Optimization signals are pure SQL aggregates.
- No new sales/checkout flow. Attribution observes existing payment paths.
- No edits to `auth/storage/realtime/supabase_functions/vault`.
- No raw SQL execution from edge functions.

### 6. Acceptance

- A booking paid 2h after a `subscription_due` outbound trigger to the same user creates an `orkym_revenue_attribution` row with `attribution_type='proactive'` + a `converted` feedback event with the amount.
- A marketplace order paid after the buyer sent a WhatsApp command (no proactive trigger) creates `attribution_type='reactive'`.
- A tenant dashboard shows `revenue_orkym / revenue_total` and per-arena ranking.
- Conversion rate < 5% on `low_enrollment` triggers for 14d → a `low_message_performance` trigger appears in the queue for ORKYM to react to.
- Caps adjust: a tenant with 18% conversion on `subscription_due` sends up to 2× the base daily user cap; a tenant with 1% conversion sends 0.5×.
- Opt-out users still receive zero proactive messages regardless of ROI.

### Deliverables checklist

- [ ] Migration: `orkym_revenue_attribution`, `orkym_attribute_revenue`, financial_transactions trigger, KPI functions, `orkym_generate_optimization_triggers`, eligibility update, 30d backfill.
- [ ] Edits: `orkym-cron-tick`, `wa-bridge` (defensive call), `wa-send-message` (metadata pass-through).
- [ ] Frontend: `RevenueCard`, `ConversionRateCard`, `MessagePerformanceCard`, `useRevenueKpis`, dashboard mounts (Arena/Tenant/Company/Admin).
- [ ] Memory: `mem/index.md` core line + `mem/features/conversational-revenue.md`.
