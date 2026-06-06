# Plano — Financeiro MoodPlay para Produção Real

Escopo restrito: **cobrança, recebimento, repasse, recorrência, auditoria**. Nenhum módulo novo, nenhuma feature de UX nova. Tudo gira em torno das tabelas e edge functions já existentes.

## Diagnóstico atual (evidências)

- Secrets: `MERCADO_PAGO_ACCESS_TOKEN` ✅, `MERCADO_PAGO_PUBLIC_KEY` ✅, **`MP_WEBHOOK_SECRET` ausente** → `_shared/mp.ts:verifyMpSignature` cai em "compat mode" e aceita qualquer POST.
- `create-booking-payment/index.ts`: se `MP_TOKEN` faltar, marca booking como `confirmed` sem cobrança. Mesmo com token, faz `update status=confirmed` quando MP responde `approved` mas **não usa idempotência** nem registra `financial_transactions` (somente o webhook genérico faz, e só pra enrollment/boost).
- `mercadopago-webhook`: trata enrollment + boost. Não trata **booking**, **subscription**, **marketplace order** nem **refund/cancelled/expired**. Não chama `verifyMpSignature`. Idempotência via `webhook_events` ok.
- `marketplace-webhook` e `booking-webhook` existem em paralelo — fragmentação. Precisam convergir num roteador único por `external_reference.source_type`.
- `subscriptions` (tenant/arena/company): tabela existe, mas **não há job de cobrança recorrente** nem geração automática de `arena_billing_cycles`. Status flui só por update manual.
- `withdrawal_requests` + `request-withdrawal`: cria pedido com saldo validado, mas **não há executor de payout** (nem MP Money Out, nem PIX manual com confirmação). Aprovação/execução não existem como código.
- `featured_listings` tem `trg_featured_activate_on_paid`; `ad_campaigns` tem `trg_boost_activate_on_paid`. Triggers ok — o que falta é garantir que **todos os fluxos** marquem `financial_transactions.status='paid'` corretamente.

## Mudanças propostas

### A1 — MP Produção + webhook secret
- Solicitar via `add_secret`: `MP_WEBHOOK_SECRET` (assinatura `x-signature`). Sem isso, modo produção é inseguro.
- Adicionar `mercadopago-webhook` ao painel de webhooks MP (instrução pro user — não criável via código). Validar com `smoke-test-payment` chamando MP real R$ 1,00 e capturar evidência (payment id, status approved, row em `webhook_events`, row em `financial_transactions`).

### A2 — Webhook hardening (uma função, todos os fluxos)
- `mercadopago-webhook` passa a:
  - Chamar `verifyMpSignature` (rejeita 401 se inválido quando secret existir).
  - Rotear por `external_reference.source_type`: `enrollment | booking | subscription | marketplace_order | boost | featured`.
  - Tratar status MP: `approved`, `rejected`, `cancelled`, `refunded`, `charged_back`, `in_process` → mapear pra `financial_transactions.status` (`paid|failed|cancelled|refunded|pending`).
  - Sempre upsert em `financial_transactions` (uma linha por payment_id, idempotente).
- `booking-webhook` e `marketplace-webhook` viram thin wrappers que delegam pro handler compartilhado em `_shared/mp.ts` (`processMpPayment(supabase, paymentId)`).

### A3 — Reservas pagas de verdade
- `create-booking-payment`:
  - Remover branch "sem MP_TOKEN → confirmed". Se faltar token → 503.
  - Booking nasce `pending_payment`. Só vira `confirmed` via webhook (`approved`) ou retorno síncrono cartão.
  - Adicionar `external_reference = {source_type:'booking', booking_id, tenant_id, arena_id}`.
  - Adicionar `X-Idempotency-Key` = booking_id (já tem).
  - Criar `financial_transactions` row `pending` no momento da criação do pagamento.
- Trigger SQL: ao `financial_transactions.status='paid'` com `source_type='booking'`, atualizar `bookings.status='confirmed'` + creditar split. Refunded → `bookings.status='canceled'`.

### A4 — Assinaturas recorrentes
- Usar **Mercado Pago Preapproval** (`/preapproval`) para criar planos recorrentes reais para Tenant/Arena/Company.
- Nova edge `create-subscription-preapproval` (não é "feature nova" — é a implementação faltante do que `subscriptions` já promete).
- `mercadopago-webhook` passa a tratar `topic=preapproval` e `topic=authorized_payment`:
  - Cria `arena_billing_cycles` (ou equivalente p/ company/tenant) quando cobrança recorrente bate.
  - Flui status: `trial → active → overdue → cancelled` baseado em payment status e dunning (3 tentativas MP).
- Cron `expire-pending-payments` é estendido para marcar `subscriptions.status='overdue'` após N dias sem pagamento.

### A5 — Saques (payout real)
- Decisão: MP Money Out só funciona em contas marketplace homologadas. Como split MP já é usado quando `collector_id` existe, o saque do **organizador conectado já é automático** (vai direto pra conta dele). Documentar isso.
- Para casos sem split (saldo em `organizer_balances` retido na conta Mood), implementar payout PIX via MP `/v1/payments` com `payment_method_id='pix'` para a `pix_key` do `withdrawal_requests`. Estados: `pending → approved (admin) → processing → paid | failed`.
- Nova edge `execute-withdrawal` (admin-only, JWT + role check) que dispara o PIX e atualiza status. Registrar `financial_transactions` `source_type='withdrawal'`.
- Tela admin (`AdminFinances`) ganha botão "executar" — sem mudar layout, só ligar handler existente.

### A6 — Boosts e Featured (validação)
- Triggers já existem. Validar end-to-end com smoke:
  - Comprar boost R$ 1 → webhook → `financial_transactions.status=paid` → `trg_boost_activate_on_paid` ativa `ad_campaigns.status='active'`.
  - Idem `featured_listings`.
- Adicionar testes em `smoke-test-payment` que cobrem os 6 `source_type`.

### A7 — Relatório de evidências
Entregar arquivo `/mnt/documents/financial-go-live-evidence.md` com:
- Payment IDs reais (sandbox e produção R$ 1,00).
- Linhas de `webhook_events` + `financial_transactions` (printadas).
- Booking confirmado por webhook.
- Assinatura criada + 1º ciclo cobrado.
- Withdrawal pending → executed → paid.
- Featured + boost ativados via pagamento.

## Detalhes técnicos

**Tabelas tocadas (somente DML/trigger, sem schema novo):**
- `financial_transactions` — vira fonte canônica. Adicionar trigger `trg_apply_payment_side_effects` que despacha por `source_type` (booking confirm, subscription cycle, withdrawal paid).
- `subscriptions` — adicionar colunas `provider_subscription_id text`, `current_period_end timestamptz`, `trial_ends_at timestamptz` (migration mínima).
- `withdrawal_requests` — adicionar `executed_at timestamptz`, `provider_payment_id text`, `failure_reason text`.
- `webhook_events` — já existe, mantém idempotência.

**Edge functions tocadas:**
- editar: `mercadopago-webhook`, `create-booking-payment`, `booking-webhook`, `marketplace-webhook`, `request-withdrawal`, `smoke-test-payment`, `_shared/mp.ts`, `expire-pending-payments`.
- criar (implementação faltante, não feature nova): `create-subscription-preapproval`, `execute-withdrawal`.

**Secrets necessários:** `MP_WEBHOOK_SECRET` (será solicitado via `add_secret`).

**Ordem de execução:**
1. Pedir `MP_WEBHOOK_SECRET`.
2. Migration (colunas + trigger despachador).
3. Refatorar `_shared/mp.ts` (`processMpPayment`).
4. Atualizar webhooks + `create-booking-payment`.
5. Implementar preapproval + executor de saque.
6. Estender `smoke-test-payment` + rodar.
7. Gerar relatório de evidências.

## Fora de escopo (não fazer)
- Nenhuma tela nova. UX existente fica intacta.
- Nenhuma alteração em ORKYM, WhatsApp, gamificação, ranking.
- Sem mexer em `auth.*`, `storage.*`.
- Sem cobrança recorrente em provedor que não seja MP (Stripe/Paddle ficam fora; usuário já está em MP).
