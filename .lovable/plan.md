## Phase H — Control Tower AI

A thin **synthesis layer** that consolidates existing signals (Phases 8/9/10/12.x/13/G) into a single executive view per scope (admin / tenant / arena / organizer / company). It does **not** add ML, parallel systems, or local AI — it reuses ORKYM for any reasoning and the existing growth/revenue/opportunity infrastructure for data.

### What it delivers

For each scope, one consolidated payload:
```
{ health_score: 0-100, alerts: [], opportunities: [], recommendations: [], next_best_action }
```
Surfaced as a single `ControlTowerAIPanel` card mounted at the top of each Control Tower page.

---

### 1. Backend — single SQL function (no new tables)

Add migration with one read-only RPC:

`public.control_tower_summary(_scope_type text, _scope_id uuid)` → `jsonb`
- Scopes: `'admin' | 'tenant' | 'arena' | 'organizer' | 'company'`
- `SECURITY INVOKER` — RLS on underlying tables/views does the access control
- Reads only from already-existing sources:
  - `v_growth_dashboard` (suggested/auto/blocked/revenue 30d)
  - `orkym_revenue_attribution` (revenue, ROI)
  - `orkym_triggers_queue` (pending opportunities already detected by Phase G)
  - `orkym_action_proposals` (pending high-priority proposals → recommendations)
  - `financial_transactions` (revenue trend 7d vs prev 7d)
  - `enrollments` + `tournaments` (low-fill upcoming)
  - `court_bookings` + `arena_court_slots` (occupancy)
  - `athlete_xp` / `xp_events` (engagement signal — admin/tenant only)
  - `growth_budgets` (budget headroom)

**Health score (0–100)** — weighted average of 5 sub-scores, each 0–100:
- `enrollment_score` (paid vs capacity for active tournaments)
- `revenue_score` (last 7d vs previous 7d trend, capped)
- `occupancy_score` (booked slots vs available, last 14d)
- `engagement_score` (DAU-style: distinct profiles with activity 7d vs 30d)
- `orkym_adoption_score` (auto+approved / suggested, 30d)

Weights default `0.25/0.25/0.20/0.15/0.15`; missing sub-scores are skipped and weights renormalized so empty scopes don't punish themselves.

**Alerts** — deterministic rules from existing data:
- `low_enrollment_tournament` (pending triggers of type `tournament_low_enrollment`)
- `revenue_drop` (7d revenue < 70% of previous 7d, both >0)
- `no_recent_checkins` (active tournament today, 0 check-ins)
- `inactive_users_spike` (count of `inactive_athlete` triggers)
- `low_roi_campaigns` (ad_campaigns active 30d with ROI < 0.5)
- `budget_exhausted` (any `growth_budgets` ≥ 90% spent)

**Opportunities** — pulled directly from `orkym_triggers_queue` open items (already deduped by Phase G) plus:
- `idle_court_slots` (next 14d, never-booked recurring slots)
- `trending_product` (top product by 7d orders growth, company scope)
- `near_rank_up_athletes` count (admin/tenant)
- `sponsorable_company` (companies with ≥X reach but no active campaign — admin only)

**Recommendations** — each item is `{ id, title, body, action_type, payload, impact, effort }` where `action_type` matches the **existing Phase G allowlist** (`tournament_boost`, `reactivation_message`, `fill_idle_slots`, `upsell_plan`, `create_campaign`, `recommend_product`, `send_proactive_message`). Impact/effort are heuristics (low/medium/high).

**Next Best Action (NBA)** — pick the recommendation with `max(impact_weight − effort_weight)`, tie-break by alert severity it resolves.

### 2. ORKYM hand-off (no duplication)

The summary is **descriptive**. Any actual decision/personalization stays in ORKYM:
- Each recommendation in the UI has a single CTA → reuses `invokeOrkym('growth', 'decide', { entity: { trigger_id|opportunity }, context })` which already returns a proposal that flows through the existing `orkym_action_proposals` → `orkym-execute-action` pipeline.
- "Send via WhatsApp" CTAs go through existing `wa-send-message` (never direct).
- Eligibility, cooldown, opt-in, budget guardrails stay enforced by existing RPCs (`autonomy_check_guardrails`, `growth_check_budget`).

No new edge function. No `control_tower-decide` route. No new ORKYM domain.

### 3. Frontend

**New files:**
- `src/hooks/useControlTowerSummary.ts` — wraps RPC, returns `{ summary, loading, error, refresh }`. Polls every 60s while panel mounted.
- `src/components/control-tower/ControlTowerAIPanel.tsx` — single card with 4 blocks:
  1. **Health Score** (big number 0–100 + colored gauge: ≥80 emerald, 50–79 amber, <50 destructive) + 5 mini-bars for sub-scores.
  2. **Alerts** (max 3 visible, "+N mais") — severity dot, one-liner, optional "Ver" link.
  3. **Opportunities** (max 3) — title + impact tag.
  4. **Próxima melhor ação (NBA)** — highlighted block with title, 1-line rationale, primary CTA "Executar via ORKYM" + secondary "Ver detalhes" (opens existing `ActionProposalDetail` after proposal is created).
- `src/components/control-tower/HealthScoreBadge.tsx` — small reusable score chip.

**Mounts (top of each page, above existing content):**
- `src/pages/admin/AdminControlTower.tsx` → `<ControlTowerAIPanel scope={{type:'admin'}} />`
- `src/pages/tenant/TenantDashboard.tsx` → `scope={{type:'tenant', id: tenant.id}}`
- `src/pages/arena-dashboard/ArenaControlTower.tsx` → `scope={{type:'arena', id: arena.id}}`
- `src/pages/organizer/OrganizerDashboard.tsx` → `scope={{type:'organizer', id: organizerId}}`
- `src/pages/company/CompanyDashboard.tsx` → `scope={{type:'company', id: company.id}}`

### 4. Memory

New file `mem/features/control-tower-ai.md` documenting:
- Health score formula + weights
- Alert/opportunity/recommendation catalog
- Hard rule: Control Tower is **read-only synthesis**; all decisions/executions go through ORKYM + existing guardrails. No local AI, no parallel proposal/budget tables.

Update `mem://index.md` Core line + Memories entry.

---

### What we explicitly will NOT do

- No new tables (reuse `orkym_triggers_queue`, `orkym_action_proposals`, `orkym_revenue_attribution`, `growth_budgets`, `v_growth_dashboard`).
- No new edge function (RPC only; ORKYM calls reuse `orkym-invoke`).
- No ML, no embeddings, no local scoring model — health score is a transparent weighted average of deterministic SQL.
- No multi-page BI dashboard — one panel per scope, 4 blocks, mobile-friendly.
- No bypass of opt-in/cooldown/budget — every CTA flows through the existing autonomy + growth guardrails.

### Success criteria

- Owner opens dashboard → sees one number (health) + ≤3 alerts + ≤3 opportunities + 1 NBA in <2s.
- NBA "Executar" creates a real `orkym_action_proposals` row via existing pipeline (no shortcut).
- Empty/new tenants get a graceful "Sem dados suficientes ainda" with neutral score, not zeros.
- RLS prevents cross-tenant reads (verified by RPC being `SECURITY INVOKER`).