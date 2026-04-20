---
name: Finance & Split Engine (Phase 5)
description: Engine de receita rastreável + splits por fonte. Tabelas financial_transactions, transaction_splits, split_rules. Triggers automáticos por enrollment/booking/marketplace_order/arena_billing_cycle.
type: feature
---

## Tabelas

- `financial_transactions` — uma linha por pagamento bruto. UNIQUE(source_type, source_id) garante idempotência.
- `transaction_splits` — distribuição (platform/organizer/arena/company/affiliate). Status pending/settled/failed.
- `split_rules` — % por (tenant_id, source_type). Tenant default `00000000-0000-0000-0000-000000000001` é fallback global.

## Source types
`enrollment`, `booking`, `marketplace_order`, `arena_billing_cycle`, `sponsorship`.

## Fluxo
1. Webhook MP atualiza `enrollments.status='paid'` (ou booking confirmed, etc).
2. Trigger PG dispara `finance_record_payment(source_type, source_id, total, provider, ref)`.
3. RPC resolve tenant/arena/organizer/company a partir do source.
4. UPSERT em `financial_transactions` (idempotente).
5. Lê `split_rules` do tenant + override `tournaments.default_split_config` (apenas enrollment).
6. INSERT linhas em `transaction_splits` (1 por recipient com pct>0).
7. Emite `arena_operational_events` `event_type='finance.payment_received'` para ORKYM consumir.

## Liquidação
Manual via `finance_mark_split_settled(_split_id, _reference)` — apenas admin/tenant_admin. Fase 6 trará split automático via MP Marketplace.

## RLS
- Admin: tudo.
- Tenant admin: tudo do seu tenant.
- Arena owner / organizer / company owner: vê apenas tx onde é beneficiário ou splits onde é recipient.
- Aluno/buyer: por enquanto não vê (pode ser estendido via JOIN com enrollments/orders).

## Override por torneio
`tournaments.default_split_config` é JSONB livre. Chaves reconhecidas: `platform_pct`, `organizer_pct`, `arena_pct`. Aplica-se apenas em source `enrollment`.

## Legacy
`financial_ledger` foi marcado como LEGACY. Continua populado em paralelo pelos webhooks atuais; será migrado em script separado.
