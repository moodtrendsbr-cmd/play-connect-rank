

# Fase 9 — Autonomy Policies: SUGGEST → APPROVE → AUTO

Camada oficial de **políticas de autonomia** sobre a Fase 8. Decide o modo de execução (suggest/approve/auto) por tenant + arena + domain + action_type. Auto-execução só para ações low-risk reversíveis. Kill switch global. Zero IA local. Fallback sempre seguro = `approve`.

---

## 0. Auditoria — reuso

| Existe | Decisão |
|---|---|
| `orkym_action_proposals` (Fase 8) | Adicionar colunas `execution_mode`, `policy_id`, `policy_decision` |
| `orkym_ingest_actions` RPC | Estender para resolver policy ANTES de inserir, decidir mode, gravar decisão |
| `orkym-execute-action` edge | Reusar como executor — chamado também pelo dispatcher de auto-execução |
| `orkym_action_executions` | Trilha já cobre auto vs manual (campo `executed_by` + novo `triggered_by`) |
| `arena_operational_events` | Continua sendo trilha lateral |

**Não criar**: novo executor, novo motor de tasks, lógica inteligente local.

---

## 1. Migration `_phase9_autonomy_policies.sql`

### 1.1 Tabela `autonomy_policies`
```
id uuid PK,
scope_level text CHECK IN ('global','tenant','arena') NOT NULL,
tenant_id uuid,                              -- NULL quando scope=global
arena_id uuid,                               -- NULL quando scope=global|tenant
domain text,                                 -- NULL = aplica a todos os domains do escopo
action_type text,                            -- NULL = aplica a todos action_types do domain
execution_mode text CHECK IN ('suggest','approve','auto') NOT NULL DEFAULT 'approve',
risk_level text CHECK IN ('low','medium','high','critical') NOT NULL DEFAULT 'medium',
is_enabled boolean NOT NULL DEFAULT true,
conditions jsonb DEFAULT '{}',               -- max_amount, time_window, max_per_hour, etc
priority int NOT NULL DEFAULT 100,           -- menor = maior precedência (tie-breaker)
created_by uuid, updated_by uuid,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```
**Indexes**: `(tenant_id, arena_id, domain, action_type) WHERE is_enabled`, `(scope_level, priority)`.
**Constraints**: scope_level=`global` ⇒ tenant_id+arena_id NULL; `tenant` ⇒ tenant_id NOT NULL, arena_id NULL; `arena` ⇒ ambos NOT NULL.

### 1.2 Tabela `autonomy_kill_switches` (emergency stop)
```
id uuid PK,
scope_level text CHECK IN ('global','tenant','arena','domain','action_type') NOT NULL,
tenant_id uuid, arena_id uuid, domain text, action_type text,
is_active boolean DEFAULT true,
reason text NOT NULL,
activated_by uuid, activated_at timestamptz DEFAULT now(),
deactivated_by uuid, deactivated_at timestamptz
```
Quando match → força mode=`suggest` (registra apenas, não cria proposta executável).

### 1.3 Tabela `autonomy_policy_logs` (auditoria de decisões)
```
id uuid PK,
proposal_id uuid REFERENCES orkym_action_proposals,
tenant_id uuid, arena_id uuid,
domain text, action_type text,
resolved_mode text NOT NULL,                 -- suggest|approve|auto
policy_id uuid REFERENCES autonomy_policies, -- NULL se fallback
policy_source text NOT NULL,                 -- 'arena_specific'|'tenant_action'|'tenant_domain'|'global_default'|'fallback'|'kill_switch'|'guardrail_block'
guardrail_blocked text,                      -- NULL ou nome do guardrail que bloqueou auto
metadata jsonb DEFAULT '{}',
created_at timestamptz DEFAULT now()
```
INDEX `(tenant_id, created_at DESC)`, `(resolved_mode, created_at DESC)`.

### 1.4 ALTER `orkym_action_proposals`
```
ADD execution_mode text CHECK IN ('suggest','approve','auto') DEFAULT 'approve',
ADD policy_id uuid REFERENCES autonomy_policies,
ADD policy_source text,
ADD auto_executed boolean DEFAULT false,
ADD initial_status text                      -- p/ trilha: o status que entrou
```
Para retro-compat: defaults garantem que registros antigos viram `approve`.

### 1.5 RPCs

**`autonomy_resolve_policy(_tenant uuid, _arena uuid, _domain text, _action_type text, _risk text)`** RETURNS TABLE(execution_mode, policy_id, policy_source).
Precedência (primeira que casar e `is_enabled=true`):
1. Kill switch ativo aplicável → `suggest` + source `kill_switch`
2. `arena` + action_type específico
3. `arena` + domain (action_type NULL)
4. `tenant` + action_type específico
5. `tenant` + domain
6. `tenant` (catch-all, domain NULL action_type NULL)
7. `global` + action_type
8. `global` + domain
9. Hard-coded risk fallback: `low`→`approve`, `medium`→`approve`, `high`/`critical`→`approve` (nunca `auto` por fallback)
10. Última fallback: `approve` + source `fallback`

**Hardcoded risk map** (no resolver, não em tabela — evita alteração acidental):
```
low: create_followup, create_reminder, schedule_operational_review, open_communication_thread
medium: create_occurrence, flag_enrollment_attention, propose_manual_charge, recovery_campaign_draft
high: propose_promotion
critical: (futuro: refund, cancel_payment, change_split — bloqueados no ingest)
```

**`autonomy_check_guardrails(_tenant uuid, _arena uuid, _action_type text, _payload jsonb)`** RETURNS TABLE(allowed boolean, reason text).
Aplica defaults conservadores quando `execution_mode='auto'`:
- `high`/`critical` → block (force approve)
- `action_type` em blocklist hardcoded (refund/cancel/change_split/delete_*) → block
- max 10 auto-executions/hora por (tenant, action_type)
- max 30 auto-executions/hora por tenant total
- cooldown 60s entre auto-executions do mesmo action_type+entity_id
- `conditions.max_amount` na policy: se payload.amount > max → block
- `conditions.allowed_hours` ex `[8,22]`: fora da janela → block

Bloqueio NÃO falha — rebaixa para `approve` e loga `guardrail_blocked`.

**`autonomy_log_decision(_proposal_id, _resolved_mode, _policy_id, _source, _guardrail)`** SECURITY DEFINER.

### 1.6 RLS

`autonomy_policies`:
- SELECT: admin global, `is_tenant_admin(tenant_id)` (vê tenant + global), `is_arena_owner(arena_id)` (vê arena + tenant pai + global)
- INSERT/UPDATE/DELETE: admin global (qualquer); tenant_admin (scope tenant/arena dentro do seu tenant); arena_owner (somente scope=`arena` da sua arena, NUNCA pode setar mode=`auto` para risk≥`high`)

`autonomy_kill_switches`:
- SELECT mesmo padrão
- INSERT/UPDATE: admin global, tenant_admin (escopo do seu tenant)

`autonomy_policy_logs`: SELECT mesmo padrão; INSERT só via SECURITY DEFINER.

### 1.7 View `v_autonomy_metrics`
Agrega `autonomy_policy_logs` por dia/tenant/mode/action_type: total, by_mode, auto_executed_count, blocked_by_guardrail, blocked_by_kill_switch.

### 1.8 Seed defaults (no migration)
- 1 policy global por action_type da allowlist Phase 8 → mode `approve`, risk conforme map
- 0 kill switches ativos

---

## 2. Edge Function — extensão `orkym-invoke` / `orkym_ingest_actions`

Modificar RPC `orkym_ingest_actions` para que cada action recebida passe por:
```
1. Resolve risk_level (hardcoded por action_type)
2. Chama autonomy_resolve_policy → (mode, policy_id, source)
3. Se mode='auto': chama autonomy_check_guardrails. Se bloqueia → mode='approve', source='guardrail_block'
4. Determina initial_status:
   - mode='suggest'  → status='canceled' + grava só human_summary (não vira proposta executável); ainda assim insere em autonomy_policy_logs
   - mode='approve'  → status='proposed' (fluxo Phase 8 inalterado)
   - mode='auto'     → status='approved' + auto_executed=false (será marcado true após exec)
5. INSERT proposal com execution_mode, policy_id, policy_source, initial_status, status
6. INSERT autonomy_policy_logs
7. Se mode='auto': retorna lista de proposals para auto-execução pelo edge
```

Edge `orkym-invoke` ao receber `actions_proposed > 0`, lê propostas com `execution_mode='auto' AND auto_executed=false` desta call e dispara em paralelo `orkym-execute-action` (com service role + special header `X-Orkym-Auto: true` + setando `executed_by=NULL` para indicar sistema). Falhas registram em `orkym_action_executions` normalmente.

---

## 3. Edge `orkym-execute-action` — extensão mínima

- Aceita autenticação por **service role** quando vem do auto-dispatcher (header `X-Orkym-Auto: true` + valida `SERVICE_ROLE_KEY` no body assinado). Nesse caso `executed_by=NULL`.
- Validação extra: re-verifica `execution_mode` da proposal antes de executar (defesa em profundidade — se policy mudou entre ingest e exec, respeita o novo mode).
- Após exec bem-sucedida com `execution_mode='auto'`: UPDATE `auto_executed=true`.
- Se kill switch foi ativado entre proposed→execute para auto, aborta com status `canceled` + `failure_reason='kill_switch_activated'`.

---

## 4. Frontend `src/lib/autonomy.ts` (novo)

```typescript
export type ExecutionMode = "suggest" | "approve" | "auto";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AutonomyPolicy {
  id: string;
  scope_level: "global"|"tenant"|"arena";
  tenant_id: string | null;
  arena_id: string | null;
  domain: string | null;
  action_type: string | null;
  execution_mode: ExecutionMode;
  risk_level: RiskLevel;
  is_enabled: boolean;
  conditions: Record<string, unknown>;
  priority: number;
}

export async function listPolicies(filters): Promise<AutonomyPolicy[]>
export async function upsertPolicy(input: Partial<AutonomyPolicy>): Promise<{ ok, error? }>
export async function togglePolicy(id, enabled): Promise<{ ok }>
export async function deletePolicy(id): Promise<{ ok }>

export async function listKillSwitches(filters): Promise<KillSwitch[]>
export async function activateKillSwitch(input): Promise<{ ok }>
export async function deactivateKillSwitch(id): Promise<{ ok }>

export async function fetchPolicyLogs(filters): Promise<PolicyLog[]>
```

Estende `src/lib/orkym.ts` `OrkymActionProposal` com `execution_mode`, `policy_source`, `auto_executed`.

---

## 5. UI — 3 superfícies

### 5.1 `src/pages/admin/AdminAutonomy.tsx` (rota `/admin/autonomy`)
- Tab "Políticas": tabela de todas policies com filtro por scope/tenant/arena/domain. Botões: New, Edit, Toggle, Delete. Form modal com select de mode + risk + scope + conditions JSON simplificado (campos: max_amount, max_per_hour, allowed_hours).
- Tab "Kill Switches": ativos + histórico. Botão grande "Emergency Stop Global" → ativa kill_switch scope=global.
- Tab "Métricas": cards lendo `v_autonomy_metrics` (total auto-executadas 7d, bloqueadas por guardrail, by mode, top action_types).
- Tab "Logs": tabela `autonomy_policy_logs` com filtros, mostra source/mode/policy aplicada.

### 5.2 `src/pages/arena-dashboard/ArenaAutonomy.tsx` (rota `/arena/dashboard/autonomia`)
- Apenas policies scope=`arena` da arena atual + visão read-only das policies tenant/global aplicáveis.
- Arena owner pode criar/editar policies da própria arena, MAS:
  - Mode `auto` apenas para risk `low`
  - Botão claro: "Pause autonomy for this arena" → cria kill_switch scope=`arena`

### 5.3 Componente novo `PolicyDecisionBadge.tsx`
Usado em `OrkymActionsCard` e `ActionProposalDetail` (Fase 8): mostra como pill o `execution_mode` + tooltip com `policy_source` + link "Ver política aplicada". Para `auto_executed=true` mostra ícone ⚡ "Executada automaticamente".

### 5.4 Edits Fase 8
- `OrkymActionsCard.tsx`: filtra por padrão `status='proposed'` (Phase 8 OK), mas adiciona seção colapsada "Executadas automaticamente (24h)" com items `auto_executed=true`.
- `ArenaActions.tsx` / `AdminOrkymActions.tsx`: nova coluna "Mode" e filtro por `execution_mode`.
- `AdminLayout.tsx` / `ArenaLayout.tsx`: link "Autonomia" (icon `ShieldCheck`).
- `App.tsx`: 2 rotas novas.

---

## 6. Matriz de risco e modo permitido (hardcoded)

| action_type | risk | auto permitido? |
|---|---|---|
| create_followup | low | ✅ |
| create_reminder | low | ✅ |
| schedule_operational_review | low | ✅ |
| open_communication_thread | low | ✅ |
| create_occurrence | medium | ⚠️ apenas via policy explícita admin/tenant_admin |
| flag_enrollment_attention | medium | ⚠️ idem |
| recovery_campaign_draft | medium | ⚠️ idem |
| propose_manual_charge | medium | ❌ (sempre approve nesta fase — finance) |
| propose_promotion | high | ❌ (sempre approve) |
| refund/cancel/change_split/delete_* | critical | ❌ (bloqueado no ingest, não chega ao resolver) |

Validado em `autonomy_check_guardrails`. Tentativa de configurar `auto` para `high`/`critical` rejeitada na RPC de upsert da policy (exceto admin global, e ainda assim guardrails rebaixam em runtime).

---

## 7. Cron (reuso pg_cron Fase 7)

- Job existente `orkym_action_expire_stale` mantém-se
- Novo job 1×/dia: cleanup `autonomy_policy_logs` > 90 dias (DELETE)

---

## 8. Compatibilidade Fase 8

- Sem nenhuma policy criada → fallback retorna `approve` para tudo → comportamento **idêntico à Fase 8**
- Propostas antigas (sem `execution_mode`) → backfill no migration setando `execution_mode='approve'`, `policy_source='legacy'`
- `OrkymActionsCard` continua mostrando `status='proposed'` por default → auto-actions executadas não poluem a fila de aprovação
- Usuário arena-owner sem permissão para gerir policies → vê apenas badge de decisão, sem botões

---

## 9. Segurança

- RLS bloqueia leitura cross-tenant
- Apenas SECURITY DEFINER pode escrever em `autonomy_policy_logs`
- Arena owner NUNCA cria policies tenant/global; tentativa retorna `forbidden`
- Auto-dispatcher chama `orkym-execute-action` com header autenticado por service role — verify_jwt continua true mas há branch `X-Orkym-Auto` validado contra `SUPABASE_SERVICE_ROLE_KEY` em body
- Kill switch global é prioritário sobre TODAS as policies — checked first
- Conditions `max_amount` validadas no DB, não no client
- Allowlist e blocklist de action_types continuam hardcoded — policies só decidem o **mode** dentro da allowlist Fase 8

---

## 10. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase9_autonomy_policies.sql` |
| Edge | `supabase/functions/orkym-invoke/index.ts` (auto-dispatch loop), `supabase/functions/orkym-execute-action/index.ts` (auto branch + re-check policy) |
| Frontend lib | `src/lib/autonomy.ts` (novo), `src/lib/orkym.ts` (extender tipos) |
| Frontend novo | `src/pages/admin/AdminAutonomy.tsx`, `src/pages/arena-dashboard/ArenaAutonomy.tsx`, `src/components/autonomy/PolicyDecisionBadge.tsx`, `src/components/autonomy/PolicyFormDialog.tsx`, `src/components/autonomy/KillSwitchPanel.tsx` |
| Frontend edit | `src/pages/admin/AdminLayout.tsx`, `src/pages/arena-dashboard/ArenaLayout.tsx`, `src/pages/admin/AdminOrkymActions.tsx`, `src/pages/arena-dashboard/ArenaActions.tsx`, `src/components/orkym/OrkymActionsCard.tsx`, `src/components/orkym/ActionProposalDetail.tsx`, `src/App.tsx` |
| Memory | `mem/features/autonomy-policies.md` (novo), atualiza `mem/features/orkym-actions.md` |

**Total**: 1 migration + 2 edge functions estendidas + 1 lib nova + 5 componentes/páginas + 7 edits.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Precedência | kill_switch → arena+action → arena+domain → tenant+action → tenant+domain → tenant catch-all → global+action → global+domain → risk fallback (sempre `approve`) → fallback `approve` |
| Modos por risco | low: auto permitido / medium: auto só com policy explícita / high: sempre approve / critical: bloqueado upstream |
| Kill switch | scope global/tenant/arena/domain/action_type — checagem antes de tudo, força `suggest` |
| Guardrails | max 10/h por (tenant,action_type), max 30/h por tenant, cooldown 60s, max_amount, allowed_hours, blocklist hardcoded |
| Fallback | sem policy → `approve`. Policy inválida → `approve`. action_type fora allowlist → bloqueado no ingest (Phase 8) |
| Auditoria | `autonomy_policy_logs` por proposal + `auto_executed` flag + executions com `executed_by=NULL` para auto |
| UI | `/admin/autonomy` (full), `/arena/dashboard/autonomia` (escopo arena), badges em todos cards |

---

## ENTREGA C — Riscos / Próximos passos

**Continua obrigatoriamente approve nesta fase**:
- propose_manual_charge (finance)
- propose_promotion (growth, gasto real)
- todas medium sem policy explícita opt-in

**Poderia virar auto futuramente (Fase 10+)**:
- propose_manual_charge com confidence score da ORKYM > threshold
- propose_promotion com cap de budget pequeno

**Permanece crítico (nunca auto)**:
- refund, cancel_payment, change_split, qualquer ação destrutiva
- bloqueio de usuário, suspensão de tenant

**Próximos passos**:
- Score de confiança por action_type (ORKYM precisa enviar)
- Policies por plano (free/pro/elite) — campo `applicable_plans` em conditions
- Aprovação 2-níveis para high (futura — Fase 10)
- Webhook para alertar admin quando guardrail bloqueia auto N vezes em janela
- Dry-run mode: policy `auto` mas só registra "teria executado", não executa de fato

**Critérios de sucesso**:
- ✅ `autonomy_policies` + resolver + guardrails + kill switches operacionais
- ✅ Cada action ORKYM passa pelo resolver e grava decisão em `autonomy_policy_logs`
- ✅ Low-risk podem auto-executar quando policy permitir
- ✅ Fallback sem policy = `approve` (Fase 8 inalterada)
- ✅ Kill switch global desliga autonomy em 1 clique
- ✅ Painéis admin + arena com edit + métricas
- ✅ Badges mostram modo + fonte da decisão
- ✅ Zero IA local, zero auto crítico, zero quebra de Fase 8

