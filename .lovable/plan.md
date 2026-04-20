

# Fase 4.1 — Refinamentos pós-entrega (sem rebuild)

Ajustes cirúrgicos sobre a Fase 4. Zero nova feature. Zero quebra. Foco em clareza semântica, integridade do modelo e preparo de escala — atendendo aos 4 pontos levantados.

---

## 1. Nomenclatura — desambiguar "events"

Risco real: já existem `tournaments` (eventos esportivos) e agora `arena_operational_events` (eventos operacionais).

**Estado atual:** a tabela já se chama `arena_operational_events` (prefixo `arena_operational_` torna a semântica inequívoca). Nenhum rename necessário.

**Ação preventiva:**
- Adicionar `COMMENT ON TABLE arena_operational_events` deixando explícito: "Trilha operacional interna da arena. Não confundir com `tournaments` (eventos esportivos públicos)."
- Padronizar `event_type` com namespace por domínio: `attendance.*`, `billing.*`, `class.*`, `student.*`, `booking.*`, `task.*`. Documentar no memory.
- Adicionar `CHECK` leve em `event_type` exigindo formato `dominio.acao` (regex `^[a-z_]+\.[a-z_]+$`) — evita poluição futura.

---

## 2. Tasks vs Occurrences — fronteira semântica

**Estado atual:** as duas tabelas existem com propósitos distintos, mas sem garantia formal.

**Definição oficial (a documentar em memory):**

| Conceito | Tabela | Significado | Estados |
|---|---|---|---|
| **Occurrence** | `arena_occurrences` | **Problema/registro de fato** ocorrido (incidente, manutenção, conflito). Tem `severity`. | open / in_progress / resolved / closed |
| **Task** | `arena_operational_tasks` | **Ação a executar** (pendência, follow-up, sugestão). Tem `priority`. | open / dismissed / done |

**Hardening estrutural:**
- `arena_occurrences`: adicionar coluna nullable `task_id uuid` apontando para `arena_operational_tasks` — opcional, vincula a ação derivada do problema. Sem FK rígida (ambas sobrevivem isoladas).
- `arena_operational_tasks`: adicionar coluna nullable `occurrence_id uuid` — quando a tarefa nasceu de uma ocorrência, fica explícito.
- `CHECK` em `arena_operational_tasks.status` IN (open, dismissed, done) e `arena_occurrences.status` IN (open, in_progress, resolved, closed). Evita estados misturados.
- `COMMENT ON TABLE` em ambas explicitando a regra ("problema" vs "ação").

UI: nenhuma mudança forçada agora — relacionamento é foundation.

---

## 3. Billing future-proof — garantir hooks de split

**Estado atual:** `arena_student_subscriptions.payment_account_id` já existe (FK lógica para `payment_accounts`). `arena_billing_cycles` já tem `payment_method` + `payment_reference`. Base de split presente.

**Hardening estrutural:**
- `arena_billing_cycles`: adicionar 3 colunas nullable, sem efeito atual:
  - `payment_account_id uuid` — copiada da subscription no momento do INSERT do ciclo (snapshot do destino do split). Permite mudar a conta da subscription sem reescrever histórico.
  - `provider_preference_id text` — id da preference Mercado Pago (Fase 5).
  - `gross_amount numeric(10,2)`, `fee_amount numeric(10,2) default 0`, `net_amount numeric(10,2)` — preparam split. `amount` continua sendo o cobrado total; `net_amount = gross - fee` quando o gateway responder. Hoje, todos populados com cópia de `amount` e `fee=0`.
- Atualizar RPC `arena_generate_billing_cycle` para popular `payment_account_id` e os campos `gross/net` no INSERT.
- Atualizar RPC `arena_mark_cycle_paid` para aceitar `_fee_amount numeric default 0` opcional e recalcular `net_amount`.

UI: opcional — mostrar `net_amount` apenas se `fee > 0` (default escondido). Sem redesign.

---

## 4. Volume de events — TTL/arquivamento + índices

**Estado atual:** triggers já populam `arena_operational_events` automaticamente (presença ausente, billing overdue/paid). Sem política de retenção.

**Hardening:**
- Confirmar índices essenciais (criar se faltar):
  - `idx_arena_op_events_arena_created ON arena_operational_events (arena_id, created_at DESC)`
  - `idx_arena_op_events_unprocessed ON arena_operational_events (arena_id, processed_at) WHERE processed_at IS NULL` — partial index, eficiente para ORKYM consumir backlog.
  - `idx_arena_op_events_type ON arena_operational_events (arena_id, event_type, created_at DESC)`
- Política de TTL via função SQL **on-demand** (sem cron — Fase 5):
  ```sql
  CREATE FUNCTION arena_archive_old_events(_arena_id uuid, _older_than_days int default 180) RETURNS integer
  -- DELETE FROM arena_operational_events
  -- WHERE arena_id = _arena_id AND processed_at IS NOT NULL AND created_at < now() - (_older_than_days || ' days')::interval
  -- RETURNS count. SECURITY DEFINER + checagem owner/admin.
  ```
  Nunca apaga eventos não processados. Política conservadora.
- Adicionar coluna `archived_at timestamptz` (nullable) — alternativa a hard delete: marca arquivamento sem perder histórico. RPC marca em vez de deletar. UI esconde `archived_at IS NOT NULL`.
- Documentar em memory: padrão recomendado é `archive` (soft) para auditoria; `delete` reservado para limpeza pesada manual.

---

## 5. Migração — arquivo único idempotente

`supabase/migrations/<ts>_phase4_1_refinements.sql`:

1. `COMMENT ON TABLE` em `arena_operational_events`, `arena_operational_tasks`, `arena_occurrences` (semântica oficial).
2. `ALTER TABLE arena_operational_events ADD CONSTRAINT event_type_format CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$') NOT VALID;` (NOT VALID = não revalida histórico, válido para inserts futuros).
3. `ALTER TABLE arena_operational_tasks ADD COLUMN occurrence_id uuid;`
4. `ALTER TABLE arena_occurrences ADD COLUMN task_id uuid;`
5. `ALTER TABLE arena_operational_tasks ADD CONSTRAINT tasks_status_chk CHECK (status IN ('open','dismissed','done'));`
6. `ALTER TABLE arena_occurrences ADD CONSTRAINT occ_status_chk CHECK (status IN ('open','in_progress','resolved','closed'));`
7. `ALTER TABLE arena_billing_cycles ADD COLUMN payment_account_id uuid, ADD COLUMN provider_preference_id text, ADD COLUMN gross_amount numeric(10,2), ADD COLUMN fee_amount numeric(10,2) DEFAULT 0, ADD COLUMN net_amount numeric(10,2);`
8. Backfill: `UPDATE arena_billing_cycles SET gross_amount = amount, net_amount = amount, fee_amount = 0 WHERE gross_amount IS NULL;`
9. `ALTER TABLE arena_operational_events ADD COLUMN archived_at timestamptz;`
10. CREATE 3 indexes faltantes em `arena_operational_events`.
11. CREATE OR REPLACE `arena_generate_billing_cycle` (popula novos campos).
12. CREATE OR REPLACE `arena_mark_cycle_paid` (aceita `_fee_amount`).
13. CREATE FUNCTION `arena_archive_old_events(_arena_id uuid, _older_than_days int)` SECURITY DEFINER.

Idempotente: todos os ALTERs com `IF NOT EXISTS` quando aplicável; CREATE INDEX `IF NOT EXISTS`.

---

## 6. Frontend — ajustes mínimos

| Arquivo | Mudança |
|---|---|
| `src/pages/arena-dashboard/ArenaBilling.tsx` | Mostrar coluna "Líquido" só quando `fee_amount > 0`. Sem redesign. |
| `src/pages/arena-dashboard/ArenaOccurrences.tsx` | Botão opcional "Gerar tarefa" que cria `arena_operational_tasks` com `occurrence_id` preenchido. |
| `src/pages/arena-dashboard/ArenaDashboard.tsx` | Inbox: badge extra "do incidente" quando task tem `occurrence_id`. |

Total: 3 edits triviais. Nada novo de UX, apenas amarração.

---

## 7. Memory update

`mem://features/arena-management` — anexar seção **"Convenções Fase 4.1"**:
- Glossário oficial: `event` (trilha) ≠ `task` (ação) ≠ `occurrence` (problema) ≠ `tournament` (evento esportivo).
- Namespace de `event_type`: `dominio.acao`.
- Política de retenção: archive soft via `arena_archive_old_events`, hard delete proibido sem operação manual.
- Billing: `payment_account_id` snapshotted no ciclo; `gross/fee/net` preparam split Mercado Pago.

---

## 8. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase4_1_refinements.sql` |
| Frontend edit | `src/pages/arena-dashboard/ArenaBilling.tsx` |
| Frontend edit | `src/pages/arena-dashboard/ArenaOccurrences.tsx` |
| Frontend edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` |
| Memory edit | `mem/features/arena-management.md` |

**Total:** 1 migration + 3 edits triviais + 1 memory. Zero módulo reescrito.

---

## ENTREGA — Resultado

| Ponto levantado | Como foi resolvido |
|---|---|
| Nomenclatura "events" | Comentário oficial + namespace forçado por CHECK + glossário em memory |
| Tasks vs Occurrences | Separação reforçada por CHECK de status + ligação opcional bidirecional + glossário |
| Billing future-proof | `payment_account_id` snapshot no ciclo + `gross/fee/net` preparam split + RPCs atualizadas |
| Volume de events | 3 índices (incl. partial p/ unprocessed) + `archived_at` + RPC `arena_archive_old_events` |

**Critérios de sucesso:**
- ✅ Zero ambiguidade entre `tournaments` e `arena_operational_events`
- ✅ Tasks e Occurrences com fronteira formalizada (CHECKs + relação opcional)
- ✅ Billing pronta para split sem alterar UI
- ✅ Trilha de eventos com índices corretos e política de arquivamento disponível
- ✅ Sistema 100% funcional, zero IA local, zero quebra

