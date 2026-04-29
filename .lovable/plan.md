## Autonomous Growth Engine (Phase G)

Costura fina sobre Phases 8/9/10/12.9/13. Zero IA local. Zero tabelas paralelas. ORKYM decide, MoodPlay detecta/executa/limita/registra.

### Mapeamento "spec → infra existente"

| Spec | Já existe | Adicionar agora |
|---|---|---|
| Modos suggest/approve/auto | `autonomy_policies` + `autonomy_resolve_policy` | reusar — só estender allowlist |
| Guardrails / kill-switch / cooldown / max_amount / allowed_hours | `autonomy_check_guardrails` | só estender condições com `max_daily_budget` |
| Tier / quota por plano | `orkym_get_tenant_tier` + `orkym_check_quota` | reusar |
| Detecção de oportunidades | `orkym_generate_periodic_triggers`, `orkym_generate_optimization_triggers` | + 4 detectores novos |
| ORKYM decide | `orkym-invoke` + `orkym-proactive-process` (proactive/decide) | + ação `growth/decide` |
| Execução | `orkym-execute-action` + `moodplay-execute-action` | + 6 novos action_types na allowlist |
| Outbound WA | `wa-send-message` (eligibility+cooldown) | reusar |
| Atribuição de receita / ROI / cap adaptativo | `orkym_revenue_attribution` + `orkym_roi_multiplier` | reusar |
| Feed monetização | `ad_campaigns` + `feed_unified_v` + `purchase_boost` | reusar |
| Budget control | — | **novo: `growth_budgets` + `growth_check_budget`** |
| Dashboard | `RevenueDashboardPanel`, `OrkymActionsCard`, `ProactiveTriggersPanel` | + `GrowthDashboardPanel` agregando |

### 1. Migration `phase_g_growth_engine.sql`

**Allowlist Phase 8 estendida** (em `autonomy_action_risk` + ingest):
- `tournament_boost` (high → bloqueado em auto por padrão; arena_owner pode aprovar)
- `send_proactive_message` (low — já passa por eligibility)
- `create_campaign` (high)
- `recommend_product` (low)
- `reactivation_message` (low)
- `fill_idle_slots` (medium)
- `upsell_plan` (medium)

**Tabela `growth_budgets`** (única tabela nova):
```
scope_type ('global'|'tenant'|'arena'|'company'|'campaign')
scope_id uuid null
period ('daily'|'weekly'|'monthly')
budget_brl numeric, spent_brl numeric default 0
boost_count_limit int null, boost_count_used int default 0
period_started_at timestamptz, active bool
UNIQUE(scope_type, scope_id, period)
```
RLS: admin tudo; tenant_admin tenant/arena/company do seu tenant; arena_owner sua arena; company owner sua company. Service role bypass.

**RPC `growth_check_budget(_scope_type, _scope_id, _amount_brl)`** SECURITY DEFINER:
- soma `spent_brl` do período corrente vs `budget_brl`
- aplica também budget pai (arena → tenant → global)
- retorna `{allowed, remaining_brl, blocked_by}`
- chamado pelo guardrail `autonomy_check_guardrails` quando action_type ∈ {tournament_boost, create_campaign, fill_idle_slots, upsell_plan} antes de permitir auto.

**RPC `growth_record_spend(_scope_type,_scope_id,_amount_brl,_campaign_id)`** SECURITY DEFINER:
- chamado pelo `trg_boost_activate_on_paid` para incrementar `spent_brl`/`boost_count_used`.

**Detectores novos em `orkym_generate_periodic_triggers`** (já roda no `orkym-cron-tick`):
- `tournament_low_enrollment` — torneios públicos start_date 3-7d, enrollment < 30% dos slots → enqueue (priority=high, dedup=`growth:low_enroll:<tournament_id>:<day>`)
- `idle_court_slot` — `arena_court_slots` sem booking nas próximas 48h em horário de pico (18-22h) → enqueue (medium)
- `inactive_athlete` — atleta sem booking/enrollment em 30d com opt-in → enqueue (low)
- `near_rank_up` — `athlete_xp` a < 100 XP do próximo nível → enqueue (low)
- `top_converting_product` — já existe via `marketplace_orders` trigger → reusar
- `low_campaign_conversion` — já existe via `orkym_generate_optimization_triggers` → reusar

**View `v_growth_dashboard`** (security_invoker):
agrega por tenant/arena/company:
- ações sugeridas/aprovadas/auto-executadas (last 30d)
- ações bloqueadas por guardrail (com source: budget|kill_switch|tier|cooldown|policy)
- receita atribuída (`orkym_revenue_attribution` filtrada)
- ROI por action_type (revenue / spent_brl)
- top trigger types por receita

### 2. Edge functions

**Estender `orkym-proactive-process`**: além de `proactive/decide`, claim batch também roteia triggers de growth para `orkym-invoke` action `growth/decide`. ORKYM responde:
```
{
  action_type: "tournament_boost"|"send_proactive_message"|...,
  confidence: 0..1,
  expected_impact_brl: number,
  recommended: bool,
  payload: {...},
  proposal_text?: string  // se for proactive_message
}
```
Se `recommended=false` → marca trigger `skipped`.
Se `recommended=true` → injeta em `orkym_ingest_actions` (Phase 8 pipeline). Policy resolver + tier + guardrail + budget decidem `suggest|approve|auto`. Se cair em `auto` e action for `send_proactive_message` → chama `wa-send-message` direto (já com eligibility/cooldown).

**Sem nova edge function** — reusa `orkym-invoke`, `orkym-execute-action`, `moodplay-execute-action`, `wa-send-message`, `orkym-cron-tick`, `orkym-proactive-process`.

**Novos handlers em `_shared/orkym-handlers.ts`** para os 6 action_types novos:
- `tournament_boost` → chama `purchase_boost` RPC com `_kind='tournament_boost'` + cria `financial_transactions` pendente (precisa pagamento — só executa se policy=`approve` com aprovador humano OU se houver budget pré-aprovado via `growth_budgets`)
- `create_campaign` → INSERT `ad_campaigns` (status='pending') — humano aprova
- `recommend_product` / `reactivation_message` → roteia para `wa-send-message` (passa por eligibility)
- `fill_idle_slots` → cria `ad_campaigns kind='company_boost'` (low) ou envia mensagem para alunos do bairro (passa por eligibility)
- `upsell_plan` → cria `arena_operational_tasks` para o owner (manual) OU mensagem (auto se eligibility passar)

### 3. Frontend

**Novo `src/components/growth/GrowthDashboardPanel.tsx`** consumindo `v_growth_dashboard`:
- 4 KPI cards: Sugeridas / Auto-executadas / Bloqueadas / Receita atribuída
- Tabela de últimas 20 ações com badge de policy source (reusa `PolicyDecisionBadge`)
- Gráfico ROI por action_type (recharts) — semanal últimos 30d
- Painel de budgets: barra de gasto vs limite por escopo

**Novo `src/components/growth/BudgetEditor.tsx`** (admin/tenant/arena/company):
- CRUD de `growth_budgets` por escopo permitido pelo RLS
- Form: período, budget_brl, boost_count_limit, active

**Mounts**:
- `src/pages/admin/AdminControlTower.tsx` → adiciona aba "Growth"
- `src/pages/arena-dashboard/ArenaDashboard.tsx` → bloco GrowthDashboardPanel scope=arena
- `src/pages/tenant/TenantDashboard.tsx` → scope=tenant
- `src/pages/company/CompanyDashboard.tsx` → scope=company
- `src/pages/admin/AdminMonetization.tsx` → BudgetEditor global
- Hook `src/hooks/useGrowthDashboard.ts` (scope-aware, reusa padrão de `useRevenueKpis`).

### 4. Memória
Criar `mem/features/autonomous-growth.md` documentando: detectores, action_types novos, budget guardrail, fluxo `growth/decide`, dashboards, hard limits.
Atualizar `mem://index.md` com entrada `[Autonomous Growth Engine](mem://features/autonomous-growth)` e linha de Core: "Phase G growth: detectors→ORKYM decide→Phase 8 ingest. Budget via `growth_budgets`+`growth_check_budget` no guardrail. Nunca criar IA local nem bypass de eligibility/cooldown/budget."

### 5. Testes obrigatórios (extension dos integration_test.ts existentes)

1. trigger `tournament_low_enrollment` enfileira corretamente (SQL)
2. ORKYM `recommended=false` marca skipped (mock orkym-invoke)
3. ação `tournament_boost` em auto sem budget → guardrail rebaixa para approve com `policy_source='budget_block'`
4. ação `send_proactive_message` em auto sem opt-in → eligibility bloqueia
5. ação executada com `financial_transactions paid` → `orkym_attribute_revenue` registra `attribution_type='proactive'` e `growth_record_spend` incrementa
6. kill_switch ativo → todas ações de growth caem para suggest
7. tier free → `create_campaign`/`tournament_boost` em auto rebaixados (tier_no_auto)

### Hard rules (não negociar)

- Eligibility, cooldown, opt-in **nunca** são bypassados — nem por enterprise tier.
- `tournament_boost`/`create_campaign`/`upsell_plan` em `auto` SEMPRE checam `growth_check_budget` antes; bloqueio rebaixa para `approve`.
- Toda ação financeira (`tournament_boost`) só executa após `financial_transactions.status='paid'` (já é o trigger atual `trg_boost_activate_on_paid`).
- Zero IA local: `orkym-invoke action='growth/decide'` é a ÚNICA origem da decisão.
- Outbound WA SOMENTE via `wa-send-message`.
- Sem novas edge functions; sem novas tabelas além de `growth_budgets`.

### Arquivos

**Novos**
- `supabase/migrations/<ts>_phase_g_growth_engine.sql`
- `src/components/growth/GrowthDashboardPanel.tsx`
- `src/components/growth/BudgetEditor.tsx`
- `src/hooks/useGrowthDashboard.ts`
- `mem/features/autonomous-growth.md`

**Editados**
- `supabase/functions/_shared/orkym-handlers.ts` (6 handlers novos)
- `supabase/functions/orkym-proactive-process/index.ts` (rota growth/decide)
- `supabase/functions/orkym-cron-tick/index.ts` (chama detectores novos via RPC já existente)
- `src/pages/admin/AdminControlTower.tsx`, `AdminMonetization.tsx`
- `src/pages/arena-dashboard/ArenaDashboard.tsx`
- `src/pages/tenant/TenantDashboard.tsx`
- `src/pages/company/CompanyDashboard.tsx`
- `src/lib/orkym.ts` (tipos `OrkymActionType` extendidos)
- `src/integrations/supabase/types.ts` (auto-gerado)
- `mem://index.md`

Aprova para implementar?