

# Fase 4 — ORKYM Operational Layer + Recurring Operations + Occurrences

Extensão limpa sobre Fase 3. Zero inteligência local. Zero duplicação. Tudo respeita `tenant_id` + `arena_id` + RLS pattern já consolidado.

---

## 1. Auditoria — reuso obrigatório

| Existente | Reuso Fase 4 |
|---|---|
| `arena_students`, `arena_classes`, `arena_class_enrollments`, `arena_attendance` | Origem de eventos e alvo de planos/assinaturas |
| `payment_accounts` (Fase 1) | Referenciada por `arena_student_subscriptions.payment_account_id` |
| `arenas`, `courts`, `bookings` | Referenciados por ocorrências (related_entity_*) |
| `is_arena_owner`, `is_tenant_admin`, `is_admin`, `set_arena_child_tenant_default` | Reusados em todas as policies/triggers — zero função nova de utilidade |
| `orkym-invoke` + `src/lib/orkym.ts` | Único canal para qualquer "inteligência" futura. Esta fase só registra dados e expõe inbox. |
| `ArenaLayout` nav + `ArenaDashboard` | Estendidos com 3 abas + 1 seção, sem reescrever |

**Não criar:** sistema próprio de pagamentos, motor de regras, scheduler local, scoring, priorização automática.

---

## 2. Modelo de dados — 6 tabelas novas

Padrão fixo: `id uuid PK`, `tenant_id NOT NULL`, `arena_id NOT NULL`, `created_at`, `updated_at`. Triggers `set_arena_child_tenant_default` em todas.

### BLOCO A — ORKYM hooks

| Tabela | Campos | Função |
|---|---|---|
| **arena_operational_events** | `entity_type text, entity_id uuid, event_type text, payload jsonb, source text default 'system', processed_at timestamptz` | Trilha bruta de eventos operacionais (aluno faltou, aula lotada, cobrança vencida, check-in, etc). Append-only. ORKYM lê daqui. |
| **arena_operational_tasks** | `related_entity_type text, related_entity_id uuid, task_type text, title text, description text, priority smallint default 2, status text default 'open' (open/dismissed/done), source text default 'manual' (manual/orkym/system), due_at timestamptz, resolved_at timestamptz, resolved_by uuid` | Inbox de pendências/sugestões. ORKYM grava aqui via `orkym-invoke`. Arena owner consome. |

### BLOCO B — Recorrência/Billing

| Tabela | Campos | Função |
|---|---|---|
| **arena_membership_plans** | `name, description, billing_frequency text (monthly/quarterly/yearly/one_time), amount numeric(10,2), currency text default 'BRL', features jsonb, is_active bool default true` | Catálogo de planos da arena. |
| **arena_student_subscriptions** | `student_id uuid FK, plan_id uuid FK, payment_account_id uuid FK nullable, status text (active/paused/canceled/past_due), started_at, current_period_start, current_period_end, next_due_at, canceled_at, metadata jsonb` | Vínculo aluno↔plano com ciclo. |
| **arena_billing_cycles** | `subscription_id uuid FK, period_start, period_end, amount numeric, due_at, paid_at, status text (pending/paid/overdue/canceled), payment_reference text, payment_method text` | Linha por ciclo (mês). Geração manual nesta fase + RPC auxiliar. |

### BLOCO C — Ocorrências

| Tabela | Campos | Função |
|---|---|---|
| **arena_occurrences** | `related_entity_type text, related_entity_id uuid, title, description, category text (court/class/instructor/booking/student/event/other), severity text (low/medium/high/critical), status text (open/in_progress/resolved/closed), reported_by uuid, assigned_to uuid nullable, resolved_at, resolution_notes` | Registro de incidentes/manutenção/conflitos. |

**Indexes essenciais:** `(arena_id, status, created_at DESC)` em events/tasks/occurrences; `(subscription_id, due_at)` em billing_cycles; `(arena_id, next_due_at)` em subscriptions.

---

## 3. RLS — padrão único replicável

Para todas as 6 tabelas:

```sql
-- SELECT/ALL: arena owner + tenant admin + admin
CREATE POLICY "arena_op_view" ON <tabela> FOR SELECT
  USING (is_arena_owner(arena_id, auth.uid())
         OR is_tenant_admin(tenant_id, auth.uid())
         OR is_admin(auth.uid()));
CREATE POLICY "arena_op_manage" ON <tabela> FOR ALL
  USING (is_arena_owner(arena_id, auth.uid())
         OR is_tenant_admin(tenant_id, auth.uid())
         OR is_admin(auth.uid()));
```

**Exceção `arena_student_subscriptions` + `arena_billing_cycles`:** o aluno (via `profile_user_id` em `arena_students`) pode ler **só sua própria** assinatura/ciclos via JOIN. Sem UPDATE/DELETE pelo aluno.

**Exceção `arena_operational_events`:** INSERT permitido também via `service_role` (edge functions/triggers internos). Sem leitura pública.

---

## 4. RPCs auxiliares (3 funções, sem inteligência)

```sql
-- Gera o próximo ciclo de cobrança a partir da subscription
CREATE FUNCTION arena_generate_billing_cycle(_subscription_id uuid) RETURNS uuid
  -- valida owner/admin, calcula period_start/end + due_at conforme billing_frequency,
  -- INSERT arena_billing_cycles, UPDATE next_due_at na subscription.

-- Marca ciclo como pago manualmente
CREATE FUNCTION arena_mark_cycle_paid(_cycle_id uuid, _payment_method text, _payment_reference text) RETURNS void

-- Marca ciclos vencidos como overdue (chamada pelo frontend on-demand ou cron futuro)
CREATE FUNCTION arena_mark_overdue_cycles(_arena_id uuid) RETURNS integer
```

Todas `SECURITY DEFINER` + `SET search_path = public` + checagem de owner/admin no início. Zero lógica preditiva.

**Trigger leve** em `arena_billing_cycles`: ao mudar status para `overdue` ou `paid`, INSERT em `arena_operational_events` (`event_type='billing.overdue'` / `'billing.paid'`). Zero decisão — só registro.

**Trigger leve** em `arena_attendance`: ao INSERT com `status='absent'`, INSERT em `arena_operational_events` (`event_type='attendance.absent'`). ORKYM decide depois se vira tarefa.

---

## 5. Frontend — 4 telas novas + 1 extensão dashboard

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/arena/dashboard/planos` | `ArenaPlans.tsx` | Lista/cria/edita `arena_membership_plans`. Form: nome, valor, frequência, descrição. |
| `/arena/dashboard/assinaturas` | `ArenaSubscriptions.tsx` | Lista assinaturas (aluno, plano, status, próximo vencimento). Ações: pausar/cancelar/gerar próximo ciclo. Criar nova vinculando student↔plan. |
| `/arena/dashboard/cobrancas` | `ArenaBilling.tsx` | Lista de `arena_billing_cycles` (filtros: status, mês). Ação: marcar como pago manualmente. Botão "Atualizar vencidos" → chama `arena_mark_overdue_cycles`. |
| `/arena/dashboard/ocorrencias` | `ArenaOccurrences.tsx` | Lista + filtros (categoria/severity/status). Modal: abrir/editar ocorrência. Mudança de status inline. |

**Extensão `ArenaLayout.tsx`:** adicionar 4 itens ao `navItems` (Planos, Assinaturas, Cobranças, Ocorrências) + ícones lucide (`Tag`, `RefreshCw`, `Receipt`, `AlertTriangle`).

**Extensão `ArenaDashboard.tsx`:** nova seção **"Operação"** acima dos atalhos:
- Card "Vencimentos próximos (7 dias)" — count de `arena_billing_cycles WHERE due_at <= now()+7d AND status='pending'`
- Card "Cobranças vencidas" — count `status='overdue'`
- Card "Ocorrências abertas" — count `arena_occurrences WHERE status IN ('open','in_progress')`
- Card "Pendências (tasks)" — count `arena_operational_tasks WHERE status='open'`
- Lista das 5 tarefas mais recentes (`arena_operational_tasks` open) com badge de `source` (orkym/manual/system) + ações dismiss/done

UI minimal, segue o design system existente. Sem redesign.

---

## 6. Rotas em `App.tsx`

Adicionar 4 rotas dentro de `<Route path="arena/dashboard" element={<ArenaLayout />}>`:
- `planos` → `<ArenaPlans />`
- `assinaturas` → `<ArenaSubscriptions />`
- `cobrancas` → `<ArenaBilling />`
- `ocorrencias` → `<ArenaOccurrences />`

---

## 7. Hook ORKYM (canal, não cérebro)

`src/lib/orkym.ts` já existe (Fase 1). Esta fase **não chama** ORKYM — apenas garante que os dados (events + inbox) estão prontos para ela ler/gravar via `orkym-invoke` futuramente.

Documentar em `mem://features/arena-management` (atualizar): tabelas que ORKYM lê (`arena_operational_events`, `arena_attendance`, `arena_billing_cycles`, `arena_class_enrollments`) e onde ela grava (`arena_operational_tasks`).

---

## 8. Migração — arquivo único

`supabase/migrations/<ts>_phase4_orkym_ops_billing.sql`:

1. CREATE 6 tables com FKs/UNIQUEs/CHECKs
2. ENABLE RLS + policies (padrão único + exceções aluno)
3. Triggers `set_arena_child_tenant_default` (6×) + `update_updated_at_column` (4×)
4. CREATE FUNCTION `arena_generate_billing_cycle`, `arena_mark_cycle_paid`, `arena_mark_overdue_cycles`
5. Triggers leves: `arena_billing_cycles → events`, `arena_attendance → events`
6. Indexes operacionais

---

## 9. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase4_orkym_ops_billing.sql` |
| Frontend novo | `src/pages/arena-dashboard/ArenaPlans.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaSubscriptions.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaBilling.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaOccurrences.tsx` |
| Frontend edit | `src/pages/arena-dashboard/ArenaLayout.tsx` (+4 navItems) |
| Frontend edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` (+seção Operação + lista de tasks) |
| Frontend edit | `src/App.tsx` (+4 rotas) |
| Memory edit | `mem://features/arena-management` (anexa Fase 4) |

**Total:** 1 migration + 4 telas + 3 edits triviais. Zero módulo existente reescrito.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Tabelas criadas | 6 (`arena_operational_events`, `arena_operational_tasks`, `arena_membership_plans`, `arena_student_subscriptions`, `arena_billing_cycles`, `arena_occurrences`) |
| Reaproveitado | `arena_students`, `arena_classes`, `arena_attendance`, `payment_accounts`, helpers RLS, triggers tenant default |
| Estendido | `ArenaLayout` (+4 abas), `ArenaDashboard` (+seção Operação) |
| Hooks ORKYM | `arena_operational_events` (entrada) + `arena_operational_tasks` (saída/inbox), source flag distingue origem |
| Recorrência | Plans → Subscriptions → Billing Cycles, com 3 RPCs operacionais e marcação manual de pagamento |
| Ocorrências | Tabela única + UI de gestão simples + categorização |
| RLS | 100% privado operacional; aluno só lê suas assinaturas/ciclos |

---

## ENTREGA C — Riscos / Pendências (Fase 5+)

**Pendente:**
- Cobrança automática via Mercado Pago (gerar preference por ciclo) — Fase 5
- Cron real para `arena_mark_overdue_cycles` por tenant — Fase 5
- ORKYM consumindo events e populando tasks (rotas concretas em `orkym-invoke`)
- Notificação ao aluno (mensalidade vencendo) — Fase 5/6
- View de aluno: minhas assinaturas / meus pagamentos
- Workflow de ocorrência (assignees, comentários, anexos)
- Marketplace interno arena (Fase 4 anterior pendente — não entra agora)

**Simplificações deliberadas:**
- Pagamento manual nesta fase (status atualizado por owner)
- Geração de ciclo manual (botão na UI) — sem cron
- Ocorrências sem comentários/timeline
- Tasks sem categorização avançada nem SLA

**Compatibilidade preservada:**
- Bookings, tournaments, marketplace, organizer admin, Fase 3 — todos intocados
- Zero mudança em RLS de tabelas existentes
- Zero campo novo em tabelas existentes

**Critérios de sucesso:**
- ✅ Arena cria planos, assinaturas e ciclos de cobrança
- ✅ Arena marca cobranças como pagas e visualiza vencimentos
- ✅ Arena abre e acompanha ocorrências
- ✅ Dashboard mostra operação contínua (vencimentos, ocorrências, tarefas)
- ✅ Eventos operacionais registrados automaticamente (presença, billing)
- ✅ Inbox de tarefas pronto para ORKYM gravar
- ✅ Zero IA local
- ✅ Sistema 100% funcional

