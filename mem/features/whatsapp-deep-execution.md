---
name: WhatsApp deep execution layer
description: Phase 12 — Real WhatsApp execution via wa-bridge → ORKYM with command tracking, identity verification, and QR deep links across all 6 profile dashboards
type: feature
---

## Architecture

WhatsApp passa de "entry point UX" para canal real de execução operacional, sem duplicar lógica.

**Flow oficial**:
```
[WhatsApp/QR/Dashboard CTA]
  → wa-bridge (HMAC + identity lookup)
  → INSERT conversational_commands (status=pending)
  → orkym-invoke (action=interpret_natural_command)
  → ORKYM ingere proposals → auto-dispatch (Fase 9)
  → UPDATE conversational_commands (status, response_text, proposal_ids)
  → resposta WhatsApp (logada por enquanto; envio real em Fase 12.5)
[Dashboards] ← realtime via supabase.channel('cc-<scope>')
```

## Tabelas (3)

- **wa_identities**: mapping `wa_phone` (E.164 sem +) → `auth.users`. Opt-in por código de 6 dígitos com TTL 10min. UNIQUE(wa_phone), bloqueia phone já verificado por outro user.
- **conversational_commands**: histórico imutável a clientes (INSERT só via service role / wa-bridge / wa-prepare-command). Status: `pending | dispatched | executed | failed | no_action | rate_limited`. RLS lê por scope (user/arena/tenant/admin).
- **wa_qr_tokens**: deep links single-use, TTL máx 60min. `wa_create_qr_token()` valida permissões; `wa_consume_qr_token()` é SECURITY DEFINER (chamado pela bridge).

## Edge functions

- **wa-bridge** (`verify_jwt=false`): aceita webhook real (HMAC `WA_WEBHOOK_SECRET`) ou `?mode=mock`. Trata caso especial de check-in via `arena_checkin_validate` antes de chamar ORKYM.
- **wa-prepare-command** (`verify_jwt=true`): cria row `conversational_commands` com `channel='dashboard_cta'` e devolve shortcode 6-char. Usado por `WhatsAppCTA` quando `payload` é fornecido.

## Frontend canônico

- **`src/lib/wa.ts`**: `prepareCommand()`, `createQrToken()`, `registerWaIdentity()`, `verifyWaIdentity()`, `buildWaUrl()`. Fonte única de integração WhatsApp/QR.
- **`WhatsAppCTA`**: aceita `payload?: PrepareCommandInput`. Sem payload → comportamento legacy `wa.me?text=`. Com payload → cria command + envia `<text> #SHORTCODE`.
- **`WaIdentityPanel`**: bloco em `/profile` para opt-in. Recebe `userId`.
- **`CommandHistoryCard`**: 5 últimos comandos por scope (`user|arena|tenant|global`) com realtime. Inserir em todos 6 dashboards após CommandExamplesCard.
- **`CommandsListView`**: tabela completa em `/<profile>/commands` ou `/<profile>/dashboard/comandos`.

## Rotas (5 novas)

- `/admin/commands` → AdminCommands (scope global)
- `/arena/dashboard/comandos` → ArenaCommands (scope arena via outlet)
- `/tenant/comandos` → TenantCommands (scope tenant via useTenant)
- `/organizer/dashboard/comandos` → OrganizerCommands (scope user)
- `/company/comandos` → CompanyCommands (scope user)
- `/athlete/comandos` → AthleteCommands (scope user)

## Secrets

- `WA_WEBHOOK_SECRET` (HMAC do webhook real). Sem isso, modo `?mode=mock` continua funcionando para testes.
- `WA_PROVIDER` (futuro: `twilio`/`meta`). Sem provider, bridge faz log-only — UX degrada graciosamente.
- `VITE_ORKYM_WHATSAPP` no frontend para o número de destino do `wa.me`.

## Garantias

- Zero alteração em `orkym-invoke` / `orkym-execute-action`.
- ORKYM permanece o único cérebro: bridge nunca decide ação (sempre chama `interpret_natural_command`).
- Sidebars dos 6 perfis incluem item "Comandos" no grupo Control Tower.
- `OrkymActionsCard` passa `payload` com `proposal_id` no botão "Continuar no WhatsApp" → bridge consegue rastrear aprovação.
