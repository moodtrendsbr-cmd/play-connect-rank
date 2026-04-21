

# Fase 8 — Controlled Autonomy: Auto-Actions com Aprovação

ORKYM passa a propor **ações executáveis**. MoodPlay apenas registra, exibe, aprova/rejeita, executa via fluxos existentes e audita. Zero IA local. Zero auto-execução irreversível. Modelo: **SUGERIR → APROVAR → EXECUTAR → AUDITAR**.

---

## 0. Auditoria — reuso

| Existe | Decisão |
|---|---|
| `orkym-invoke` (Fase 7) | Estender para também ingerir `actions[]` |
| `orkym_ingest_tasks` RPC | Adicionar irmã `orkym_ingest_actions` |
| `arena_operational_tasks` | Reusar como sink quando ação = `create_followup`/`create_reminder` |
| `arena_occurrences` | Reusar quando ação = `create_occurrence` |
| `arena_billing_cycles` (manual mark) | Reusar quando ação = `propose_manual_charge` (apenas cria cycle pending — nunca cobra) |
| `ad_campaigns` (status pending) | Reusar quando ação = `propose_promotion` |
| `arena_operational_events` | Trilha de execução |
| `orkym_api_calls` | Continua logando inbound; adicionar correlation com action |

**Não criar**: nova engine de tasks, novo motor de cobrança, novo sistema de eventos.

---

## 1. Migration `_phase8_orkym_action_proposals.sql`

### 1.1 Tabela `orkym_action_proposals` (única tabela do bloco)
```
id uuid PK,
tenant_id uuid NOT NULL,
arena_id uuid,                                  -- null para ações tenant-wide
domain text NOT NULL,                           -- arena_operations|finance|tournaments|growth
action_type text NOT NULL,                      -- whitelisted (ver §2)
title text NOT NULL,
description text,
priority text CHECK IN ('low','medium','high') DEFAULT 'medium',
status text CHECK IN (
  'proposed','approved','rejected','executing','executed','failed','expired','canceled'
) DEFAULT 'proposed',

related_entity_type text,
related_entity_id uuid,

proposed_payload jsonb DEFAULT '{}',           -- payload bruto da ORKYM (server-only)
human_summary jsonb DEFAULT '{}',              -- resumo seguro p/ exibir (sanitizado)

source text DEFAULT 'orkym',                   -- só 'orkym' nesta fase
orkym_request_id text,
correlation_id text,

approved_by uuid,                              -- profiles.user_id
approved_at timestamptz,
rejected_by uuid,
rejected_at timestamptz,
rejection_reason text,

executed_at timestamptz,
execution_result jsonb,                        -- ids gerados, refs, etc
failed_at timestamptz,
failure_reason text,

expires_at timestamptz DEFAULT (now() + interval '7 days'),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```
**Indexes**: `(tenant_id, status, created_at DESC)`, `(arena_id, status)`, `(orkym_request_id)`, partial `(status) WHERE status='proposed'`.

**Idempotência**: UNIQUE parcial em `(orkym_request_id, action_type, related_entity_id)` quando `orkym_request_id IS NOT NULL` — impede ORKYM duplicar a mesma proposta.

### 1.2 RLS
- SELECT: admin global, `is_tenant_admin(tenant_id)`, `is_arena_owner(arena_id)` (quando arena_id setado).
- INSERT: bloqueado para clients — só via SECURITY DEFINER `orkym_ingest_actions` (chamado pelo edge `orkym-invoke` com service role).
- UPDATE: bloqueado para clients — só via RPCs `orkym_action_approve` / `orkym_action_reject` / executor edge function.

### 1.3 Tabela `orkym_action_executions` (trilha append-only)
```
id uuid PK,
proposal_id uuid REFERENCES orkym_action_proposals,
attempt_number int DEFAULT 1,
status text CHECK IN ('started','succeeded','failed') NOT NULL,
result jsonb,
error_message text,
executed_by uuid,                              -- aprovador / sistema
duration_ms int,
created_at timestamptz DEFAULT now()
```
Append-only. SELECT mesmas regras que `orkym_action_proposals`. INSERT só via service role.

### 1.4 RPCs

**`orkym_ingest_actions(_payload jsonb)`** SECURITY DEFINER, service-role only.
Recebe `{ tenant_id, arena_id, request_id, correlation_id, actions: [...] }`. Para cada action:
- Valida `action_type` está no allowlist (§2)
- Sanitiza `proposed_payload` (remove keys com `_secret`, `password`, `cpf`, `email`, `phone`)
- Constroi `human_summary` = `{ title, description, related_entity_type, related_entity_id, priority }`
- INSERT com `ON CONFLICT (orkym_request_id, action_type, related_entity_id) DO NOTHING`
- Retorna count.

**`orkym_action_approve(_proposal_id uuid)`** SECURITY DEFINER.
Valida permissão (matriz §4). Valida estado = `proposed` e `expires_at > now()`. UPDATE para `approved` + `approved_by`/`approved_at`. Retorna proposal.

**`orkym_action_reject(_proposal_id uuid, _reason text)`** idem, status `rejected`.

**`orkym_action_mark_executing(_proposal_id uuid)`** SECURITY DEFINER, service role only. Estado: `approved → executing` (com check-and-set para evitar dupla execução).

**`orkym_action_mark_executed(_proposal_id uuid, _result jsonb)`** / **`orkym_action_mark_failed(_proposal_id uuid, _reason text)`** — idem, append em `orkym_action_executions`.

**`orkym_action_expire_stale()`** — cron: marca `proposed` com `expires_at < now()` como `expired`.

### 1.5 View `v_orkym_action_metrics`
Agrega por dia/domain/action_type: proposed, approved, rejected, executed, failed, avg_time_to_approval_ms, avg_execution_ms. SELECT admin + tenant_admin.

---

## 2. Allowlist de `action_type` (matriz controlada)

| action_type | Domain | Reuso | Reversível? | Risco |
|---|---|---|---|---|
| `create_followup` | arena_operations | INSERT em `arena_operational_tasks` (source=`orkym`) | sim | baixo |
| `create_reminder` | arena_operations | INSERT em `arena_operational_tasks` com due_at | sim | baixo |
| `create_occurrence` | arena_operations | INSERT em `arena_occurrences` (status=`open`) | sim | baixo |
| `propose_manual_charge` | finance | INSERT em `arena_billing_cycles` (status=`pending`, marca `metadata.proposed_by=orkym`). **Não cobra** | sim | médio |
| `flag_enrollment_attention` | arena_operations | UPDATE arena_class_enrollments.metadata.flagged_at + cria task | sim | baixo |
| `propose_promotion` | growth | INSERT em `ad_campaigns` (status=`pending`, aguarda admin) | sim | baixo |
| `schedule_operational_review` | arena_operations | INSERT task com priority=high + due_at futuro | sim | baixo |
| `open_communication_thread` | arena_operations | INSERT task com `task_type='outreach'` + metadata target | sim | baixo |
| `recovery_campaign_draft` | finance | INSERT task com checklist em metadata | sim | médio |

**Bloqueado (rejeita no ingest)**: refund, cancel_payment, change_split, delete_*, suspend_user, force_*, automatic_charge.

Implementação: array `ALLOWED_ACTION_TYPES` em `orkym_ingest_actions` + função `_handler_for(action_type)` no executor.

---

## 3. Edge Function `orkym-invoke` — extensão mínima

Após bloco "8. Ingest tasks":
```
8b. if Array.isArray(parsed.actions) && parsed.actions.length > 0:
      adminClient.rpc("orkym_ingest_actions", { _payload: { tenant_id, arena_id, request_id, correlation_id, actions } })
      → actions_proposed = count
```
Response inclui `actions_proposed`. Sanitização já tratada no RPC.

---

## 4. Edge Function nova `orkym-execute-action`

`verify_jwt = true`. Fluxo:

```
1. Auth + getClaims
2. Body: { proposal_id }
3. Carrega proposal via service role
4. Valida permissão (matriz):
   - arena_owner(proposal.arena_id) → ações arena_operations
   - tenant_admin(proposal.tenant_id) → todas exceto growth.propose_promotion (admin global)
   - admin global → todas
5. Valida status = 'approved' e expires_at > now() (CAS via mark_executing)
6. Despacha por action_type para handler interno (cada handler usa adminClient + RPCs/INSERTs já existentes)
7. handler retorna { ok, result }
8. mark_executed(result) ou mark_failed(reason)
9. Insere arena_operational_event 'orkym.action_executed' / 'orkym.action_failed'
10. Retorna { ok, status, result, request_id }
```

Handlers internos (puros, sem novas tabelas):
- `create_followup` / `create_reminder` / `schedule_operational_review` / `open_communication_thread` / `flag_enrollment_attention` / `recovery_campaign_draft` → INSERT `arena_operational_tasks`
- `create_occurrence` → INSERT `arena_occurrences`
- `propose_manual_charge` → INSERT `arena_billing_cycles` com status `pending`
- `propose_promotion` → INSERT `ad_campaigns` com status `pending`

**Idempotência runtime**: `mark_executing` faz `UPDATE WHERE status='approved' RETURNING` — se 0 rows, retorna `{ ok:false, error:'already_executing_or_invalid_state' }`.

**Modo degradado**: handler nunca chama ORKYM externa — só lê DB. Se ORKYM cair, aprovações continuam executando normalmente.

---

## 5. Frontend `src/lib/orkym.ts` — extensão de tipos

```typescript
export type OrkymActionType =
  | "create_followup" | "create_reminder" | "create_occurrence"
  | "propose_manual_charge" | "flag_enrollment_attention"
  | "propose_promotion" | "schedule_operational_review"
  | "open_communication_thread" | "recovery_campaign_draft";

export interface OrkymActionProposal {
  id: string;
  tenant_id: string;
  arena_id: string | null;
  domain: OrkymDomain;
  action_type: OrkymActionType;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "proposed"|"approved"|"rejected"|"executing"|"executed"|"failed"|"expired"|"canceled";
  related_entity_type: string | null;
  related_entity_id: string | null;
  human_summary: Record<string, unknown>;     // safe-to-render
  expires_at: string;
  created_at: string;
  approved_by?: string;
  executed_at?: string;
  failure_reason?: string;
}

export interface OrkymResponse {
  // ... campos existentes
  actions_proposed?: number;
}
```

Helpers novos:
- `listActionProposals(filters)` — query view-friendly
- `approveAction(id)` / `rejectAction(id, reason)` — chama RPC
- `executeAction(id)` — chama edge `orkym-execute-action`

---

## 6. Frontend — UI

### 6.1 Componente novo `OrkymActionsCard.tsx` (reusable)
Props: `tenantId`, `arenaId?`. Lista propostas `status='proposed'`. Cada item:
- Badge prioridade + domain
- Title + description curta (do `human_summary`)
- Entidade relacionada (link clicável quando aplicável)
- Botões "Aprovar" → modal confirmação → approveAction → executeAction (em sequência)
- Botão "Rejeitar" → input motivo → rejectAction
- Botão "Detalhes" → drawer mostrando `human_summary` formatado (nunca `proposed_payload` cru)

Status badge para items não-`proposed`: ✅ Executada / ❌ Rejeitada / ⏱ Expirada / ⚠ Falhou.

### 6.2 Página nova `src/pages/arena-dashboard/ArenaActions.tsx`
Rota: `/arena/:slug/actions`. Lista completa com tabs: Pendentes / Aprovadas / Executadas / Rejeitadas+Falhas. Filtro por domain/action_type/priority.
Adicionar à `ArenaLayout.tsx` sidebar: "Ações IA" com `Sparkles` icon.

### 6.3 Página nova `src/pages/admin/AdminOrkymActions.tsx`
Rota: `/admin/orkym-actions`. Visão global de todas propostas. Cards de métrica (total/approved/executed/failed/avg_time_to_approval) lendo `v_orkym_action_metrics`. Tabela com filtros por tenant/arena/domain.
Adicionar a `AdminLayout.tsx`.

### 6.4 Edits
- `ArenaDashboard.tsx`: adicionar `<OrkymActionsCard tenantId={...} arenaId={arena.id} />` abaixo de `<OrkymInsightsCard />`. Mostra max 3 propostas + link "Ver todas".
- `AdminOrkymMonitor.tsx` (Fase 7): adicionar tab "Ações" que linka para `/admin/orkym-actions`.
- `App.tsx`: 2 rotas novas.

---

## 7. Matriz de permissão (resumo)

| Role | Aprovar | Executar | Ver |
|---|---|---|---|
| arena_owner | ✅ ações com `arena_id` próprio | ✅ idem | ✅ idem |
| tenant_admin/owner | ✅ todas do tenant exceto `propose_promotion` | ✅ idem | ✅ todas do tenant |
| admin global | ✅ todas | ✅ todas | ✅ todas |
| atleta/empresa comum | ❌ | ❌ | ❌ |

Validação dupla: RLS no DB (RPC valida via `is_*`) + check no edge `orkym-execute-action`.

---

## 8. Cron (reuso de `pg_cron` da Fase 7)

Novo job 1×/dia: `SELECT public.orkym_action_expire_stale();`

---

## 9. Segurança

- `proposed_payload` nunca exposto no frontend — apenas `human_summary` (filtrado server-side no ingest).
- Sanitização no ingest remove PII conhecida.
- RLS bloqueia INSERT/UPDATE direto — tudo via RPC SECURITY DEFINER.
- Idempotência tripla: UNIQUE no DB + dedup ORKYM (Fase 7) + CAS em `mark_executing`.
- Allowlist hardcoded no RPC + handler dispatcher — `action_type` desconhecido rejeita silenciosamente com log.
- Auditoria completa em `orkym_action_executions` + eventos em `arena_operational_events`.

---

## 10. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase8_orkym_action_proposals.sql` |
| Edge functions | `supabase/functions/orkym-invoke/index.ts` (extensão actions[]), `supabase/functions/orkym-execute-action/index.ts` (novo) |
| Frontend lib | `src/lib/orkym.ts` (tipos+helpers) |
| Frontend novo | `src/components/orkym/OrkymActionsCard.tsx`, `src/components/orkym/ActionProposalDetail.tsx`, `src/pages/arena-dashboard/ArenaActions.tsx`, `src/pages/admin/AdminOrkymActions.tsx` |
| Frontend edit | `src/pages/arena-dashboard/ArenaDashboard.tsx`, `src/pages/arena-dashboard/ArenaLayout.tsx`, `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminOrkymMonitor.tsx`, `src/App.tsx` |
| Memory | `mem/integration/orkym.md` (atualizar contrato com `actions[]`), `mem/features/orkym-actions.md` (novo) |

**Total**: 1 migration + 1 edge function nova + 1 estendida + 4 telas + 5 edits.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Tipos de ação permitidos | 9 (create_followup, create_reminder, create_occurrence, propose_manual_charge, flag_enrollment_attention, propose_promotion, schedule_operational_review, open_communication_thread, recovery_campaign_draft) |
| Bloqueados | refund, cancel_payment, change_split, delete_*, suspend_user, automatic_charge |
| Workflow aprovação | proposed → approve/reject (RPC, validação por role) → execute (edge) → executed/failed |
| Auditoria | `orkym_action_proposals` (lifecycle) + `orkym_action_executions` (append-only) + eventos em `arena_operational_events` |
| Anti-dupla-execução | UNIQUE no ingest + CAS em mark_executing + status transitions explícitas |
| Reuso | tasks, occurrences, billing_cycles, ad_campaigns — zero estrutura paralela |
| Modo degradado | aprovação/execução independem da ORKYM upstream |

---

## ENTREGA C — Riscos / Próximos passos

**Pendente Fase 9+**:
- Auto-actions sem aprovação (autonomy policies por tipo + arena)
- Ações destrutivas (refund/cancel) com aprovação de 2 níveis
- Workflow de aprovação multi-step (ex: arena → tenant → admin)
- Streaming de execução longa (hoje síncrono no edge, ok p/ ações leves)
- Notificação push quando proposta criada (hoje só aparece no dashboard)
- Rollback automático de ação executada (hoje manual via UI das tasks/occurrences)
- Schema Zod compartilhado para `actions[]` ORKYM↔MoodPlay

**Compatibilidade**:
- Sem `actions[]` na resposta ORKYM → sistema funciona idêntico à Fase 7
- Tasks ORKYM existentes (Fase 7) seguem funcionando independentes
- Sem ORKYM secrets → nenhuma proposta criada, mas UI de actions vazia funciona

**Critérios de sucesso**:
- ✅ ORKYM consegue propor ações via response `actions[]`
- ✅ Propostas aparecem no dashboard arena + página dedicada
- ✅ Aprovar/rejeitar com validação de role
- ✅ Execução chama fluxos existentes (tasks/occurrences/billing/ads)
- ✅ Auditoria completa em proposals + executions + events
- ✅ Idempotência tripla impede dupla execução
- ✅ Allowlist hardcoded — ações destrutivas rejeitadas no ingest
- ✅ Modo degradado: aprovação/execução não dependem da ORKYM
- ✅ Zero IA local; toda decisão continua vindo da ORKYM

