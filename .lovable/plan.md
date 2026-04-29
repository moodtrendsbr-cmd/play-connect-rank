
# Phase 13 — WhatsApp Connection Layer via ORKYM

**Princípio:** ORKYM possui o WhatsApp Business OS (QR, pairing, sessão, envio, recebimento, IA). MoodPlay apenas **espelha**, **vincula** ao tenant/arena/organizer/company e **bloqueia** acesso até conectar. Zero provider WhatsApp local. Zero IA local.

## O que JÁ existe (reutilizar, não duplicar)
- Tabelas `whatsapp_instances`, `whatsapp_bindings` (Fase 12.5) com todos os campos necessários (`external_instance_id`, `provider`, `status`, `display_name`, `phone_number`, `metadata`).
- Edge function `orkym-invoke` (HMAC + retry + audit) — modelo a copiar.
- Secrets já configurados: `ORKYM_API_BASE_URL`, `ORKYM_SERVICE_TOKEN`, `ORKYM_HMAC_SECRET`, `ORKYM_TIMEOUT_MS`.
- Shells por perfil: `TenantShell`, `ArenaShell`, `OrganizerShell`, `CompanyShell`, `AthleteShell`, `AdminShell` — pontos perfeitos para o gate.
- `AdminWhatsAppInstances` / `AdminWhatsAppBindings` — administração técnica continua disponível para Super Admin.

## Entregáveis

### 1. Edge Function `orkym-whatsapp-connection` (server-side único)
Path: `supabase/functions/orkym-whatsapp-connection/index.ts` (`verify_jwt = true`).

Body:
```json
{ "action": "start_connection|get_status|disconnect|reconnect|sync_instance",
  "scope_type": "tenant|arena|organizer|company",
  "tenant_id": "uuid", "arena_id": "uuid?",
  "company_id": "uuid?", "organizer_user_id": "uuid?" }
```

Fluxo:
1. Valida JWT → resolve `auth.uid()`.
2. **Validação de escopo** via RPCs existentes (`is_tenant_admin`, `is_arena_owner`, `is_company_owner`, `auth.uid() = organizer_user_id`). Bloqueia conexão de escopo sem permissão (`scope_forbidden`).
3. Chama ORKYM em `${ORKYM_API_BASE_URL}/whatsapp/instances/{action}` com:
   - `Authorization: Bearer ${ORKYM_SERVICE_TOKEN}`
   - `X-HMAC-Signature: hmac_sha256(ORKYM_HMAC_SECRET, request_id+body)`
   - timeout 8s, retry 5xx (2x backoff 200/800ms).
4. **Adapter interno** mapeia nomes reais da ORKYM se diferentes — frontend nunca sabe.
5. Sync no DB:
   - `start_connection` / `sync_instance` → upsert em `whatsapp_instances` por `external_instance_id`; cria/atualiza `whatsapp_bindings` para o escopo (`is_default=true`, `priority=10`).
   - `disconnect` → `status='paused'`.
   - `get_status` → re-fetch e atualiza `status`, `metadata.last_synced_at`.
6. **Failsafe**: sempre retorna HTTP 200 com `{ok, degraded?, qr_code?, pairing_code?, status, instance, error?}`. Nunca quebra app.
7. Audit em `security_audit_log` (`action_type='wa_connection_*'`).

### 2. Componente `WhatsAppConnectionPanel`
Path: `src/components/conversational/WhatsAppConnectionPanel.tsx`.

Props: `scope_type`, `tenant_id`, `arena_id?`, `organizer_user_id?`, `company_id?`, `title`, `description`, `onConnected?`.

Comportamento:
- Mount → chama `get_status`. Se já conectado, mostra estado de sucesso.
- Botão **"Conectar WhatsApp"** → chama `start_connection`. Renderiza:
  - QR Code (campo `qr_code` base64/url da resposta), centralizado, animação suave.
  - Pairing code abaixo, fonte mono grande, com botão copiar.
  - Polling `get_status` a cada 3s (até 90s ou conectado).
- Quando `status='connected'`: card verde com número, display_name, instância, CTA **"Ir para o dashboard"**.
- Botões secundários: **Reconectar**, **Atualizar status**, **Desconectar** (com confirmação).
- Estado degradado: banner amarelo + botão "Tentar novamente". Nunca trava UI.
- Blocos de valor abaixo da conexão (texto fixo por `scope_type`).

### 3. Páginas dedicadas premium
Layout: full-screen escuro, hero centralizado, Bebas Neue título, highlight `#2BFF88` em palavras-chave.

- `src/pages/connect/ConnectWhatsApp.tsx` — rota genérica `/connect-whatsapp`. Lê perfil ativo via `AuthContext` + `TenantContext` e despacha para o painel correto.
- `src/pages/tenant/TenantConnectWhatsApp.tsx` — `/tenant/connect-whatsapp`
- `src/pages/arena-dashboard/ArenaConnectWhatsApp.tsx` — `/arena/connect-whatsapp`
- `src/pages/organizer/OrganizerConnectWhatsApp.tsx` — `/organizer/connect-whatsapp`
- `src/pages/company/CompanyConnectWhatsApp.tsx` — `/company/connect-whatsapp`

Conteúdo (copy por perfil definida no spec). Sem layout/sidebar para não confundir o gate.

### 4. Gate obrigatório (`useWhatsAppConnectionGuard`)
Hook `src/hooks/useWhatsAppConnectionGuard.ts`:
- Recebe `scope_type` + ids do escopo.
- Consulta `whatsapp_bindings` join `whatsapp_instances` filtrado por escopo + `status='active'`.
- Retorna `{ loading, connected }`.

Aplicação em cada Shell (`TenantShell`, `ArenaShell`, `OrganizerShell`, `CompanyShell`):
- Se `!loading && !connected` → `<Navigate to="/{role}/connect-whatsapp" replace />`.
- **Exceções (whitelist):** rotas de conexão, `/profile`, rotas públicas (não passam pelo Shell), Super Admin (bypass total).
- `AthleteShell` e `AdminShell` **não** aplicam gate.

### 5. Indicador global de status
Componente `src/components/conversational/WhatsAppStatusBadge.tsx`:
- Mini-pill no header de cada Shell (TenantShell/ArenaShell/OrganizerShell/CompanyShell) ao lado do `ProfileSwitcher`.
- 3 estados: `Conectado` (verde), `Pendente` (amarelo, CTA "Conectar"), `Desconectado` (vermelho, CTA "Reconectar").
- Click → navega para `/{role}/connect-whatsapp`. Sem poluição visual.

### 6. Sidebars
Adicionar item **"Conexão WhatsApp"** (ícone `MessageCircle` verde) nas sidebars:
- `TenantSidebar`, `ArenaSidebar`, `OrganizerSidebar`, `CompanySidebar`.
- `AdminSidebar`: já tem Instances/Bindings — adicionar atalho **"Status global WhatsApp"**.

### 7. Roteamento (`src/App.tsx`)
Adicionar (fora dos Shells para evitar redirect loop do gate):
```tsx
<Route path="/connect-whatsapp" element={<ConnectWhatsApp />} />
<Route path="/tenant/connect-whatsapp" element={<TenantConnectWhatsApp />} />
<Route path="/arena/connect-whatsapp" element={<ArenaConnectWhatsApp />} />
<Route path="/organizer/connect-whatsapp" element={<OrganizerConnectWhatsApp />} />
<Route path="/company/connect-whatsapp" element={<CompanyConnectWhatsApp />} />
```

### 8. Cliente helper (`src/lib/wa.ts`)
Adicionar:
```ts
export async function orkymWaConnection(input: {action, scope_type, tenant_id, arena_id?, organizer_user_id?, company_id?})
  → { ok, status, qr_code?, pairing_code?, instance?, degraded? }
```

### 9. `supabase/config.toml`
Adicionar:
```toml
[functions.orkym-whatsapp-connection]
verify_jwt = true
```

### 10. Memória
- Atualizar `mem://integration/orkym-gateway-architecture.md` (nova linha "WhatsApp connection lifecycle").
- Criar `mem://features/whatsapp-connection-gate.md` (gate, escopos, exceções).
- Atualizar `mem://index.md` Core: "WhatsApp obrigatório para Tenant/Arena/Organizer/Company. ORKYM dona do canal."

## O que NÃO faremos
- Sem provider WhatsApp local (Twilio/Meta/Evolution direto).
- Sem novas tabelas (reutilizar `whatsapp_instances` + `whatsapp_bindings`).
- Sem envio/recebimento paralelo no MoodPlay.
- Sem IA de decisão.
- Sem alterar `moodplay-execute-action`, `wa-bridge`, `moodplay-session-step`.

## Fluxo end-to-end
```text
User (Arena owner) → /arena/dashboard
  └─ ArenaShell.guard → !connected → redirect /arena/connect-whatsapp
        └─ WhatsAppConnectionPanel.mount → orkym-whatsapp-connection {action:get_status}
        └─ user clicks "Conectar" → {action:start_connection}
              └─ ORKYM returns {qr_code, pairing_code, instance}
              └─ DB: upsert whatsapp_instances + binding(arena)
        └─ polling get_status (3s) → status:connected
        └─ CTA "Ir para o dashboard" → /arena/dashboard
              └─ guard passes → ArenaDashboard renderiza
```

## Critério de sucesso (verificável)
- [ ] 4 perfis conseguem conectar via fluxo idêntico.
- [ ] Acesso ao dashboard é bloqueado sem WhatsApp ativo.
- [ ] Badge de status aparece nos 4 dashboards.
- [ ] Instância vinculada corretamente em `whatsapp_bindings` com escopo certo.
- [ ] Falha da ORKYM mostra estado degradado, não quebra app.
- [ ] Super Admin nunca é bloqueado.
- [ ] Nenhuma chamada direta a provider WhatsApp no MoodPlay.

Pronto para aprovação. Após aprovado, executo migração mínima (nenhuma — apenas config.toml), edge function, componente, páginas, gate e wiring.
