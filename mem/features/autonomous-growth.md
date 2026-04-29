---
name: Autonomous Growth Engine (Phase G)
description: Camada fina de detecção de oportunidades + budget guardrail + dashboard sobre Phases 8/9/10/12.9/13. Zero IA local.
type: feature
---

# Phase G — Autonomous Growth Engine

ORKYM decide. MoodPlay detecta, valida, executa, registra, limita.

## Action types novos (allowlist Phase 8 estendida)
- `tournament_boost` (high) · `create_campaign` (high) — auto bloqueado por risk_too_high; cai em approve
- `fill_idle_slots` (medium) · `upsell_plan` (medium) — auto checa budget
- `send_proactive_message` · `recommend_product` · `reactivation_message` (low) — auto via eligibility

## Tabela única `growth_budgets`
Escopos: global / tenant / arena / company / campaign. Períodos: daily/weekly/monthly. Campos: budget_brl, spent_brl, boost_count_limit, boost_count_used, active.
RLS: admin / tenant_admin (tenant+arena+company do tenant) / arena owner_user_id / company owner_user_id.

## Funções
- `growth_check_budget(scope_type, scope_id, amount)` — checa escopo + tenant pai + global. Retorna {allowed, reason, remaining}.
- `growth_record_spend(scope, id, amount, is_boost)` — service_role only; chamada por trigger.
- `autonomy_check_guardrails` estendido: para action_type ∈ {tournament_boost, create_campaign, fill_idle_slots, upsell_plan} chama `growth_check_budget`. Bloqueio rebaixa auto→approve com `policy_source='guardrail_block'`.
- `growth_generate_opportunity_triggers()` — service_role only; enfileira triggers em `orkym_triggers_queue`:
  - `tournament_low_enrollment` (start_date 3-7d, <30% slots) priority=high, dedup diário
  - `inactive_athlete` (opt-in + sem booking/enrollment 30d) priority=low, dedup semanal
  - `near_rank_up` (athlete_xp a <100 do próximo nível) priority=low, dedup semanal

## Trigger `trg_growth_record_boost_spend`
Em `financial_transactions` AFTER INSERT/UPDATE WHEN status='paid' AND source_type='boost' → resolve scope (tournament→arena/tenant, company, product→company) e chama `growth_record_spend`.

## Edge functions (sem novas)
- `orkym-cron-tick`: agora também chama `growth_generate_opportunity_triggers` em cada tick.
- `orkym-proactive-process`: triggers de growth (`tournament_low_enrollment`, `inactive_athlete`, `near_rank_up`, `idle_court_slot`, `low_message_performance`) mapeados em TRIGGER_TO_CATEGORY. Mesmo fluxo: eligibility → memory → orkym-invoke proactive/decide → wa-send-message.

## View `v_growth_dashboard`
security_invoker, agrega por (tenant, arena, action_type, execution_mode, policy_source): total/suggested/approve/auto/blocked/revenue 30d. Junta `orkym_revenue_attribution` por entity.

## Frontend
- `useGrowthDashboard(scope)` — agrega rows + budgets visíveis pelo RLS.
- `GrowthDashboardPanel` — KPIs (sugeridas/auto/bloqueadas/receita), ações por tipo, orçamentos com Progress.
- `BudgetEditor` — CRUD de growth_budgets por escopo permitido.
- Mounts: TenantDashboard, CompanyDashboard, AdminControlTower (+BudgetEditor global).

## Hard rules
- Eligibility/cooldown/opt-in NUNCA bypassados (nem por enterprise tier).
- Budget check obrigatório antes de auto em ações pagas (tournament_boost/create_campaign/fill_idle_slots/upsell_plan).
- Toda execução paga só ativa após `financial_transactions.status='paid'` (trigger `trg_boost_activate_on_paid` + `trg_growth_record_boost_spend`).
- Zero IA local: decisão sempre via `orkym-invoke proactive/decide`.
- Outbound WA SOMENTE via `wa-send-message`.
- Sem novas edge functions; única tabela nova é `growth_budgets`.
