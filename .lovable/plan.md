

# Phase 12.5 — Enterprise WhatsApp Routing + ORKYM Execution Bridge

> **Princípio**: ORKYM decide, MoodPlay executa. Esta fase adiciona a camada faltante para que ORKYM possa **(a)** rotear por instância de WhatsApp por tenant/arena, **(b)** chamar MoodPlay server-to-server para executar ações sem precisar passar pelo wa-bridge, **(c)** registrar mensagens outbound proativas, e **(d)** receber feedback estruturado. Reusa 100% dos handlers existentes (`orkym-execute-action`, RPCs) — zero IA nova, zero decision engine local.

## Diagnóstico do que já existe (reaproveitamento)

| Camada | Status atual | Reuso |
|---|---|---|
| Identity resolution | `wa_identities` + `wa_register/verify_identity` | ✅ Reusa |
| Command history (inbound) | `conversational_commands` (channel: whatsapp/qr/dashboard_cta/api) | ✅ Reusa, adiciona `direction`, `whatsapp_instance_id`, `linked_entity_*` |
| Inbound bridge | `wa-bridge` recebe webhook → ORKYM | ✅ Reusa, integra resolver de instância |
| QR deep links | `wa_qr_tokens` + `wa_consume_qr_token` | ✅ Reusa |
| Action execution | `orkym-execute-action` (9 action_types já dispatchados) | ✅ Reusa diretamente |
| ORKYM-driven proposals | `orkym_action_proposals` + auto-dispatch (Fase 9) | ✅ Reusa |
| Outbound messaging | **NÃO EXISTE** | 🆕 Cria |
| Instance routing | **NÃO EXISTE** (só `VITE_ORKYM_WHATSAPP` global) | 🆕 Cria |
| Server-to-server execution bridge | **NÃO EXISTE** (ORKYM só consegue chamar via wa-bridge) | 🆕 Cria |

---

## 1. Migration — 4 tabelas + 2 RPCs + 3 colunas

### 1.1 `whatsapp_instances` (canal físico)
```sql
CREATE TABLE public.whatsapp_instances (
  id uuid PK,
  provider text CHECK (provider IN ('twilio','meta','evolution','mock')),
  display_name text,                    -- "Arena Praia Grande WA"
  phone_number text NOT NULL,           -- E.164 sem +
  external_instance_id text,            -- ID na Twilio/Meta
  webhook_secret text,                  -- HMAC por instância (rotacionável)
  outbound_endpoint text,               -- URL do provider para envio
  outbound_credentials jsonb,           -- {token, sid} criptografado
  status text CHECK (status IN ('active','paused','revoked')) DEFAULT 'active',
  is_global_fallback boolean DEFAULT false,  -- só uma pode ser true
  metadata jsonb DEFAULT '{}',
  created_at, updated_at
);
-- RLS: read = admin only; nenhum cliente vê credenciais
```

### 1.2 `whatsapp_bindings` (roteamento hierárquico — TABELA ÚNICA)
```sql
CREATE TABLE public.whatsapp_bindings (
  id uuid PK,
  instance_id uuid REFERENCES whatsapp_instances(id),
  scope_type text CHECK (scope_type IN ('arena','tenant','organizer','company','global')),
  tenant_id uuid REFERENCES tenants(id),
  arena_id uuid REFERENCES arenas(id),
  organizer_user_id uuid REFERENCES auth.users(id),
  company_id uuid REFERENCES companies(id),
  profile_type text,                    -- nullable: filtro por papel
  is_default boolean DEFAULT true,
  priority int DEFAULT 100,             -- menor = mais específico
  metadata jsonb DEFAULT '{}',
  created_at
);
-- Índices parciais por scope_type; RLS: tenant_admin vê próprio binding
```

### 1.3 `whatsapp_messages` (histórico inbound + outbound)
```sql
CREATE TABLE public.whatsapp_messages (
  id uuid PK,
  instance_id uuid REFERENCES whatsapp_instances(id),
  command_id uuid REFERENCES conversational_commands(id),  -- liga a inbound
  direction text CHECK (direction IN ('inbound','outbound')),
  wa_phone text NOT NULL,
  user_id uuid,
  tenant_id uuid,
  arena_id uuid,
  message_type text DEFAULT 'text',     -- text|template|interactive|media
  body text,
  template_name text,
  template_vars jsonb,
  external_message_id text,             -- ID retornado pelo provider
  delivery_status text CHECK (delivery_status IN
    ('queued','sent','delivered','read','failed')) DEFAULT 'queued',
  failure_reason text,
  initiated_by text CHECK (initiated_by IN ('user','orkym','system','manual')),
  correlation_id text,                  -- liga a orkym_api_calls
  created_at, sent_at, delivered_at
);
-- RLS: scoped read por user/arena/tenant/admin
```

### 1.4 `orkym_proactive_eligibility` (preferências outbound, opt-in)
```sql
CREATE TABLE public.orkym_proactive_eligibility (
  id uuid PK,
  user_id uuid REFERENCES auth.users(id),
  tenant_id uuid,
  category text,                        -- 'billing','retention','marketing','operations'
  channel text DEFAULT 'whatsapp',
  opted_in boolean DEFAULT false,
  opted_at timestamptz,
  opted_out_at timestamptz,
  metadata jsonb,
  UNIQUE(user_id, tenant_id, category, channel)
);
-- RLS: self read+write; tenant_admin read
```

### 1.5 Colunas adicionadas em `conversational_commands`
```sql
ALTER TABLE conversational_commands
  ADD COLUMN direction text DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  ADD COLUMN whatsapp_instance_id uuid REFERENCES whatsapp_instances(id),
  ADD COLUMN linked_entity_type text,
  ADD COLUMN linked_entity_id uuid,
  ADD COLUMN normalized_input text,
  ADD COLUMN initiated_by text DEFAULT 'user' CHECK (initiated_by IN ('user','orkym','system'));
```

### 1.6 RPCs (single source of truth)

**`resolve_whatsapp_instance(_tenant_id, _arena_id, _profile_type, _organizer_user_id, _company_id)`** — SECURITY DEFINER, retorna `instance_id` aplicando hierarquia:
1. Binding `arena` específico → 2. `organizer/company` específico → 3. `tenant` → 4. binding por `profile_type` → 5. fallback global (`is_global_fallback = true`).

**`resolve_whatsapp_identity(_wa_phone, _instance_id)`** — SECURITY DEFINER, retorna JSONB com `{user_id, profile_type, tenant_id, arena_id, verified, is_lead}`. Se phone não verificado mas tem `wa_identities` parcial → retorna `is_lead: true`. Permite estado guest para ORKYM lidar.

---

## 2. Edge function nova — `moodplay-execute-action` (server-to-server)

`supabase/functions/moodplay-execute-action/index.ts` — `verify_jwt = false`.

**Auth**: HMAC obrigatório (`X-MoodPlay-Signature`) + bearer token `ORKYM_SERVICE_TOKEN` em ambiente. Sem cliente JWT.

**Payload aceito**:
```json
{
  "tenant_id": "...",
  "arena_id": "...",
  "user_id": "...",            // contexto do operador (se houver)
  "profile_type": "arena_manager",
  "action_type": "create_tournament|create_followup|generate_billing_cycle|...",
  "payload": { ... },
  "source": "orkym_whatsapp|orkym_proactive|orkym_dashboard",
  "correlation_id": "..."      // do lado ORKYM, para rastrear
}
```

**Fluxo**:
1. Valida HMAC + tenant existe + (se arena_id) pertence ao tenant.
2. Cria `conversational_commands` row com `channel='api'`, `initiated_by='orkym'`, `direction='inbound'`, `correlation_id`.
3. **Reusa handlers**:
   - Se `action_type` é um dos 9 já suportados em `orkym-execute-action` → cria proposal `auto_executed=false` e chama internamente o dispatcher (refatoração mínima: extrai handlers para `_shared/orkym-handlers.ts`).
   - Se for ação **read-only** (`get_arena_summary`, `list_today_classes`, etc.) → executa via RPC e retorna inline (sem persistir proposal).
   - Se for ação **nova operacional** mapeada (`create_tournament` via tabela `tournaments` insert, `create_class` via `arena_classes`, `create_billing` via `arena_generate_billing_cycle`) → handler que **só chama RPC/insert existente**. **Zero lógica de negócio nova.**
4. Atualiza command com `status`, `linked_entity_*`, `result_payload`, `response_text`.
5. Retorna feedback estruturado:
```json
{
  "ok": true,
  "command_id": "...",
  "execution_status": "executed|failed|pending_approval",
  "linked_entity": { "type": "tournament", "id": "..." },
  "checkout_link": "...",     // opcional
  "qr_link": "...",           // opcional
  "response_summary": "Torneio criado para 23/05.",
  "follow_up_actions": [ ... ]
}
```

**Catálogo inicial de actions** (declarativo, reusa 100%):
| action_type | Reusa |
|---|---|
| `create_followup`, `create_reminder`, `create_occurrence`, `propose_manual_charge`, `flag_enrollment_attention`, `propose_promotion`, `schedule_operational_review`, `open_communication_thread`, `recovery_campaign_draft` | `orkym-execute-action` handlers |
| `create_tournament` | `INSERT tournaments` (rota já existente em `CreateTournament.tsx`) |
| `create_class` | `INSERT arena_classes` |
| `generate_billing_cycle` | `arena_generate_billing_cycle(_subscription_id)` |
| `mark_cycle_paid` | `arena_mark_cycle_paid(_cycle_id)` |
| `validate_checkin` | `arena_checkin_validate(_token)` |
| `get_arena_summary`, `list_today_classes`, `list_pending_enrollments`, `get_revenue_today` | RPCs read-only (criar 4 RPCs `STABLE SECURITY DEFINER` finos) |

---

## 3. Edge function nova — `wa-send-message` (outbound)

`supabase/functions/wa-send-message/index.ts` — `verify_jwt = false`, HMAC + service token.

**Responsabilidade**: enviar mensagem WhatsApp via instância correta, registrar em `whatsapp_messages`, sem decidir conteúdo.

**Payload**:
```json
{
  "to_phone": "5511...",
  "tenant_id": "...",          // resolve instância via resolve_whatsapp_instance
  "arena_id": "...",
  "message_type": "text|template|interactive",
  "body": "...",
  "template_name": "...",
  "template_vars": {...},
  "category": "billing|retention|marketing|operations",
  "user_id": "...",            // checa opt-in em orkym_proactive_eligibility
  "correlation_id": "...",
  "initiated_by": "orkym"
}
```

**Fluxo**:
1. Resolve instância via `resolve_whatsapp_instance`.
2. Se categoria proativa: checa `orkym_proactive_eligibility.opted_in` para o user.
3. Insere `whatsapp_messages` com `delivery_status='queued'`.
4. Despacha ao provider:
   - `provider='mock'` → log e marca `sent`.
   - `provider='twilio'/'meta'` → chama API correspondente com creds da instância.
   - Se sem credenciais → marca `failed` com `failure_reason='no_provider_configured'`. **UX degrada graciosamente.**
5. Retorna `{ ok, message_id, delivery_status }`.

**Webhook de delivery status** (futuro 12.6): `wa-delivery-webhook` consumindo callbacks do provider e atualizando `whatsapp_messages.delivery_status`.

---

## 4. Refatoração mínima em código existente

### 4.1 `wa-bridge` — usar resolver de instância
Adicionar antes do lookup de identidade:
```ts
const targetPhone = req.headers.get("x-wa-instance-phone") || /* parse from payload */;
const { data: instance } = await supa.rpc("resolve_whatsapp_instance_by_phone", { _phone: targetPhone });
// usar instance.id ao criar conversational_commands.whatsapp_instance_id
```

E em `resolve_whatsapp_identity`: receber `_instance_id` para que ORKYM saiba **em qual contexto** o usuário escreveu (athlete A pode ser cliente da Arena X em uma instância e da Arena Y em outra).

### 4.2 `orkym-execute-action` — extrair handlers para shared
Mover o `switch (p.action_type)` para `supabase/functions/_shared/orkym-handlers.ts` exportando `dispatchAction(admin, proposal)`. Tanto `orkym-execute-action` quanto `moodplay-execute-action` importam.

### 4.3 `OrkymActionsCard` — preview de instância
Mostrar qual instância será usada quando "Continuar no WhatsApp" for clicado (chip pequeno: "WA: Arena XPTO").

---

## 5. Frontend — superfícies mínimas (UX-only)

### 5.1 `/admin/whatsapp-instances` (nova)
Tabela CRUD de `whatsapp_instances` (provider, phone, status, fallback global). Acesso: admin only.

### 5.2 `/tenant/whatsapp-routing` (nova)
Lista bindings do tenant + UI para criar binding tenant/arena → instância. Reusa formulário simples; valida via RPC.

### 5.3 `WaIdentityPanel` — adicionar opt-in proativo
Após verificação, mostrar 4 toggles (billing/retention/marketing/operations) que escrevem em `orkym_proactive_eligibility`.

### 5.4 `CommandHistoryCard` — coluna "direção" + "instância"
Badge colorido `inbound`/`outbound`, chip da instância quando aplicável.

### 5.5 `/admin/whatsapp-messages` (nova) e `/<profile>/messages` (alias para escopo)
Tabela paginada de `whatsapp_messages` (filtrar direction, status, instance, category).

### 5.6 `src/lib/wa.ts` — funções novas
`resolveInstance()`, `sendOutbound()` (apenas para admin/test), `setProactiveOptIn()`.

---

## 6. Segurança (mandatório)

- **HMAC obrigatório** em `wa-bridge` (já existe), `moodplay-execute-action` e `wa-send-message` (novos).
- **Validação cross-tenant**: toda chamada a `moodplay-execute-action` valida que `arena_id` pertence ao `tenant_id` informado e que o `user_id` (se passado) tem papel compatível.
- **Credenciais de provider**: `outbound_credentials` em `whatsapp_instances` lido **apenas por edge function service-role**. Coluna não exposta em RLS para clientes.
- **Replay protection**: header `X-Request-Timestamp` (rejeita > 5min); `X-Idempotency-Key` (dedup em `whatsapp_messages` e `conversational_commands` por correlation_id).
- **Audit trail**: cada execução server-to-server insere `security_audit_log` (reusa função existente).
- **Opt-in obrigatório** para `wa-send-message` em categorias `marketing`/`retention`. `billing`/`operations` permitidos por padrão (transacionais).

---

## 7. Arquivos tocados

| Tipo | Arquivo | LOC |
|---|---|---|
| Migration | 1 nova (4 tabelas + 6 RPCs + 6 colunas + RLS + índices) | ~400 |
| Edge | `supabase/functions/moodplay-execute-action/index.ts` (novo) | ~250 |
| Edge | `supabase/functions/wa-send-message/index.ts` (novo) | ~180 |
| Edge | `supabase/functions/_shared/orkym-handlers.ts` (extração) | ~200 |
| Edge | `supabase/functions/orkym-execute-action/index.ts` (refac mínima) | -120/+15 |
| Edge | `supabase/functions/wa-bridge/index.ts` (resolver instance) | +30 |
| Config | `supabase/config.toml` (verify_jwt=false p/ 2 novos) | +6 |
| Lib | `src/lib/wa.ts` (3 helpers) | +60 |
| UI | `src/pages/admin/AdminWhatsAppInstances.tsx` (novo) | ~200 |
| UI | `src/pages/admin/AdminWhatsAppMessages.tsx` (novo) | ~150 |
| UI | `src/pages/tenant/TenantWhatsAppRouting.tsx` (novo) | ~180 |
| UI | `WaIdentityPanel.tsx` (toggles opt-in) | +50 |
| UI | `CommandHistoryCard.tsx` (badge direção + chip instância) | +20 |
| UI | `src/App.tsx` (3 rotas) + sidebars (Admin + Tenant) | +12 |
| Memory | `mem/integration/orkym-execution-bridge.md` | novo |

---

## 8. Garantias de não-regressão

- `wa-bridge` continua funcionando em modo mock e com identidades existentes.
- `orkym-execute-action` mantém contrato externo idêntico (apenas refatora handlers internamente).
- `WhatsAppCTA` legacy (sem payload) inalterado.
- Tabelas Phase 12 (`wa_identities`, `conversational_commands`, `wa_qr_tokens`) preservadas; só ganham colunas opcionais.
- Sem provider configurado: `wa-send-message` retorna `failed` mas não bloqueia o sistema.
- Zero lógica de negócio nova: todo `moodplay-execute-action` é wrapper que chama RPCs/handlers existentes.

---

## 9. ENTREGA B — Relatório estrutural

| Pergunta | Resposta |
|---|---|
| Como instância é resolvida? | `resolve_whatsapp_instance(tenant, arena, profile, organizer, company)` — hierarquia arena → org/company → tenant → profile_type → fallback global |
| Como identidade é resolvida? | `resolve_whatsapp_identity(phone, instance_id)` retorna {user, profile_type, tenant, arena, verified, is_lead}; lead state permite ORKYM iniciar fluxo de captura |
| Como ORKYM chama MoodPlay? | `POST /moodplay-execute-action` com HMAC + service token, payload tipado, retorna feedback estruturado síncrono |
| Como MoodPlay responde? | JSON: `{execution_status, linked_entity, checkout_link?, qr_link?, response_summary, follow_up_actions[]}` |
| Como histórico é salvo? | `conversational_commands` ganha direction/instance/linked_entity; `whatsapp_messages` separa eventos de canal |
| Como proatividade fica preparada? | `orkym_proactive_eligibility` (opt-in por categoria) + `wa-send-message` com resolver de instância + `whatsapp_messages` outbound |
| O que foi reusado? | `orkym-execute-action` handlers, `wa_identities`, `conversational_commands`, `wa_qr_tokens`, `arena_*` RPCs, `is_admin/is_tenant_admin/is_arena_owner`, `security_audit_log` |
| O que foi criado? | 4 tabelas (instances/bindings/messages/eligibility), 2 edge functions (execute-action server-to-server, send-message), 2 RPCs resolver, 3 telas de configuração admin/tenant |

## 10. ENTREGA C — Riscos e pendências

- **Provider real (Twilio/Meta)**: `wa-send-message` envia em modo mock até secrets `WA_PROVIDER_*` serem configurados. Pendência da próxima fase.
- **Delivery callbacks**: webhook `wa-delivery-webhook` para receber status `delivered/read/failed` do provider — Fase 12.6.
- **Multi-instance per arena**: estrutura suporta, mas UI atual permite 1 binding/scope. Multi-line/canal segue Fase 12.7.
- **Catálogo de actions read-only**: 4 RPCs criados (`get_arena_summary`, etc); expansão (rankings, jogos do dia, performance) fica para Fase 12.8.
- **Voice notes / rich messages**: dependem do provider — fora do escopo.
- **ORKYM precisa adaptar**: lado ORKYM precisa adotar endpoint `moodplay-execute-action` (auth HMAC, payload tipado). Documentação no memory file.
- **Lead/guest state**: persistido em `wa_identities` sem `verified_at` mas `user_id` exigido. Pendência: tabela `wa_leads` separada se necessário (Fase 12.9).

---

## 11. Critério de sucesso

- ✅ ORKYM resolve instância correta para qualquer (tenant, arena, profile)
- ✅ ORKYM chama `moodplay-execute-action` server-to-server e cria torneio/aula/cobrança real
- ✅ Resposta estruturada com `linked_entity` + `response_summary`
- ✅ Outbound proativo registrado em `whatsapp_messages` com opt-in respeitado
- ✅ `conversational_commands` mostra inbound + outbound com direção e instância
- ✅ Hierarquia de fallback funciona: arena → tenant → global
- ✅ HMAC + replay protection + cross-tenant validation ativos
- ✅ Zero lógica de IA local; zero duplicação de handlers
- ✅ Sem provider configurado: sistema funciona em log-only sem quebrar

