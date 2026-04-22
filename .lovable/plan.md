

# Fase 12 — Deep Conversational Operations (WhatsApp-First Execution)

> **Princípio**: zero IA local, zero duplicação. WhatsApp passa de "entry point UX" para canal real de execução. Tudo passa pela ORKYM existente; MoodPlay apenas recebe, identifica, encaminha, executa via handlers já existentes e registra.

## Diagnóstico

- `orkym-invoke` já é a única porta de entrada da ORKYM (auth, dedup, rate-limit, quota, logs, ingest tasks/actions, auto-dispatch).
- `orkym-execute-action` já dispatcha 9 action_types reusando `arena_operational_tasks`, `arena_occurrences`, `arena_generate_billing_cycle`, `ad_campaigns`.
- `WhatsAppCTA` hoje só abre `wa.me?text=` — texto solto, sem payload, sem rastreio, sem retorno.
- Não existe nenhuma tabela ou função de bridge WhatsApp.

**Arquitetura-alvo**:
```text
[WhatsApp] → wa-bridge (webhook)
              ↓ identifica user/tenant via wa_identities
              ↓ insere conversational_commands (status=pending)
              ↓ chama orkym-invoke (com prompt do usuário)
              ↓ orkym retorna actions[] → ORKYM já ingesta + auto-dispatch (Fase 9)
              ↓ wa-bridge espera resultado, atualiza command.status
              ↓ envia mensagem de resposta de volta ao WhatsApp
[Dashboard] ← lê conversational_commands em tempo real
[QR]        → deep link wa.me com command pré-preenchido + token assinado
```

---

## 1. Migração — 3 tabelas + 2 RPCs

### 1.1 `wa_identities` (mapeamento WhatsApp → user)
```sql
CREATE TABLE public.wa_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL,                 -- "5511999999999"
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  default_arena_id uuid REFERENCES public.arenas(id),
  default_profile_type text NOT NULL CHECK (default_profile_type IN
    ('arena','organizer','athlete','company','tenant','admin')),
  verified_at timestamptz,
  verification_code text,                  -- 6 dígitos para opt-in
  verification_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wa_phone)
);
ALTER TABLE public.wa_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read" ON public.wa_identities FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "self insert" ON public.wa_identities FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update" ON public.wa_identities FOR UPDATE
  USING (user_id = auth.uid());
```

### 1.2 `conversational_commands` (histórico/auditoria)
```sql
CREATE TABLE public.conversational_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid REFERENCES public.arenas(id),
  user_id uuid REFERENCES auth.users(id),
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','qr','dashboard_cta')),
  profile_type text NOT NULL,
  input_text text NOT NULL,
  parsed_intent jsonb,                    -- domain/action sugerido pelo cliente
  orkym_request_id text,                  -- liga em orkym_api_calls
  orkym_correlation_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','executed','failed','no_action','rate_limited')),
  result_payload jsonb,
  error_message text,
  proposal_ids uuid[] DEFAULT '{}',       -- propostas geradas
  response_text text,                     -- mensagem devolvida ao WhatsApp
  qr_token uuid,                          -- nullable, liga a wa_qr_tokens
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_cc_tenant ON public.conversational_commands(tenant_id, created_at DESC);
CREATE INDEX idx_cc_user ON public.conversational_commands(user_id, created_at DESC);
CREATE INDEX idx_cc_arena ON public.conversational_commands(arena_id, created_at DESC) WHERE arena_id IS NOT NULL;
ALTER TABLE public.conversational_commands ENABLE ROW LEVEL SECURITY;
-- RLS: arena_owner / tenant_admin / admin / próprio user
CREATE POLICY "scoped read" ON public.conversational_commands FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);
-- INSERT/UPDATE bloqueados a clientes (apenas service role via wa-bridge)
```

### 1.3 `wa_qr_tokens` (deep links assinados, TTL curto)
```sql
CREATE TABLE public.wa_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  intent text NOT NULL,                   -- ex: "checkin", "tournament_join", "billing_open"
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id),
  arena_id uuid REFERENCES public.arenas(id),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_qr_token ON public.wa_qr_tokens(token) WHERE consumed_at IS NULL;
ALTER TABLE public.wa_qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator + scoped read" ON public.wa_qr_tokens FOR SELECT USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
  OR (arena_id IS NOT NULL AND public.is_arena_owner(arena_id, auth.uid()))
);
CREATE POLICY "scoped insert" ON public.wa_qr_tokens FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
```

### 1.4 RPCs auxiliares
- `wa_register_identity(_phone text, _profile text)` — cria/atualiza `wa_identities` para `auth.uid()`, gera `verification_code` (6 dígitos, TTL 10min). Idempotente.
- `wa_verify_identity(_phone text, _code text)` — confirma opt-in, marca `verified_at`.
- `wa_create_qr_token(_intent text, _payload jsonb, _ttl_minutes int)` — SECURITY DEFINER, valida que user pode criar QR para o contexto, retorna `token`.

---

## 2. Edge function `wa-bridge` (nova, ~200 linhas)

`supabase/functions/wa-bridge/index.ts` — `verify_jwt = false` (webhook público com HMAC).

**Modos suportados**:
1. **Webhook real** (`POST /wa-bridge` com header `X-WA-Signature`): payload Twilio/WhatsApp Business API ou genérico `{from, text}`.
2. **Mock dev** (`POST /wa-bridge?mode=mock`): aceita JSON simples `{phone, text, qr_token?}` para testes.

**Fluxo**:
```ts
1. Validar HMAC (Deno.env WA_WEBHOOK_SECRET) — modo mock pula
2. Extrair {from_phone, text, qr_token?}
3. Lookup wa_identities WHERE wa_phone = from_phone AND verified_at IS NOT NULL
   - se não existe: responder "Conecte seu WhatsApp em moodplay.app/profile" + log com user_id=null
4. Se qr_token presente: consumir wa_qr_tokens, mesclar payload no contexto
5. INSERT conversational_commands (status='pending', input_text=text, profile_type=identity.default_profile_type)
6. Service-role invoke orkym-invoke com:
   - domain inferido do profile_type (arena→arena_operations, organizer→tournaments, company→growth, etc)
   - action: "interpret_natural_command"
   - payload.context.user_input = text
   - payload.context.command_id = <conversational_commands.id>  ← liga retorno
7. Aguardar response (timeout 10s)
8. UPDATE conversational_commands SET orkym_request_id, status, proposal_ids, response_text
9. Devolver mensagem WhatsApp:
   - se actions_proposed > 0 e auto_executed > 0 → "✅ Feito: <descrição>"
   - se proposed (sem auto) → "📋 Sugestão criada, aprove no painel: <link>"
   - se nada → "🤖 Não consegui interpretar. Tente: <exemplos do profile_type>"
```

**Resposta WhatsApp**: nesta fase apenas **logada** em `conversational_commands.response_text` + retornada como JSON. O envio real de mensagem (Twilio API, etc) fica para Fase 12.5 (depende de secret + provider escolhido pelo usuário).

**Secrets necessários** (a pedir):
- `WA_WEBHOOK_SECRET` (HMAC do webhook)
- `WA_PROVIDER` (opcional: "twilio" / "meta" / "mock") — sem isso = só logging

---

## 3. Frontend — 4 superfícies

### 3.1 `WhatsAppCTA` enriquecido (~30 linhas adicionais)
Aceita opcionalmente `payload?: object` e `commandId?: string`. Quando informado:
- Antes de abrir `wa.me`, chama `supabase.functions.invoke("wa-prepare-command", {...})` que cria um row `conversational_commands` com `channel='dashboard_cta'`, status='pending', e retorna um shortcode (6 chars).
- Texto enviado vira `<command> #${shortcode}` — wa-bridge reconhece o shortcode e amarra ao row já criado.
- Fallback para comportamento atual quando sem payload.

### 3.2 Página `/profile` — bloco "WhatsApp da ORKYM"
Componente novo `src/components/conversational/WaIdentityPanel.tsx`:
- Mostra status (não conectado / pendente verificação / verificado).
- Input para telefone → chama `wa_register_identity` → toast com código (que deve ser enviado por WhatsApp para o número da ORKYM como "verificar 123456").
- Quando verificado: mostra número + profile_type default + arena default (selectable).

### 3.3 Histórico nos dashboards
Componente novo `src/components/conversational/CommandHistoryCard.tsx` — lista os 5 últimos `conversational_commands` filtrados por escopo (arena_id no Arena, tenant_id no Tenant, user_id no Athlete, etc), com badge de status colorido + link "Ver tudo" para `/<profile>/commands`.

Inserir em **6 dashboards** (após `OrkymActionsCard` quando existir, senão após hero):
- ArenaDashboard (filter `arena_id`)
- OrganizerDashboard (filter `user_id` = organizer)
- AthleteDashboard (filter `user_id`)
- CompanyDashboard (filter `user_id` = company owner)
- TenantDashboard (filter `tenant_id`)
- AdminDashboard (no filter, top 10 globais + métricas)

Realtime subscription opcional via `supabase.channel('cc-<scope>')`.

### 3.4 Página `/admin/commands` (nova)
`src/pages/admin/AdminCommands.tsx` — tabela paginada com filtros (channel, status, profile_type, tenant), drawer com detalhes + link para `orkym_api_calls`.

### 3.5 QR deep links reais
- Atualizar `QrEntryCard.tsx` — aceita `intent` e `payload`. Ao clicar "Gerar QR" chama `wa_create_qr_token` e renderiza QR (lib `qrcode.react` já instalada? — senão usar `qrcode` SVG inline) que aponta para `wa.me/<numero>?text=${comando}%20%23QR-${token.slice(0,8)}`.
- Aplicações imediatas:
  - **Arena**: QR de check-in de aula → `intent='checkin'`, `payload={class_id}`
  - **Organizer**: QR de check-in de torneio → `intent='tournament_checkin'`
  - **Athlete**: QR para entrar em torneio → `intent='tournament_join'`
  - **Company**: QR para ativar campanha/cupom → `intent='campaign_activate'`

---

## 4. CTAs existentes — payload real (5 trocas)

- `OrkymActionsCard` — botão "Continuar no WhatsApp" passa `payload={proposal_id}`, `command="Aprovar ação <id> — <título>"` → wa-bridge reconhece intent="approve_action" e chama `orkym_action_approve` direto.
- `OperationModeBanner` — sem mudança.
- `CommandExamplesCard` — cada exemplo inclui `commandId` ao clicar (rastreio).

---

## 5. Reuso 100% da ORKYM existente

A `wa-bridge` **NUNCA** decide nada por conta própria:
- Domain inferido por `profile_type` (mapping puro).
- Action sempre fixo: `interpret_natural_command` (já é um action válido — ORKYM lá fora interpreta o `payload.context.user_input` e devolve `actions[]` ou `suggestions[]`).
- Execução: ORKYM ingere proposals → Fase 9 auto-dispatch já roda → handlers existentes já executam.

Para comandos de **leitura** ("ver meus jogos", "resumo do dia"): ORKYM devolve `suggestions[]` com `body` formatado → wa-bridge usa esse texto como `response_text`. Zero query SQL nova.

Para QR de **check-in** (já existe `arena_checkin_validate(_token)`): wa-bridge detecta `intent='checkin'`, chama RPC diretamente (caso especial documentado), pula ORKYM.

---

## 6. Segurança

- **HMAC obrigatório no webhook** (rejeita se ausente em prod).
- **Identity verificada**: comandos de phones não-verificados respondem com link de onboarding e log apenas (sem invocar ORKYM).
- **Permissões**: ORKYM já valida via `orkym-execute-action.checkPermission`. wa-bridge nunca executa fora desse caminho.
- **QR tokens**: TTL máximo 60min, single-use (`consumed_at`), escopo restrito por RLS no `wa_create_qr_token`.
- **Sanitização de input_text**: trunca em 1000 chars, remove caracteres de controle.
- **Rate limit**: reusa o `RATE_LIMIT_PER_MIN` do orkym-invoke (60/min/tenant).

---

## 7. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | 3 tabelas + 3 RPCs + RLS |
| Novo | `supabase/functions/wa-bridge/index.ts` (~200) |
| Novo | `supabase/functions/wa-prepare-command/index.ts` (~60) — gera shortcode |
| Edit | `supabase/config.toml` (`wa-bridge` verify_jwt=false, `wa-prepare-command` verify_jwt=true) |
| Novo | `src/lib/wa.ts` — helpers `prepareCommand`, `createQrToken`, `registerIdentity` |
| Edit | `src/components/conversational/WhatsAppCTA.tsx` — payload + commandId |
| Edit | `src/components/conversational/QrEntryCard.tsx` — gera QR real via `wa_create_qr_token` |
| Novo | `src/components/conversational/WaIdentityPanel.tsx` — onboarding |
| Novo | `src/components/conversational/CommandHistoryCard.tsx` — 5 últimos |
| Novo | `src/components/conversational/CommandStatusBadge.tsx` |
| Edit | `src/pages/Profile.tsx` — adicionar `WaIdentityPanel` |
| Edit | 6 dashboards — adicionar `CommandHistoryCard` |
| Novo | `src/pages/admin/AdminCommands.tsx` (rota `/admin/commands`) |
| Novo | `src/pages/<profile>/<Profile>Commands.tsx` para Arena/Tenant/Organizer/Company (rotas `/<profile>/commands`) |
| Edit | `src/App.tsx` — 5 novas rotas |
| Edit | `src/layouts/sidebars/AdminSidebar.tsx` + `TenantSidebar` + `ArenaSidebar` + `OrganizerSidebar` + `CompanySidebar` — item "Comandos" |
| Edit | `src/components/orkym/OrkymActionsCard.tsx` — passar `payload={proposal_id}` no WhatsApp CTA |
| Memory | `mem/features/whatsapp-deep-execution.md` |

**Totais**: 1 migration, 2 edge functions novas, ~5 componentes novos, ~5 páginas novas, ~10 edits cirúrgicos.

---

## 8. Garantias de não-regressão

- `WhatsAppCTA` mantém comportamento atual quando chamado sem `payload` (todos os usos existentes continuam funcionando).
- `QrEntryCard` mantém prop `ctaTo` legacy; QR real é opt-in via nova prop `intent`.
- ORKYM core, RLS atuais, finance, autonomy: **intactos**.
- `orkym-invoke` e `orkym-execute-action`: **não tocados**.
- Sem secret WhatsApp configurado: bridge funciona em modo "log-only" (registra command mas não envia resposta) — UX degrada graciosamente.

---

## 9. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Bridge real | `wa-bridge` recebe webhook HMAC + modo mock para teste |
| Identidade | Tabela `wa_identities` com opt-in via código de 6 dígitos |
| Histórico | `conversational_commands` com status lifecycle completo |
| Execução real | 100% via ORKYM existente — zero nova lógica de decisão |
| Dashboards | Card "últimos comandos" em 6 perfis + página dedicada |
| QR funcional | `wa_qr_tokens` single-use → `wa.me?text=<cmd> #QR-<token>` |
| CTAs ricas | `WhatsAppCTA` aceita payload + commandId para rastreio |
| Segurança | HMAC + identity verificada + RLS por escopo + sanitize input |

## 10. ENTREGA C — Pendências (Fase 12.5+)

- **12.5**: integração real com Twilio/Meta WhatsApp Business para envio de mensagens (depende de provider + secret)
- **12.6**: WhatsApp number per-tenant (substitui `VITE_ORKYM_WHATSAPP` global por lookup em `tenant_settings`)
- **12.7**: rich messages (botões nativos do WhatsApp Business, listas, mídia)
- **12.8**: voice notes → Whisper → texto → ORKYM
- **12.9**: comandos compostos multi-turn (sessão de conversa)
- **12.10**: notificações outbound proativas (ORKYM detecta evento → manda WhatsApp)

---

## 11. Critério de sucesso

- ✅ Atleta envia "fazer check-in" + QR scan → attendance criado
- ✅ Arena owner envia "abrir cobrança do João" → `arena_generate_billing_cycle` rodado via ORKYM
- ✅ Comando aparece no `CommandHistoryCard` da arena em <3s (realtime)
- ✅ Admin vê todos comandos em `/admin/commands` com status real
- ✅ QR de check-in gera `wa.me` com payload pré-preenchido + token consumível 1x
- ✅ Sem secret WA configurado: sistema continua funcionando em log-only
- ✅ Zero alteração em `orkym-invoke` / `orkym-execute-action`
- ✅ Build TS limpo, todas rotas legacy intactas

