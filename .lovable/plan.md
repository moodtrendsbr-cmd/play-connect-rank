

# Fase 5.5 — Finance Hardening + Settlement Readiness

Endurecer a camada financeira sem rebuild. Foco em rastreabilidade, governança e prontidão para settlement real. Zero IA local, zero duplicação, zero quebra.

---

## ENTREGA B (antecipada) — Auditoria do estado atual

| Estrutura | Status real | Decisão Fase 5.5 |
|---|---|---|
| `financial_transactions` (UNIQUE source_type+source_id) | **Canônico** — alimentado por 4 triggers (enrollments/bookings/marketplace/billing) | Fonte oficial. Estendida com novos status. |
| `transaction_splits` (já tem `payment_account_id`, `settlement_reference`, `metadata`) | **Canônico** — populado por `finance_record_payment` | Fonte oficial. Estendida com governança de settlement. |
| `split_rules` (UNIQUE tenant+source_type) | **Canônico** | Mantido. Hierarquia explícita. |
| `payment_accounts` (provider+external_id UNIQUE) | **Canônico** — sincronizado por `sync_arena_payment_account` trigger | Promovido a fonte oficial única. |
| `arenas.mp_collector_id` + `profiles.mp_collector_id` | **Legado ativo** (fallback em `_shared/mp.ts`) | Mantido por compat. Marcado `DEPRECATED`. Resolução nova passa só por `payment_accounts`. |
| `financial_ledger` (0 rows) | **Legado morto** | COMMENT deprecated. Sem mudança. |
| `organizer_balances` (2 rows seed) | **Legado paralelo** (usado em `AdminDashboard`, `request-withdrawal`) | Mantido por compat. View `v_organizer_balances_canonical` derivada de splits. |
| Triggers de pagamento | 4 triggers idempotentes (status novo ≠ status antigo) | Adicionar guarda extra para refund. |

**Gaps identificados:**
1. Sem CHECK constraint em `financial_transactions.status` e `transaction_splits.status` — qualquer string aceita.
2. Sem suporte a `refunded`/`partially_refunded`/`disputed`.
3. Sem registro de ajustes manuais (quem, quando, motivo).
4. Override de split é livre (jsonb sem validação) — não auditado.
5. `payment_accounts` ainda não é a primeira escolha em todos os fluxos novos.
6. Settlement só tem `settled_at` + `settlement_reference` — falta `expected_settlement_at`, `payout_reference`, método.

---

## 1. Hardening de status (CHECK + novos estados)

### `financial_transactions.status`
```
pending | paid | failed | canceled | refunded | partially_refunded | disputed
```
- `ALTER TABLE ... ADD CONSTRAINT ftx_status_chk CHECK (status IN (...)) NOT VALID;` (não revalida histórico).
- Nova coluna: `refunded_amount numeric(10,2) default 0`, `refunded_at timestamptz`, `cancellation_reason text`.

### `transaction_splits.status`
```
pending | calculated | settled | canceled | reversed | failed
```
- CHECK NOT VALID + backfill `pending → calculated` via UPDATE one-shot na migration (status atual já significa "calculated").
- Novas colunas: `expected_settlement_at timestamptz`, `payout_reference text`, `settlement_method text`, `reversed_at timestamptz`, `reversal_reason text`.

### Mapeamento status entidade → financeiro (documentado em memory, não código)
| Entidade | Status entidade | Reflete em financial_transactions |
|---|---|---|
| enrollment | paid | paid |
| enrollment | cancelled (após paid) | refunded ou partially_refunded (manual) |
| booking | confirmed | paid |
| booking | canceled | canceled (se não pago) / refunded (se pago) |
| billing_cycle | paid | paid |
| billing_cycle | canceled | canceled |

---

## 2. Refund / Cancel / Partial Refund foundation

### Tabela nova: `financial_adjustments`
Registro append-only de ajustes. Não substitui transações — anexa contexto.
```
id uuid PK, tenant_id NOT NULL, transaction_id FK NOT NULL,
adjustment_type text CHECK IN ('refund_full','refund_partial','cancellation','manual_credit','manual_debit','split_correction'),
amount numeric(10,2) NOT NULL,
reason text NOT NULL,                      -- obrigatório
external_reference text,
created_by uuid NOT NULL DEFAULT auth.uid(),
created_at timestamptz NOT NULL DEFAULT now(),
metadata jsonb DEFAULT '{}'
```
- **Append-only**: sem UPDATE/DELETE policies (apenas admin global pode em casos extremos via RPC dedicada).
- INDEX `(transaction_id, created_at DESC)`.

### RPC: `finance_record_refund(_transaction_id, _amount, _reason, _external_ref text default null)`
- SECURITY DEFINER. Permissão: admin global, tenant_admin, ou organizador/dono da arena beneficiária.
- INSERT em `financial_adjustments` (`refund_full` se `_amount = total - já_reembolsado`, senão `refund_partial`).
- UPDATE `financial_transactions`: incrementa `refunded_amount`, ajusta `status` (`partially_refunded` ou `refunded` se total).
- Marca splits proporcionalmente como `reversed` (se total) ou cria splits negativos com `metadata.reversal_of` (se parcial).
- Emite evento `finance.refund_created` em `arena_operational_events`.

### RPC: `finance_cancel_transaction(_transaction_id, _reason)`
- Apenas se `status='pending'`. Marca `canceled`, splits → `canceled`.
- Emite `finance.payment_canceled`.

---

## 3. Governança de override de split

### Hierarquia explícita (documentada e implementada)
```
1. financial_adjustments com adjustment_type='split_correction'  (ajuste manual auditado)
2. tournaments.default_split_config                              (override por entidade — apenas enrollment hoje)
3. split_rules WHERE tenant_id = X AND source_type = Y           (regra do tenant)
4. split_rules WHERE tenant_id = '00000000-0000-0000-0000-000000000001' (default global)
5. fallback hardcoded: platform_pct=10, demais=0
```

### Hardening
- Atualizar `finance_record_payment` para registrar em `metadata` qual nível foi aplicado (`split_source`: `'override'`/`'tenant_rule'`/`'global_default'`/`'fallback'`).
- Nova RPC `finance_apply_split_override(_transaction_id, _splits jsonb, _reason text)` — admin/tenant_admin only. Cria `financial_adjustments` (`split_correction`) + reverte splits antigos + cria novos. Append-only, totalmente auditável.
- Validação: soma das % no `default_split_config` ≤ 100 (CHECK function ao salvar `tournaments`).

---

## 4. Idempotência reforçada

### Já existente
- `financial_transactions UNIQUE(source_type, source_id)` ✓
- Triggers checam `OLD.status <> NEW.status` ✓

### Adicionar
- CHECK em `financial_transactions`: `refunded_amount <= total_amount`.
- CHECK em `transaction_splits`: `amount >= 0` (negativos vão em adjustments).
- Guard em `finance_record_payment`: se `status` já = `'refunded'` ou `'partially_refunded'` → não recriar splits (apenas atualiza referência). Atualmente já há guard para splits existentes; reforçar para status terminais.
- Guard em `finance_record_refund`: rejeita se `_amount + refunded_amount > total_amount`.

---

## 5. Settlement readiness

Sem integrar payout API. Modelar tudo o que payout precisará.

### Em `transaction_splits` (novas colunas)
- `expected_settlement_at` — preenchido por `finance_record_payment` usando regra simples: D+2 (configurável via `tenant_settings.metadata.settlement_delay_days`, default 2).
- `payout_reference` — id externo do payout (futuro).
- `settlement_method` — `manual` (hoje) / `mp_marketplace` / `bank_transfer` / `pix` (Fase 6).
- `payment_account_id` (já existe) — snapshot do destino. Reforçar populamento para todos recipient_types com conta canônica.

### RPC atualizada `finance_mark_split_settled(_split_id, _reference, _method text default 'manual')`
- Adiciona `_method`. Atualiza `payout_reference`. Emite `finance.split_settled` em `arena_operational_events`.

### Helper RPC nova: `finance_compute_expected_settlement(_tenant_id, _paid_at) RETURNS timestamptz`
- Usada pelo trigger de criação. Lê `tenant_settings.metadata->>'settlement_delay_days'`.

---

## 6. payment_accounts como fonte canônica

### Mudanças
- Atualizar `finance_record_payment` para resolver `payment_account_id` de **todos** os recipients que tenham conta (organizer, arena, company), não só arena. Hoje só arena.
- Para organizer/company: lookup em `payment_accounts WHERE (organizer_id = X OR tenant_id = X)` com fallback documentado.
- `_shared/mp.ts::resolveCollectorId` já tem prioridade correta (payment_accounts → arenas.mp_collector_id → profiles.mp_collector_id). Adicionar log/marker quando cair em fallback legado, exposto via nova view `v_legacy_collector_usage` (admin-only, leitura).
- COMMENT em `arenas.mp_collector_id` e `profiles.mp_collector_id`: `'DEPRECATED Phase 5.5 — use payment_accounts. Kept for compat only.'`

### View canônica nova: `v_organizer_balances_canonical`
Substitui leitura de `organizer_balances` para dashboards novos:
```sql
SELECT recipient_id AS organizer_id,
       sum(CASE WHEN status='settled' THEN amount ELSE 0 END) as settled_total,
       sum(CASE WHEN status='calculated' THEN amount ELSE 0 END) as pending_total,
       sum(amount) as gross_total
FROM transaction_splits
WHERE recipient_type='organizer'
GROUP BY recipient_id;
```
RLS: SELECT para o próprio organizer + admins.

`organizer_balances` e `request-withdrawal` mantidos intactos (compat). Migração em fase futura.

---

## 7. Eventos para ORKYM (extensão)

Reusa `arena_operational_events`. Novos `event_type` (namespace `finance.*`):
- `finance.payment_received` (já existe)
- `finance.payment_failed` (novo — emitido por edge function ao status='failed')
- `finance.payment_canceled`
- `finance.split_calculated` (emitido junto com payment_received)
- `finance.split_settled`
- `finance.refund_created`
- `finance.refund_completed` (quando todos splits revertidos)
- `finance.manual_adjustment_created`
- `finance.split_override_applied`

Quando `arena_id IS NULL` (organizer-only ou platform-only), evento ainda é registrado mas sem arena_id (relax NOT NULL? — **não**, mantém constraint). Solução: nova tabela leve `tenant_operational_events` espelho **só se** evento não couber em arena_operational_events. **Decisão pragmática:** para Fase 5.5, eventos sem arena ficam apenas em `financial_transactions.metadata.events[]` (jsonb append). Evita criar tabela nova sem necessidade comprovada.

---

## 8. RLS — revisão

- `financial_adjustments`: SELECT para admin + tenant_admin + recipient do split impactado. INSERT só via RPC SECURITY DEFINER. UPDATE/DELETE bloqueados (append-only).
- `v_organizer_balances_canonical`: SELECT para o próprio organizer + admins (via `security_invoker=true` + filter).
- `transaction_splits`: política `splits_recipient_select` já existe — verificar que cobre os 5 recipient_types (platform tem recipient_id NULL, hoje só admin lê — correto).
- `payment_accounts`: política atual restringe a tenant_admin. Adicionar SELECT para arena_owner ler conta da própria arena (read-only).

---

## 9. Dashboards — leitura canônica

| Dashboard | Mudança |
|---|---|
| `ArenaFinance.tsx` | Já lê de `financial_transactions`/`transaction_splits`. Adicionar coluna "A liquidar (D+X)" usando `expected_settlement_at`. |
| `ArenaTransactions.tsx` | Adicionar status `refunded`/`partially_refunded` no filtro + badge. Mostrar `refunded_amount` quando > 0. |
| `OrganizerFinance.tsx` | Migrar para `v_organizer_balances_canonical` em vez de agregação manual. |
| `AdminSplitRules.tsx` | Adicionar nota informativa sobre hierarquia (1.adjustment > 2.tournament override > 3.tenant rule > 4.global). |
| `AdminDashboard.tsx` | Mantém `organizer_balances` (compat) mas adiciona card "Receita canônica" lendo `financial_transactions WHERE status='paid'`. |
| **Novo:** `AdminAdjustments.tsx` (rota `/admin/adjustments`) | Lista `financial_adjustments` com filtros por type/tenant. Read-only. |
| **Novo:** Botão "Reembolsar" em `ArenaTransactions.tsx` e `OrganizerFinance.tsx` | Modal com motivo obrigatório + valor → chama `finance_record_refund`. |

---

## 10. Migração — arquivo único idempotente

`supabase/migrations/<ts>_phase5_5_finance_hardening.sql`:

1. CHECK constraints em `financial_transactions.status` e `transaction_splits.status` (NOT VALID).
2. ALTER `financial_transactions` ADD `refunded_amount`, `refunded_at`, `cancellation_reason` + CHECK `refunded_amount <= total_amount`.
3. ALTER `transaction_splits` ADD `expected_settlement_at`, `payout_reference`, `settlement_method`, `reversed_at`, `reversal_reason` + CHECK `amount >= 0`.
4. Backfill: `UPDATE transaction_splits SET status='calculated' WHERE status='pending';`
5. CREATE TABLE `financial_adjustments` + RLS (admin/tenant_admin SELECT; INSERT só via RPC; UPDATE/DELETE block).
6. CREATE OR REPLACE `finance_record_payment` (popula `expected_settlement_at`, registra `split_source` em metadata, resolve payment_account p/ todos recipients).
7. CREATE OR REPLACE `finance_mark_split_settled` (aceita `_method`, atualiza `payout_reference`, emite evento).
8. CREATE FUNCTION `finance_record_refund(_transaction_id, _amount, _reason, _external_ref)`.
9. CREATE FUNCTION `finance_cancel_transaction(_transaction_id, _reason)`.
10. CREATE FUNCTION `finance_apply_split_override(_transaction_id, _splits jsonb, _reason)`.
11. CREATE FUNCTION `finance_compute_expected_settlement(_tenant_id, _paid_at)`.
12. CREATE VIEW `v_organizer_balances_canonical` + grants.
13. COMMENT em `arenas.mp_collector_id`, `profiles.mp_collector_id`, `financial_ledger`, `organizer_balances` marcando legacy/deprecated.
14. Política nova em `payment_accounts`: arena_owner SELECT da própria conta.

---

## 11. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase5_5_finance_hardening.sql` |
| Frontend novo | `src/pages/admin/AdminAdjustments.tsx`, `src/components/finance/RefundDialog.tsx` |
| Frontend edit | `ArenaFinance.tsx`, `ArenaTransactions.tsx`, `OrganizerFinance.tsx`, `AdminSplitRules.tsx`, `AdminDashboard.tsx`, `AdminLayout.tsx` (+rota), `App.tsx` (+rota) |
| Memory | `mem/features/finance-split-engine.md` (anexa Fase 5.5: hierarquia, status, refund, settlement readiness) |

**Total:** 1 migration + 1 página + 1 dialog + 7 edits triviais. Webhooks MP, edge functions de pagamento e Brackets intocados.

---

## ENTREGA C — Riscos / Pendências (Fase 6+)

**Pendente:**
- Payout automático real (MP Marketplace API ou OAuth de subcontas) — `payout_reference`/`settlement_method` já modelados.
- Cron real para `arena_mark_overdue_cycles` por tenant.
- Migração definitiva de `organizer_balances` → leitura via `v_organizer_balances_canonical` em todos os pontos (hoje compat).
- Remoção física de `mp_collector_id` em `arenas` e `profiles` — só após auditoria de fallback usage zerado.
- ORKYM consumindo eventos `finance.*` (sugestão de preço, churn predict).
- Disputed/chargeback workflow concreto (estrutura modelada, sem UI).
- View de aluno: "minhas inscrições + reembolsos".
- Conciliação bancária real.

**Modo compatível mantido:**
- `financial_ledger` (0 rows, marcado deprecated)
- `organizer_balances` (2 rows seed, lido por AdminDashboard + request-withdrawal)
- `arenas.mp_collector_id` / `profiles.mp_collector_id` (fallback ativo em `_shared/mp.ts`)
- Webhooks MP atuais — não tocados nesta fase
- `seed-test-data` — não atualizado (gera dados legados; problema de testing, não de produção)

**Critérios de sucesso:**
- ✅ `financial_transactions` com status formal (CHECK) + suporte a refund/partial/canceled
- ✅ `transaction_splits` com modelo settlement-ready (expected/payout/method)
- ✅ `financial_adjustments` cobre refund/cancel/manual/split-override de forma append-only e auditada
- ✅ Hierarquia de override documentada e registrada em metadata
- ✅ `payment_accounts` é primeira escolha em todos os fluxos novos; fallback marcado
- ✅ Dashboards lendo da camada canônica + ação de reembolso disponível
- ✅ Idempotência reforçada por CHECK e guards
- ✅ Eventos `finance.*` para ORKYM (sem IA local)
- ✅ Zero quebra em fluxos existentes

