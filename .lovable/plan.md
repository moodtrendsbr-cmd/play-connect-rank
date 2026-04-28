# Plano — Fechamento das pendências pós-Fase 12.5

Princípio mantido: **ORKYM decide, MoodPlay executa**. Nenhuma IA/copiloto local.
As 6 pendências são agrupadas em 4 fases entregáveis.

---

## Fase 12.6 — Provider real + Webhook de delivery

### 12.6.1 Provider real em `wa-send-message`
Hoje só `provider === "mock"` envia; `twilio | meta | evolution` caem em `no_provider_configured`.

Criar despachante por provider lendo credenciais de `whatsapp_instances.outbound_credentials` (jsonb) + secrets globais como fallback:

- **Twilio**: `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` via gateway de connector já documentado (ou Basic Auth direto se a instância tiver `account_sid`/`auth_token` próprios). Body `application/x-www-form-urlencoded` com `To`, `From`, `Body` (texto) ou `ContentSid` + `ContentVariables` (template).
- **Meta Cloud API**: `POST https://graph.facebook.com/v20.0/{phone_number_id}/messages` com Bearer token; payload texto ou template estruturado.
- **Evolution API**: `POST {base_url}/message/sendText/{instance_name}` ou `/sendTemplate`, header `apikey`.

Resolução de credenciais (em ordem):
1. `instance.outbound_credentials` (override por instância)
2. Secrets globais por provider: `WA_TWILIO_ACCOUNT_SID`, `WA_TWILIO_AUTH_TOKEN`, `WA_TWILIO_FROM`, `WA_META_TOKEN`, `WA_META_PHONE_NUMBER_ID`, `WA_EVOLUTION_BASE_URL`, `WA_EVOLUTION_API_KEY`
3. Sem credencial → mantém `failed/no_provider_configured` (degradação graciosa)

Resposta do provider grava `external_message_id`, `delivery_status='sent'`, `sent_at=now()`.
Erros de rede/HTTP → `delivery_status='failed'`, `failure_reason` com código + mensagem (truncada).
Audit log já existente registra `wa_send.sent | wa_send.failed` com `provider`.

Suporte a `message_type = "template"` (Twilio Content / Meta template) — caminho separado do texto livre, rejeita se faltar `template_name`.

### 12.6.2 `wa-delivery-webhook`
Nova edge function pública (`verify_jwt = false`) com path por provider:

- `POST /wa-delivery-webhook/twilio` — body form-encoded: `MessageSid`, `MessageStatus` (`queued|sent|delivered|read|failed|undelivered`), `ErrorCode`. Validação opcional via `X-Twilio-Signature`.
- `POST /wa-delivery-webhook/meta` — JSON `entry[].changes[].value.statuses[]` com `id`, `status`, `errors[]`. Validação `X-Hub-Signature-256` HMAC-SHA256 com `WA_META_APP_SECRET`.
- `POST /wa-delivery-webhook/evolution` — JSON com `key.id`, `status`. Header `apikey` para validar.

Lógica:
1. Identifica `whatsapp_messages` por `external_message_id`.
2. Atualiza `delivery_status` (mapeia para enum existente: `sent | delivered | read | failed`), `delivered_at`, `failure_reason`.
3. Insere `security_audit_log` (`wa_delivery.<status>`).
4. Idempotente: ignora downgrade de status (`read` não vira `sent`).

Adicionar coluna `read_at timestamptz` em `whatsapp_messages` (migration).

UI em `AdminWhatsAppMessages.tsx` ganha colunas “Entregue em / Lido em”.

### Secrets a solicitar (via `add_secret` no momento da habilitação)
`WA_TWILIO_ACCOUNT_SID`, `WA_TWILIO_AUTH_TOKEN`, `WA_TWILIO_FROM`,
`WA_META_TOKEN`, `WA_META_PHONE_NUMBER_ID`, `WA_META_APP_SECRET`,
`WA_EVOLUTION_BASE_URL`, `WA_EVOLUTION_API_KEY`.
Solicitamos apenas quando o usuário criar a primeira instância daquele provider.

---

## Fase 12.7 — Multi-binding por scope na UI

`whatsapp_bindings` já suporta `scope_type ∈ {tenant, arena, organizer, company, profile}` + `priority`. UI atual (`TenantWhatsAppRouting.tsx`) só expõe `tenant | arena`.

Mudanças:
- **TenantWhatsAppRouting**: adicionar binding por **organizer_user_id** (membros do tenant) e por **profile_type** (`athlete | organizer | arena | company`). Campo `priority` numérico (lower = wins).
- Nova página `AdminWhatsAppBindings.tsx`: visão global cross-tenant, com filtro por scope_type e badge de conflito quando duas regras colidem na mesma prioridade.
- Componente reutilizável `BindingForm.tsx` com inputs condicionais por scope.
- Validação client + RLS já existente impede cross-tenant.

Resolver SQL `resolve_whatsapp_instance` permanece intacto (já respeita hierarquia + priority).

---

## Fase 12.8 — Catálogo read-only expandido

Adicionar novas ações ao `READ_ACTIONS` set em `moodplay-execute-action/index.ts`, todas mapeando para RPCs existentes ou novas (SECURITY DEFINER, sem efeitos colaterais):

| Ação ORKYM | RPC | Retorno |
|---|---|---|
| `get_athlete_ranking` | `get_athlete_ranking(_athlete_id, _modality?)` | posição, pontos, modalidade |
| `list_today_matches` | `list_today_matches(_arena_id?, _tenant_id?)` | jogos do dia c/ horário, dupla, quadra |
| `get_athlete_performance` | `get_athlete_performance(_athlete_id, _period_days)` | jogos, vitórias, %, evolução |
| `get_tournament_standings` | `get_tournament_standings(_tournament_id)` | top N por categoria |
| `list_upcoming_classes` | `list_upcoming_classes(_arena_id, _days)` | aulas próximas + vagas |

Migration cria as RPCs faltantes (todas STABLE SECURITY DEFINER, retornam `jsonb`, sem mutações).

Cada uma ganha um `summarizeResult` em `_shared/orkym-handlers.ts` para resposta humanizada.

---

## Fase 12.9 — Tabela `wa_leads` para guests

Hoje guests retornam `{is_lead: true}` mas não persistem. Migration cria:

```text
public.wa_leads
  id uuid pk
  wa_phone text unique not null
  first_seen_at timestamptz default now()
  last_seen_at timestamptz default now()
  message_count int default 0
  last_inbound_text text
  source_instance_id uuid → whatsapp_instances
  tenant_hint uuid → tenants (resolvido via instance binding)
  arena_hint uuid → arenas
  status text check (status in ('new','engaged','converted','blocked'))
  converted_user_id uuid → auth.users
  metadata jsonb default '{}'
```

RLS: leitura por admin + tenant_admin do `tenant_hint`; escrita só `service_role`.

`wa-bridge` upsert no `wa_leads` quando `resolve_whatsapp_identity` retorna `is_lead=true`. Quando o lead se cadastra (`wa_verify_identity`), trigger marca `status='converted'` + preenche `converted_user_id`.

Nova página `AdminWhatsAppLeads.tsx` com lista + ação “converter manualmente” (vincula a um user_id existente).

---

## Adoção pelo lado ORKYM (contrato público)

A ORKYM (sistema externo) vai chamar `moodplay-execute-action`. Para isso entregamos:

1. **Documento de contrato** em `mem/integration/orkym-contract.md`:
   - Endpoint: `POST {SUPABASE_URL}/functions/v1/moodplay-execute-action`
   - Headers obrigatórios: `X-MoodPlay-Signature` (HMAC-SHA256 hex), `X-Request-Timestamp` (ms epoch), `X-Idempotency-Key` (uuid), `Content-Type: application/json`
   - Body schema (todas ações), exemplos curl por categoria (read / operational / proposal)
   - Tabela completa de `action_type` suportadas + payloads esperados
   - Códigos de erro: `invalid_signature`, `timestamp_skew`, `cross_tenant_violation`, `unknown_action_type`
2. **Endpoint de healthcheck** `GET /functions/v1/moodplay-execute-action?ping=1` (sem HMAC) → `{ok:true, version, supported_actions:[...]}` para a ORKYM descobrir capacidades.
3. **Rotação de secret**: documentar processo (ORKYM e MoodPlay precisam compartilhar `ORKYM_SERVICE_TOKEN`).
4. **Postman collection** versionada em `docs/orkym-bridge.postman_collection.json` (opcional, gera em build).

---

## Detalhes técnicos

### Arquivos novos
- `supabase/functions/wa-delivery-webhook/index.ts`
- `supabase/functions/_shared/wa-providers.ts` (Twilio/Meta/Evolution dispatchers)
- `src/pages/admin/AdminWhatsAppBindings.tsx`
- `src/pages/admin/AdminWhatsAppLeads.tsx`
- `src/components/whatsapp/BindingForm.tsx`
- `mem/integration/orkym-contract.md`

### Arquivos editados
- `supabase/functions/wa-send-message/index.ts` (substitui mock por dispatcher real)
- `supabase/functions/moodplay-execute-action/index.ts` (READ_ACTIONS expandido + ping)
- `supabase/functions/wa-bridge/index.ts` (upsert em wa_leads)
- `supabase/functions/_shared/orkym-handlers.ts` (novos summarizeResult)
- `src/pages/tenant/TenantWhatsAppRouting.tsx` (multi-scope)
- `src/pages/admin/AdminWhatsAppMessages.tsx` (colunas delivered_at/read_at)
- `src/pages/admin/AdminLayout.tsx` + `App.tsx` (rotas novas)

### Migrations (3)
1. `whatsapp_messages.read_at` + index `(external_message_id)` único parcial.
2. Novas RPCs read-only (Fase 12.8).
3. Tabela `wa_leads` + trigger de conversão + RLS.

### Critérios de aceite
- ✅ Twilio/Meta/Evolution enviam mensagem real quando credenciais existem; sem credencial mantém `failed` controlado.
- ✅ Webhook recebe e atualiza status até `read`, idempotente, com HMAC validado.
- ✅ UI permite criar binding por organizer e profile_type, com priority.
- ✅ ORKYM recebe `list_today_matches`, `get_athlete_ranking`, etc. via bridge.
- ✅ `wa_leads` populada automaticamente; convertida quando user verifica identidade.
- ✅ `mem/integration/orkym-contract.md` publicado com curl + tabela de ações.
- ✅ Testes Deno cobrem dispatcher por provider (mockando fetch) e webhook idempotency.

### Fora de escopo
- Rotação automática de secrets WA_*.
- Conversational analytics dashboard (fica para fase futura).
- Pagamento dentro do WhatsApp.
