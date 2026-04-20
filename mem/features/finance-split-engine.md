---
name: Finance & Split Engine (Phases 5 + 5.5)
description: Engine de receita rastreável com splits, refund, cancelamento, override auditado e settlement readiness. Tabelas financial_transactions, transaction_splits, split_rules, financial_adjustments. Triggers automáticos por enrollment/booking/marketplace/billing.
type: feature
---

## Tabelas canônicas

- `financial_transactions` — uma linha por pagamento bruto. UNIQUE(source_type, source_id) garante idempotência. Status: `pending|paid|failed|canceled|refunded|partially_refunded|disputed` (CHECK NOT VALID). Campos de refund: `refunded_amount`, `refunded_at`, `cancellation_reason`. Metadata armazena `split_source` (`override`/`tenant_rule`/`global_default`/`fallback`).
- `transaction_splits` — distribuição (platform/organizer/arena/company/affiliate). Status: `pending|calculated|settled|canceled|reversed|failed`. Settlement-ready: `expected_settlement_at`, `payout_reference`, `settlement_method`, `reversed_at`, `reversal_reason`, `payment_account_id` (snapshot canônico).
- `split_rules` — % por (tenant_id, source_type). Tenant default `00000000-0000-0000-0000-000000000001` é fallback global.
- `financial_adjustments` — append-only (sem UPDATE/DELETE). Tipos: `refund_full`, `refund_partial`, `cancellation`, `manual_credit`, `manual_debit`, `split_correction`. `reason` obrigatório, `created_by` rastreado.
- `payment_accounts` — fonte canônica de recebedor. Sincronizada por `sync_arena_payment_account` quando `arenas.mp_collector_id` é definido. Donos de arena agora têm SELECT na própria conta.
- `v_organizer_balances_canonical` — view derivada de splits (security_invoker). Substitui `organizer_balances` para leituras novas.

## Source types
`enrollment`, `booking`, `marketplace_order`, `arena_billing_cycle`, `sponsorship`.

## Hierarquia de split (precedência)
1. Ajuste manual auditado (`financial_adjustments.split_correction`) via `finance_apply_split_override`
2. Override por torneio (`tournaments.default_split_config`) — apenas `enrollment`
3. Regra do tenant (`split_rules WHERE tenant_id=X`)
4. Default global (`split_rules WHERE tenant_id='000...001'`)
5. Fallback hardcoded: `platform_pct=10`, demais=0

A camada aplicada é registrada em `financial_transactions.metadata.split_source`.

## RPCs públicas (SECURITY DEFINER)

- `finance_record_payment(source_type, source_id, total, provider, ref, paid_at)` — UPSERT idempotente. Resolve tenant/arena/organizer/company. Aplica hierarquia. Cria splits com `expected_settlement_at` (D+N do tenant). Não recria se status terminal (`refunded`, `partially_refunded`, `canceled`) ou splits já existirem.
- `finance_mark_split_settled(split_id, reference, method='manual')` — admin/tenant_admin. Atualiza `payout_reference`, `settlement_method`, emite `finance.split_settled`.
- `finance_record_refund(transaction_id, amount, reason, external_ref)` — admin/tenant_admin/arena_owner/organizer. Cria `financial_adjustments` (`refund_full` ou `refund_partial`), incrementa `refunded_amount`, ajusta status, reverte splits se total. Emite `finance.refund_created` (e `finance.refund_completed` se total).
- `finance_cancel_transaction(transaction_id, reason)` — apenas se `status='pending'`. Cria adjustment `cancellation`, marca tx e splits como `canceled`. Emite `finance.payment_canceled`.
- `finance_apply_split_override(transaction_id, splits jsonb, reason)` — admin/tenant_admin. Valida soma ≤100%. Cria adjustment `split_correction`, reverte splits antigos, cria novos com `metadata.override_adjustment_id`. Emite `finance.split_override_applied`.
- `finance_compute_expected_settlement(tenant_id, paid_at)` — helper. Lê `tenant_settings.metadata->settlement_delay_days` (default 2).

## Fluxo
1. Webhook MP atualiza `enrollments.status='paid'` (ou booking confirmed, etc).
2. Trigger PG dispara `finance_record_payment(...)`.
3. UPSERT em `financial_transactions` (idempotente).
4. Lê hierarquia de splits, popula `expected_settlement_at` e `payment_account_id` quando há conta canônica.
5. INSERT linhas em `transaction_splits` (1 por recipient com pct>0, status `calculated`).
6. Emite eventos `arena_operational_events` (apenas se `arena_id IS NOT NULL`): `finance.payment_received`, `finance.split_calculated`.

## Eventos emitidos (namespace `finance.*`)
`payment_received`, `split_calculated`, `split_settled`, `refund_created`, `refund_completed`, `payment_canceled`, `split_override_applied`. Payment events sem arena permanecem registrados apenas em `financial_transactions.metadata` (decisão pragmática Fase 5.5).

## Mapeamento entidade → financeiro
| Entidade | Status entidade | financial_transactions |
|---|---|---|
| enrollment | paid | paid |
| enrollment | cancelled após paid | refunded ou partially_refunded (manual via RPC) |
| booking | confirmed | paid |
| booking | canceled antes de pago | canceled |
| billing_cycle | paid | paid |

## Liquidação
Manual via `finance_mark_split_settled`. Settlement automático (MP Marketplace API) é Fase 6 — modelo já está pronto (`payout_reference`, `settlement_method`).

## RLS
- Admin: tudo.
- Tenant admin: tudo do seu tenant.
- Arena owner / organizer / company owner: vê `financial_transactions` onde é beneficiário e `transaction_splits` onde é recipient. Pode chamar `finance_record_refund`.
- Aluno/buyer: por enquanto não vê (estendível via JOIN).
- `financial_adjustments`: SELECT para admin + tenant_admin + beneficiário. INSERT/UPDATE/DELETE bloqueados (apenas SECURITY DEFINER RPCs).
- `payment_accounts`: tenant_admin + arena_owner (própria arena).

## Legacy (modo compat)
- `financial_ledger` — DEPRECATED. Vazia.
- `organizer_balances` — DEPRECATED. Lido por `AdminDashboard` e `request-withdrawal` por compat. Use `v_organizer_balances_canonical`.
- `arenas.mp_collector_id`, `profiles.mp_collector_id` — DEPRECATED. Fallback ativo apenas em `_shared/mp.ts::resolveCollectorId`. Resolução nova passa por `payment_accounts`.
