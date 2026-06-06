---
name: Financial Production Pipeline
description: Layer único MP — webhook unificado processMpPayment, financial_transactions canônica, triggers despachadores
type: feature
---
# Pipeline financeiro produção

## Arquitetura
Todo pagamento MP entra por **um único webhook** (`mercadopago-webhook`) que:
1. Valida assinatura via `MP_WEBHOOK_SECRET` (HMAC SHA-256 sobre `id:<id>;request-id:<rid>;ts:<ts>;`).
2. Idempotência via `webhook_events` (chave `<type>:<id>:<action>`).
3. Roteia `type=payment|preapproval|authorized_payment`.
4. Chama `processMpPayment` em `_shared/mp.ts`, que:
   - Busca payment no MP.
   - Parseia `external_reference` (suporta JSON novo `{source_type, source_id, tenant_id, ...}` + legados).
   - Mapeia status MP → canônico (`paid|pending|failed|cancelled|refunded`).
   - Upsert em `financial_transactions` (unique em `payment_provider, payment_reference`).

## external_reference padrão (obrigatório em todo POST /v1/payments)
```json
{ "source_type": "booking|enrollment|subscription|withdrawal|boost|featured|marketplace_order",
  "source_id": "<uuid>", "tenant_id": "<uuid>", "arena_id": "<uuid?>", "organizer_id": "<uuid?>" }
```
Legado (`["enr_id"]` ou `{enrollment_ids}`) ainda funciona via fallback.

## Side effects (via triggers no DB — NÃO duplicar no código)
- `trg_apply_payment_side_effects` (novo): paid → confirma booking / ativa subscription / executa withdrawal. refunded/failed → cancela.
- `trg_boost_activate_on_paid`: ativa `ad_campaigns`.
- `trg_featured_activate_on_paid`: ativa `featured_listings`.
- `trg_financial_transactions_attribute_revenue`: ORKYM revenue attribution.
- `trg_award_xp_on_booking_paid`: +6 XP.

## Edges financeiras canônicas
- `create-booking-payment`: cria payment MP, booking nasce `pending_payment`. Nunca confirma sem webhook. Sem MP_TOKEN → 503.
- `create-payment`: enrollments (compat).
- `create-boost-payment`, `create-marketplace-payment`: existentes, formato `external_reference` deve seguir padrão acima.
- `create-subscription-preapproval` (novo): MP `/preapproval` recorrente. Cria row `subscriptions` primeiro e usa seu id como `external_reference`.
- `request-withdrawal`: cria pedido `pending` (atleta/organizador).
- `execute-withdrawal` (novo): admin-only. Actions: `approve|reject|execute`. Execute dispara PIX via MP, registra `financial_transactions` `source_type=withdrawal`. Webhook fecha o ciclo.

## Webhook URLs
Registrar **somente** `mercadopago-webhook` no painel MP. `booking-webhook` e `marketplace-webhook` viraram thin wrappers de compat.

## Cron
`expire-pending-payments` (admin/cron): cancela bookings pending_payment >30min, enrollments via RPC, marca subscriptions overdue após 3d sem cobrança.

## NUNCA
- Confirmar booking/enrollment sem `financial_transactions.status='paid'`.
- Pular `verifyMpSignature` em produção (só pula se secret ausente, modo dev).
- Criar trigger duplicado para ativação — usar os existentes acima.
- Marcar booking `confirmed` direto em código (deixa o trigger fazer).
