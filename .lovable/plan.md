

# Fase 5 — Tournament OS PRO + Finance/Split Layer

Extensão sobre Fases 1-4. Reusa estruturas existentes (`tournaments`, `tournament_modalities`, `modality_*`, `enrollments`, `organizer_balances`, `marketplace_orders`, `bookings`, `arena_billing_cycles`, `payment_accounts`). Zero duplicação. Zero IA local. Foco em **monetização rastreável**.

---

## 1. Auditoria — reuso obrigatório

| Existente | Reuso Fase 5 |
|---|---|
| `tournaments` (já tem categories[], gender[], types[], modality, slot_config) | Estendido com 3 colunas (sem rebuild) |
| `tournament_modalities` (já tem sport, level, gender, bracket_format, num_groups, sets_to_win, points_per_set) | **Já é "categoria real"** — só adicionar `team_size`, `rules_json` |
| `modality_entries / groups / matches / placements` | Já cobre fases grupos+mata-mata. Apenas estender `modality_matches` com `scheduled_at`. |
| `enrollments` | Estendido com `amount_paid`, `checked_in_at` |
| `organizer_balances`, `marketplace_orders`, `arena_billing_cycles`, `bookings` | Origem de eventos financeiros — todos viram entradas em `financial_transactions` |
| `financial_ledger` (existente, simples) | **Substituído** funcionalmente pelas novas tabelas (mantido por compat, marcado deprecado) |
| `tenant_settings` | Estendido com `metadata.split_config` (zero schema change) |
| `arena_operational_events` (Fase 4) | Reusada para emitir eventos `finance.*` |

**Não criar:** novo sistema de torneios, novo modelo de inscrições, motor financeiro contábil completo.

---

## 2. Modelo de dados — 3 novas tabelas + extensões mínimas

### Extensões em tabelas existentes (ALTER ADD COLUMN IF NOT EXISTS)

| Tabela | Novas colunas |
|---|---|
| `tournament_modalities` | `team_size smallint default 1`, `rules_json jsonb default '{}'`, `phase text default 'groups_then_ko'` (groups_only/ko_only/groups_then_ko) |
| `enrollments` | `amount_paid numeric(10,2)`, `checked_in_at timestamptz`, `modality_id uuid` (nullable, vincula a categoria específica quando aplicável) |
| `modality_matches` | `scheduled_at timestamptz`, `arena_id uuid` (snapshot via trigger) |
| `tournaments` | `default_split_config jsonb` (override por torneio; null = herda tenant) |

### 3 tabelas novas

**`financial_transactions`** — toda entrada de receita rastreável
```
id, tenant_id NOT NULL, arena_id (nullable), organizer_id (nullable),
source_type text CHECK (source_type IN ('enrollment','booking','marketplace_order','arena_billing_cycle','sponsorship')),
source_id uuid, total_amount numeric(10,2), currency text default 'BRL',
status text CHECK (status IN ('pending','paid','refunded','canceled')) default 'pending',
payment_provider text, payment_reference text, paid_at timestamptz,
metadata jsonb, created_at, updated_at
```
UNIQUE(source_type, source_id) — idempotência total.

**`transaction_splits`** — quem recebe o quê
```
id, transaction_id FK, tenant_id NOT NULL,
recipient_type text CHECK (IN ('platform','organizer','arena','company','affiliate')),
recipient_id uuid (nullable p/ platform), payment_account_id uuid (nullable, snapshot),
percentage numeric(5,2), amount numeric(10,2),
status text default 'pending' (pending/settled/failed),
settled_at timestamptz, metadata jsonb, created_at
```
INDEX (recipient_type, recipient_id, status).

**`split_rules`** — configuração por tenant (com fallback global)
```
id, tenant_id NOT NULL, source_type text,
platform_pct numeric(5,2), organizer_pct numeric(5,2), arena_pct numeric(5,2), affiliate_pct numeric(5,2) default 0,
is_active bool default true, created_at, updated_at
UNIQUE(tenant_id, source_type)
```
Seed inicial para tenant `moodplay` cobrindo cada `source_type` (default: platform=10, demais conforme natureza).

---

## 3. RLS — padrão Fase 4

- `financial_transactions` / `transaction_splits`: SELECT/ALL para `is_admin` + `is_tenant_admin` + (organizador do torneio / dono da arena / dono da empresa / aluno só vê suas) via JOIN. INSERT só via `service_role` (edge functions).
- `split_rules`: SELECT para tenant_admin/admin; UPDATE só admin global ou tenant_owner.
- Aluno/buyer: só lê transações onde é beneficiário ou pagador (via JOIN com source).

---

## 4. RPCs / lógica server-side (sem IA)

```sql
-- Cria transação + splits a partir de pagamento bruto
CREATE FUNCTION finance_record_payment(
  _source_type text, _source_id uuid, _total numeric,
  _provider text, _reference text, _paid_at timestamptz default now()
) RETURNS uuid SECURITY DEFINER
-- 1. Resolve tenant_id, arena_id, organizer_id a partir do source
-- 2. UPSERT em financial_transactions (idempotência por source)
-- 3. Lê split_rules (tenant_id, source_type) com fallback p/ tenant default
-- 4. Aplica overrides: tournaments.default_split_config se source=enrollment
-- 5. INSERT em transaction_splits (1 linha por recipient com pct>0)
-- 6. INSERT em arena_operational_events (event_type='finance.payment_received')

CREATE FUNCTION finance_mark_split_settled(_split_id uuid, _reference text) 
  RETURNS void SECURITY DEFINER -- admin/tenant_admin
```

**Triggers leves:**
- `enrollments` AFTER UPDATE quando `status` vira `'paid'` → chama `finance_record_payment('enrollment', id, ...)`
- `bookings` AFTER UPDATE quando `status='confirmed'` + payment_ref novo → idem
- `marketplace_orders` AFTER UPDATE quando `status='paid'` → idem
- `arena_billing_cycles` AFTER UPDATE quando `status='paid'` → idem

Edge functions (`create-payment`, `create-booking-payment`, `marketplace-webhook`, `mercadopago-webhook`) **mantidas intactas** — apenas o trigger captura. Zero refactor de webhook.

---

## 5. Tournament OS PRO — frontend

| Rota nova | Arquivo | Função |
|---|---|---|
| `/arena/dashboard/torneios` | `ArenaTournaments.tsx` | Lista torneios da arena (via `tournaments WHERE arena = arenas.name OR organizer_id IN (membros tenant)`). Cards com inscritos, próximas partidas, receita. |
| `/organizer/finance` | `OrganizerFinance.tsx` | Dashboard organizador: receita total, por torneio, splits recebidos/pendentes |
| `/admin/finance` | `AdminFinance.tsx` (estende `AdminFinances` existente se houver) | Visão global plataforma |
| `/arena/dashboard/financeiro` | `ArenaFinance.tsx` | Receita arena: bookings + classes + torneios na arena |
| `/arena/dashboard/transacoes` | `ArenaTransactions.tsx` | Lista de `financial_transactions` da arena com filtros |

**Extensão `ManageTournament` / `Brackets` existentes:**
- Aba nova "Categorias" no manage: edita `tournament_modalities` com novos campos (team_size, rules_json, phase)
- Aba nova "Check-in" reusa `arena_checkin_validate` — gera token por modalidade, atletas confirmam presença → `enrollments.checked_in_at`
- Botão "Agendar partida" em `TabMatches.tsx`: define `scheduled_at` + `court_id` no `modality_matches`

**Extensão `ArenaDashboard.tsx`:** card extra "Torneios ativos" + "Receita do mês".

**Sem rebuild de Brackets** — só agregações de leitura.

---

## 6. Split Engine — fluxo completo

```text
Pagamento aprovado (qualquer fonte)
        ↓
Trigger PG / Edge function chama finance_record_payment()
        ↓
financial_transactions (1 linha, idempotente por source)
        ↓
Aplica split_rules[tenant, source_type] + override tournament.default_split_config
        ↓
transaction_splits (N linhas: platform/organizer/arena/company)
        ↓
arena_operational_events ('finance.payment_received') → ORKYM consome
```

**Liquidação manual** nesta fase: admin/tenant_admin marca split como `settled` via `finance_mark_split_settled` (sem transferência automática — Fase 6 com MP Marketplace API).

---

## 7. Configuração de split — UI mínima

| Rota | Arquivo |
|---|---|
| `/admin/split-rules` | `AdminSplitRules.tsx` — gerencia `split_rules` por tenant |
| Tab em `OrganizerSettings.tsx` | "Regras de Repartição" — organizer vê suas regras (read-only) |
| Campo em `EditTournamentForm.tsx` | "Override de split" (opcional) → `tournaments.default_split_config` |

---

## 8. Migração — arquivo único idempotente

`supabase/migrations/<ts>_phase5_tournament_pro_finance.sql`:

1. ALTER `tournament_modalities` (+team_size, +rules_json, +phase) IF NOT EXISTS
2. ALTER `enrollments` (+amount_paid, +checked_in_at, +modality_id)
3. ALTER `modality_matches` (+scheduled_at, +arena_id)
4. ALTER `tournaments` (+default_split_config)
5. CREATE `financial_transactions`, `transaction_splits`, `split_rules` + RLS + indexes
6. CREATE FUNCTION `finance_record_payment`, `finance_mark_split_settled`
7. CREATE 4 triggers (enrollments/bookings/marketplace_orders/arena_billing_cycles)
8. SEED `split_rules` para tenant default `moodplay` (5 source_types × default 10/90)
9. COMMENT em `financial_ledger` marcando legacy

---

## 9. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase5_tournament_pro_finance.sql` |
| Frontend novo | `ArenaTournaments.tsx`, `ArenaFinance.tsx`, `ArenaTransactions.tsx`, `OrganizerFinance.tsx`, `AdminSplitRules.tsx` |
| Frontend edit | `ArenaLayout.tsx` (+3 navItems), `ArenaDashboard.tsx` (+2 cards), `ManageTournament.tsx` (+abas Categorias/Check-in), `TabMatches.tsx` (botão agendar), `EditTournamentForm.tsx` (split override), `OrganizerSettings.tsx` (split read-only), `App.tsx` (+rotas) |
| Memory | `mem://features/finance-split-engine` (novo) + atualização `arena-management` |

**Total:** 1 migration + 5 telas novas + 7 edits triviais. Zero módulo reescrito. Webhooks MP intocados.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Tabelas criadas | 3 (`financial_transactions`, `transaction_splits`, `split_rules`) |
| Tabelas estendidas | 4 (`tournament_modalities`, `enrollments`, `modality_matches`, `tournaments`) |
| Reaproveitado | `tournaments`, `tournament_modalities`, `modality_*`, `enrollments`, `bookings`, `marketplace_orders`, `arena_billing_cycles`, `organizer_balances`, `payment_accounts`, `arena_operational_events` |
| Engine split | Trigger por fonte → `finance_record_payment` → splits idempotentes + evento operacional |
| Tournament PRO | Categorias reais (modalities estendidas), check-in reusado, agendamento de partida, dashboard receita |
| RLS | Privacidade financeira por tenant/arena/organizador/empresa/comprador |

---

## ENTREGA C — Riscos / Pendências (Fase 6+)

**Pendente:**
- Transferência automática (MP Marketplace API real) — hoje é registro contábil + liquidação manual
- Conciliação bancária / extratos
- Reembolso parcial automatizado
- Affiliate/referral engine concreto (estrutura pronta, sem UI)
- ORKYM consumindo `finance.*` events (sugestão de preço, churn, etc)
- View de atleta "minhas inscrições + comprovantes"
- Migração histórica de `organizer_balances`/`financial_ledger` para `financial_transactions` (script separado, não bloqueia)

**Simplificações:**
- Splits ficam `pending` até admin marcar `settled` manualmente
- `default_split_config` por torneio é JSON livre (sem schema rígido)
- Sem suporte a múltiplos affiliates por transação
- Check-in de torneio reusa RPC de classes — token por modalidade, expira em 4h

**Compatibilidade:**
- Webhooks MP, fluxos de pagamento, brackets, marketplace, bookings, arena management — todos intactos
- `organizer_balances` continua sendo populado pelos webhooks atuais (paralelo, será migrado depois)

**Critérios de sucesso:**
- ✅ Toda receita (enrollment/booking/marketplace/billing) gera `financial_transactions` + splits
- ✅ Organizador vê receita por torneio e splits pendentes/liquidados
- ✅ Arena vê receita consolidada
- ✅ Admin configura `split_rules` por tenant e source
- ✅ Torneio com categorias reais (team_size, rules, phase) + check-in funcional
- ✅ Eventos `finance.*` emitidos para ORKYM
- ✅ Zero IA local, zero quebra, zero duplicação

