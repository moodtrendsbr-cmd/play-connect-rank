---
name: Conversational Revenue Engine
description: Phase 13 — revenue attribution for ORKYM/WhatsApp activity, dashboards KPIs, optimization signals, ROI-adaptive caps
type: feature
---

# Phase 13 — Conversational Revenue Engine

Tracks revenue caused or assisted by ORKYM/WhatsApp interactions. No new sales logic, no local AI.

## Tables
- `orkym_revenue_attribution` — one row per paid revenue event (unique on `entity_type+entity_id`). Links `trigger_id`, `command_id`, `message_id`, `session_id`, `financial_transaction_id`, `attribution_type` (proactive|assisted|reactive), `attribution_confidence` (1.0/0.75/0.5), `revenue_amount`, `currency`, `conversion_window_seconds`.

## RPCs
- `orkym_attribute_revenue(_source_type,_source_id)` — resolves user, looks up proactive trigger → assisted session → reactive command in 24h window. On proactive match also writes `orkym_trigger_feedback (event='converted')`.
- `orkym_revenue_kpis_arena|tenant|company|admin` — scope-checked (`is_admin/is_tenant_admin/is_arena_owner/companies.user_id`); no anon execute.
- `orkym_message_performance(_scope_type,_scope_id,_from,_to)` — per `trigger_type`: sent/delivered/responded/converted/revenue/conversion_rate.
- `orkym_generate_optimization_triggers()` — enqueues `low_message_performance` (priority=low, weekly dedup) for `(tenant,trigger_type)` with ≥30 sends and conv<5% in 14d.
- `orkym_roi_multiplier(tenant,trigger_type)` — 0.5 / 1.0 / 2.0 based on 14d conversion (≥15% → 2×, <3% → 0.5×, default 1×). Requires ≥20 sends.

## Triggers
- `financial_transactions` AFTER INSERT/UPDATE OF status, when `status='paid'` → `orkym_attribute_revenue`.

## Eligibility (updated)
- `orkym_proactive_check_eligibility` now multiplies the per-user daily cap by `orkym_roi_multiplier`. Opt-in and per-trigger cooldowns are NEVER bypassed. Tenant cap stays 200/day.

## Edge functions
- `orkym-cron-tick` calls `orkym_generate_optimization_triggers()` on every tick.
- No new edge functions.

## Frontend
- `src/hooks/useRevenueKpis.ts` — scope-aware (arena/tenant/company/admin), 30d window.
- `src/components/revenue/RevenueCard.tsx`, `ConversionRateCard.tsx`, `MessagePerformanceCard.tsx`, `RevenueDashboardPanel.tsx`.
- Mounted in: ArenaDashboard, TenantDashboard, CompanyDashboard, AdminControlTower.

## Strict boundaries
- No mutation of bookings/enrollments/marketplace_orders/financial_transactions.
- No local AI. Optimization signals are pure SQL aggregates → ORKYM decides reaction.
- All outbound WA still goes through `wa-send-message` and respects opt-in/cooldown.
