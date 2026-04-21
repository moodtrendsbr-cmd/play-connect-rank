

# Fase 10 — AI Control Tower: Monetização da Autonomia

Transformar autonomia ORKYM em produto vendável. Tier de autonomia por plano + limites de uso + gating em runtime + dashboard de valor. **Zero IA local.** Reuso total da Fase 9 (resolver, guardrails, kill switch). Limites violados rebaixam modo (`auto→approve→suggest`), nunca quebram fluxo.

---

## 0. Auditoria — reuso

| Existe | Decisão |
|---|---|
| `company_plans` (free/pro/elite, `monthly_price`, flags) | Estender com `autonomy_tier` + 4 colunas de limite |
| `subscriptions` (company↔plan) | Resolver tenant→plan via owner company subscription |
| `tenant_settings.metadata` jsonb | Override opcional de tier (admin pode forçar Enterprise para tenant especial) |
| `autonomy_resolve_policy` (Fase 9) | Estender: aplica gating de tier antes de retornar mode |
| `autonomy_check_guardrails` | Adicionar checagem de quota mensal — rebaixa para `approve` |
| `orkym_ingest_actions` | Já chama resolver+guardrails — ganha gating sem mudar contrato |
| `v_autonomy_metrics` / `v_orkym_metrics` | Reusados; nova view `v_orkym_usage` agrega por mês |
| `OrkymInsightsCard` / `OrkymActionsCard` | Reusados na Control Tower |

**Não criar**: novo motor de billing, novo sistema de planos, lógica inteligente local. Pay-per-use fica fora — só prepara base.

---

## 1. Migration `_phase10_autonomy_monetization.sql`

### 1.1 ALTER `company_plans`
```
ADD autonomy_tier text CHECK IN ('free','growth','pro','business','enterprise') DEFAULT 'free',
ADD orkym_calls_limit int DEFAULT 0,            -- chamadas ORKYM/mês (0 = none)
ADD orkym_suggestions_limit int DEFAULT 0,      -- sugestões/mês
ADD orkym_auto_actions_limit int DEFAULT 0,     -- auto-execuções/mês
ADD orkym_allowed_domains text[] DEFAULT ARRAY[]::text[]  -- ex: ['arena_operations']
```
Backfill dos 3 planos existentes:
- `free` → tier=`free`, calls=20, suggestions=10, auto=0, domains=`['arena_operations']`
- `pro` → tier=`pro`, calls=500, suggestions=200, auto=50, domains=`['arena_operations','growth']`
- `elite` → tier=`business`, calls=5000, suggestions=2000, auto=1000, domains=`['arena_operations','growth','finance','tournaments']`

(Tier `growth` e `enterprise` ficam disponíveis para admin criar planos novos.)

### 1.2 Tabela `orkym_usage` (tracking mensal)
```
id uuid PK,
tenant_id uuid NOT NULL REFERENCES tenants,
period_month date NOT NULL,                     -- sempre dia 1 do mês
total_calls int DEFAULT 0,
total_suggestions int DEFAULT 0,
total_actions_proposed int DEFAULT 0,
total_auto_executed int DEFAULT 0,
total_approved int DEFAULT 0,
total_rejected int DEFAULT 0,
total_blocked_by_quota int DEFAULT 0,           -- novo: quantas vezes rebaixou por limite
estimated_time_saved_minutes int DEFAULT 0,    -- 5min por auto, 2min por suggestion (heurística simples)
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now(),
UNIQUE (tenant_id, period_month)
```
INDEX `(period_month DESC, tenant_id)`.
RLS: SELECT admin global + tenant_admin + arena_owner (vê do tenant pai). INSERT/UPDATE só via SECURITY DEFINER.

### 1.3 RPCs

**`orkym_get_tenant_tier(_tenant uuid)` STABLE SECURITY DEFINER** RETURNS TABLE(tier, plan_id, calls_limit, suggestions_limit, auto_limit, allowed_domains, source).
Resolução:
1. `tenant_settings.metadata->>'autonomy_tier_override'` (admin force) → source=`override`
2. Subscription ativa do owner do tenant → join `subscriptions`+`companies`+`company_plans` → source=`subscription`
3. Fallback: tier=`free`, limites do plano `free` → source=`fallback`

**`orkym_increment_usage(_tenant uuid, _calls int, _suggestions int, _proposed int, _auto int, _approved int, _rejected int, _blocked int, _time_saved int)` SECURITY DEFINER**.
UPSERT em `orkym_usage` (tenant + período mês atual). Append-only por delta. Chamado pelo edge `orkym-invoke` e pelo `orkym_ingest_actions`.

**`orkym_check_quota(_tenant uuid, _kind text)` STABLE SECURITY DEFINER** RETURNS TABLE(allowed boolean, current int, limit_value int, tier text, reason text).
`_kind` ∈ `'calls'|'suggestions'|'auto_actions'`. Lê tier+usage do mês corrente. Retorna `allowed=false` se atingiu limite. Sempre retorna mesmo se NULL (defensivo).

**`orkym_check_domain_allowed(_tenant uuid, _domain text)` STABLE** RETURNS boolean.
Verifica se domain está em `allowed_domains` do tier. Domain `arena_operations` sempre permitido (default).

### 1.4 Estender `autonomy_resolve_policy` — gating de tier
Após resolver mode atual (Fase 9), antes de retornar:
```
1. Carrega tier do tenant via orkym_get_tenant_tier
2. Se domain NÃO em allowed_domains → force mode='suggest', source='tier_domain_block'
3. Se mode='auto' E tier NÃO permite auto-actions (free/growth) → mode='approve', source='tier_no_auto'
4. Se mode='auto' E orkym_check_quota('auto_actions').allowed=false → mode='approve', source='quota_auto'
5. Se mode='approve' E orkym_check_quota('suggestions').allowed=false → mode='suggest', source='quota_suggestions'
6. Retorna
```
Tier→auto map (hardcoded):
- `free`/`growth`: auto = NUNCA
- `pro`: auto = só `low` risk
- `business`: auto = `low` + `medium`
- `enterprise`: auto = `low` + `medium` + `high` (ainda passa por guardrails)

### 1.5 View `v_orkym_usage_summary`
Agrega por tenant: tier atual, uso do mês corrente, limite, % consumido, projeção fim do mês (linear baseado em dias passados), última atividade. SELECT admin + tenant_admin + arena_owner.

### 1.6 Cron (novo job)
- Job mensal dia 1 às 00:05: nada (UPSERT cria registro on-demand). Job opcional: snapshot de fechamento do mês anterior (apenas marca read-only via `metadata.closed=true`).

---

## 2. Edge `orkym-invoke` — extensões mínimas

Antes do flow ORKYM real:
```
1. orkym_check_quota(tenant, 'calls')
2. Se allowed=false: retorna 200 com { degraded:true, reason:'quota_exceeded', tier, limit, current }
   — NÃO chama ORKYM, NÃO falha. Loga em orkym_api_calls com status='quota_blocked'
3. Senão: prossegue normalmente
```
Após sucesso: `orkym_increment_usage(calls=1, suggestions=N, proposed=M, ...)` baseado na resposta.
`orkym_ingest_actions` já chama o resolver estendido (passo 1.4) — gating automático.

**Time saved** (heurística): `auto_executed * 5 + suggestions * 2` minutos. Calculado no increment.

## 3. Edge `orkym-execute-action` — gating final

Antes de `mark_executing`:
```
1. Re-verifica execution_mode da proposal (Fase 9 já faz)
2. Se mode='auto' E auto_executed=false: orkym_check_quota('auto_actions')
3. Se quota estourou: marca proposal status='canceled' + failure_reason='quota_exhausted_runtime'. Retorna 200.
```
Defesa em profundidade — quota pode mudar entre ingest e execute.

---

## 4. Frontend `src/lib/autonomyTier.ts` (novo)

```typescript
export type AutonomyTier = "free"|"growth"|"pro"|"business"|"enterprise";

export interface TenantTier {
  tier: AutonomyTier;
  plan_id: string | null;
  calls_limit: number;
  suggestions_limit: number;
  auto_limit: number;
  allowed_domains: string[];
  source: "override"|"subscription"|"fallback";
}

export interface UsageSummary {
  tenant_id: string;
  tier: AutonomyTier;
  period_month: string;
  total_calls: number;
  total_suggestions: number;
  total_auto_executed: number;
  total_approved: number;
  total_rejected: number;
  total_blocked_by_quota: number;
  estimated_time_saved_minutes: number;
  calls_limit: number;
  suggestions_limit: number;
  auto_limit: number;
  pct_calls: number;        // 0-100, capped
  pct_suggestions: number;
  pct_auto: number;
  projected_calls_eom: number;  // linear projection
}

export async function fetchTenantTier(tenantId: string): Promise<TenantTier|null>
export async function fetchUsageSummary(tenantId: string): Promise<UsageSummary|null>
export async function fetchUsageHistory(tenantId: string, months: number): Promise<UsageSummary[]>

export const TIER_LABELS: Record<AutonomyTier, string> = { ... }
export const TIER_FEATURES: Record<AutonomyTier, { autoRiskLevels: string[]; description: string }> = { ... }
```

Estende `src/lib/autonomy.ts` `policySourceLabel` com: `tier_domain_block`, `tier_no_auto`, `quota_auto`, `quota_suggestions`.

---

## 5. UI — AI Control Tower

### 5.1 Página nova `src/pages/arena-dashboard/ArenaControlTower.tsx`
Rota: `/arena/dashboard/control-tower`. Layout:
- **Header**: Tier atual (badge grande) + plano vinculado + botão "Upgrade" se < business
- **Cards de uso (3)**: Calls/Suggestions/Auto-actions — barra de progresso com `usado / limite` + projeção fim do mês
- **Card "Valor gerado"**: tempo economizado (formato "X horas Y min este mês"), # auto-executadas, # aprovadas
- **Tabela "Últimas auto-actions"**: reusa `OrkymActionsCard` filtrado por `auto_executed=true`, max 10
- **Alerta**: se `pct >= 80` → banner amarelo "Você está perto do limite". Se `>= 100` → banner vermelho "Limite atingido. Ações rebaixadas para aprovação manual"
- **CTA Upgrade**: card destacado mostrando próximo tier + ganhos (mais auto/mês, mais domains)

Adicionar à `ArenaLayout.tsx` sidebar: "Control Tower" (icon `Gauge`).

### 5.2 Página nova `src/pages/admin/AdminControlTower.tsx`
Rota: `/admin/control-tower`. Visão global:
- **Métricas top**: total auto-executadas (todos tenants, 30d) / receita potencial estimada (sum tier monthly_price × tenants ativos) / tempo economizado total
- **Tabela "Top tenants por adoção"**: tenant, tier, uso/limite, auto-executadas, % adoção
- **Tabela "Próximos do limite"**: tenants com `pct >= 80` em qualquer dimensão → oportunidade de upsell
- **Gráfico**: distribuição de tenants por tier (pizza simples)

Adicionar à `AdminLayout.tsx` sidebar: "Control Tower" (icon `Gauge`).

### 5.3 Componente `src/components/autonomy/UsageMeter.tsx`
Props: `label`, `used`, `limit`, `projected?`. Renderiza barra com cores: verde <50%, amarelo 50-80%, vermelho >80%, cinza se limit=0. Tooltip com projeção.

### 5.4 Componente `src/components/autonomy/UpgradeCTA.tsx`
Props: `currentTier`, `reason?`. Card chamativo com next tier + ganhos. Link para `/marketplace/register` ou modal "Fale conosco" (sem cobrança automática nesta fase).

### 5.5 Edits Fase 9
- `OrkymActionsCard.tsx`: quando proposta tem `policy_source='quota_auto'` ou `'tier_no_auto'`, mostra badge sutil "Rebaixada por plano" + tooltip
- `PolicyDecisionBadge.tsx`: já recebe `source` — adicionar mapping para os novos sources de tier/quota
- `ArenaActions.tsx` / `AdminOrkymActions.tsx`: adicionar filtro "Origem: Tier/Quota"

### 5.6 Edits AdminPlans
- `AdminPlans.tsx`: adicionar 4 inputs (autonomy_tier select, calls/suggestions/auto limits) + multi-select de allowed_domains. Salva direto em `company_plans`.

---

## 6. Matriz de gating (resumo executável)

| Tier | Calls/mês | Suggestions/mês | Auto/mês | Domains | Auto risk |
|---|---|---|---|---|---|
| free | 20 | 10 | 0 | arena_operations | — |
| growth | 100 | 50 | 0 | arena_operations | — |
| pro | 500 | 200 | 50 | arena_operations, growth | low |
| business | 5000 | 2000 | 1000 | + finance, tournaments | low + medium |
| enterprise | unlimited (-1) | unlimited | unlimited | all | low + medium + high |

`-1` em qualquer limit = ilimitado. `orkym_check_quota` retorna sempre `allowed=true` se limit=-1.

---

## 7. Fallback / Compatibilidade

- Sem subscription → tier=`free` → comportamento ultra-conservador, sem auto
- Tier não reconhecido → fallback `free`
- `orkym_get_tenant_tier` falha → resolver continua com mode original (defensivo, loga em `autonomy_policy_logs.metadata`)
- Limite estourou → rebaixa modo, nunca falha. Increment `total_blocked_by_quota`
- Sem `orkym_usage` row do mês → tratado como zero, UPSERT cria
- Fase 9 sem nada quebrado: se nenhuma policy + nenhum tier = comportamento idêntico (tudo `approve`)

---

## 8. Segurança (não negociável)

- Kill switch tem prioridade sobre tier (Fase 9 inalterada)
- Guardrails (rate limit, blocklist hardcoded) checados ANTES de quota
- Tier `enterprise` NÃO desativa guardrails — só permite mais risk levels
- Refund/cancel/change_split continuam bloqueados no ingest (allowlist)
- RLS: tenant_admin só vê próprio tier+usage; admin global vê tudo
- `orkym_get_tenant_tier` é SECURITY DEFINER — não vaza dados de subscription cross-tenant
- Override admin via `tenant_settings.metadata` requer `is_admin(auth.uid())` (já protegido por RLS de tenant_settings)

---

## 9. Pay-per-use (preparação, NÃO implementado)

- `orkym_usage.metadata` jsonb adicionado para futuro custo por call
- View `v_orkym_usage_summary` já expõe contadores
- Sem cobrança real, sem integração Stripe, sem invoice

---

## 10. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase10_autonomy_monetization.sql` |
| Edge | `supabase/functions/orkym-invoke/index.ts` (quota gate + increment), `supabase/functions/orkym-execute-action/index.ts` (re-check quota auto) |
| Frontend lib | `src/lib/autonomyTier.ts` (novo), `src/lib/autonomy.ts` (extender labels) |
| Frontend novo | `src/pages/arena-dashboard/ArenaControlTower.tsx`, `src/pages/admin/AdminControlTower.tsx`, `src/components/autonomy/UsageMeter.tsx`, `src/components/autonomy/UpgradeCTA.tsx` |
| Frontend edit | `src/App.tsx`, `src/pages/arena-dashboard/ArenaLayout.tsx`, `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminPlans.tsx`, `src/components/orkym/OrkymActionsCard.tsx`, `src/components/autonomy/PolicyDecisionBadge.tsx`, `src/pages/arena-dashboard/ArenaActions.tsx`, `src/pages/admin/AdminOrkymActions.tsx` |
| Memory | `mem/features/autonomy-monetization.md` (novo) |

**Total**: 1 migration + 2 edges estendidas + 1 lib nova + 4 componentes/páginas + 8 edits.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Gating | resolver Fase 9 ganha 4 checagens extras (domain allowed, tier permite auto, quota auto, quota suggestions). Edge invoke gate de calls antes de chamar ORKYM |
| Limites por plano | free 20/10/0, pro 500/200/50, business 5000/2000/1000, enterprise ilimitado. Configurável em AdminPlans |
| Fallback | nunca falha — rebaixa: auto→approve→suggest. Loga em `policy_source` e incrementa `total_blocked_by_quota` |
| Tracking | `orkym_usage` UPSERT mensal por tenant. View `v_orkym_usage_summary` com % e projeção |
| UX | `/arena/dashboard/control-tower` (tenant) + `/admin/control-tower` (global). Badges em todas action cards |
| Compat | Sem subscription = free tier. Sem policies = approve. Fase 9 inalterada. |
| Segurança | Kill switch + guardrails > tier. Tier nunca desativa segurança. Refund/cancel continuam blocados. |

---

## ENTREGA C — Riscos / Próximos passos

**Limitações desta fase**:
- Tier resolvido via subscription do owner — tenants sem owner→company subscription caem em `free`
- Tempo economizado é heurística simples (5min/auto, 2min/sugg) — não medido real
- Sem cobrança automática quando upgrade — CTA leva a "Fale conosco"

**Próximos passos (Fase 11+)**:
- Pay-per-use real: cobrar por call extra acima do limite via Stripe
- Score de qualidade ORKYM por tenant (ROI medido)
- Tier `enterprise` com SLA contratual + dashboard admin de SLA
- Auto-upgrade temporário com cobrança proporcional
- Webhook quando atinge 80%/100% limite (email/notif)
- Métricas de impacto financeiro real (ações que geraram receita)

**Permanece crítico (não muda)**:
- Refund/cancel/change_split — bloqueados independente de tier
- Guardrails de rate-limit e cooldown — ativos em todos tiers
- Kill switch global — soberano

**Critérios de sucesso**:
- ✅ Tier resolvido por plano (free/pro/business)
- ✅ Quota mensal em calls + suggestions + auto-actions
- ✅ Domain gating (finance só em business+)
- ✅ Auto risk gating (medium só em business+, high só enterprise)
- ✅ Fallback rebaixa modo, nunca quebra
- ✅ Control Tower mostra uso/projeção/valor
- ✅ Admin pode editar limites por plano
- ✅ Zero IA local, kill switch + guardrails preservados, Fase 9 inalterada

