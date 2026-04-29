---
name: WhatsApp Connection Gate (Phase 13)
description: ORKYM-owned WhatsApp connection mirrored in MoodPlay. Mandatory gate for Tenant/Arena/Organizer/Company shells.
type: feature
---

# Phase 13 — WhatsApp Connection Layer (ORKYM-as-OS)

## Princípio
ORKYM possui o WhatsApp Business OS (QR, pairing, sessão, envio, recebimento, IA). MoodPlay apenas:
1. **Espelha** a instância em `whatsapp_instances` + `whatsapp_bindings`.
2. **Vincula** ao escopo (tenant/arena/organizer/company).
3. **Bloqueia** acesso ao dashboard até conectar.

Zero provider local. Zero IA local. Zero envio paralelo.

## Componentes
- `supabase/functions/orkym-whatsapp-connection/index.ts` — bridge server-to-server (verify_jwt=true). Ações: `start_connection | get_status | disconnect | reconnect | sync_instance`. HMAC `ORKYM_HMAC_SECRET`, retry 5xx 2x, sempre HTTP 200 com `{ok, degraded?, qr_code?, pairing_code?, instance, status}`.
- `src/hooks/useWhatsAppConnection.ts` — `useWhatsAppConnectionStatus(scope)` (lê DB direto via RLS) + `callOrkymWaConnection(action, scope)`.
- `src/components/conversational/WhatsAppConnectionPanel.tsx` — UI completa: QR, pairing code, polling 3s/90s, reconnect, disconnect, blocos de valor.
- `src/components/conversational/WhatsAppStatusBadge.tsx` — pill no header (verde conectado / amarelo pendente / vermelho desconectado).
- `src/components/conversational/ConnectWhatsAppLayout.tsx` — hero premium (Bebas Neue + highlight #2BFF88).
- Páginas: `/connect-whatsapp` (dispatcher), `/tenant/connect-whatsapp`, `/arena/connect-whatsapp`, `/organizer/connect-whatsapp`, `/company/connect-whatsapp`.

## Gate
Aplicado em `TenantShell`, `ArenaShell`, `OrganizerShell`, `CompanyShell`:
- Se escopo resolvido + `!waLoading` + `!connected` → `Navigate(/{role}/connect-whatsapp)`.
- **Bypass**: `userRole === 'admin'` (super admin).
- **Fora dos shells**: rotas `/connect-whatsapp` ficam livres (registradas em `App.tsx` antes dos shells).
- `AthleteShell` e `AdminShell` **não** aplicam gate.

## Escopos e validação server-side
A edge function valida via RPCs existentes:
- `tenant` → `is_tenant_admin(_tenant_id, _user_id)`
- `arena`  → `is_arena_owner(_arena_id, _user_id)`
- `company`→ `is_company_owner(_company_id, _user_id)`
- `organizer` → `auth.uid() === organizer_user_id`

Falha → `{ok:false, error:'scope_forbidden'}` (HTTP 403).

## Sync no DB
- Upsert `whatsapp_instances` por `external_instance_id` (status normalizado: connected/paired→`active`; pending/qr→`pending`; disconnect→`paused`).
- Upsert `whatsapp_bindings` para o escopo (`is_default=true`, `priority=10`).
- Audit em `security_audit_log` para `received` / `executed` / `failed`.

## Failsafe
- ORKYM offline → resposta `{ok:false, degraded:true, message}` + UI mostra banner amarelo "Conexão indisponível" + botão tentar novamente.
- Sem secrets `ORKYM_API_BASE_URL` / `ORKYM_SERVICE_TOKEN` → idem (degraded).
- Polling auto-encerra em 90s ou quando `status==='active'`.

## Sidebars
"Conexão WhatsApp" no grupo Control Tower de: Tenant, Arena, Organizer, Company.

## Não fazer
- Nunca chamar provider WhatsApp direto do frontend.
- Nunca duplicar `whatsapp_instances` / `whatsapp_bindings`.
- Nunca aplicar gate em Athlete ou Admin.
- Nunca colocar `/connect-whatsapp` dentro de um shell (causa loop).
