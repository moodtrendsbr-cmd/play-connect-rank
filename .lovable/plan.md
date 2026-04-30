# Check-in Sem Fricção — QR + WhatsApp

Hoje a arena já tem `wa_qr_tokens` (com `kind='checkin'`), `wa_identities`, `social_identities`, `social_events` e `arena_attendance`, mas o check-in atual exige login + matrícula em aula. Vou estender o fluxo para que **qualquer pessoa entre via QR, faça check-in pelo WhatsApp em até 3 toques, e vire perfil + contato CRM + post de feed automaticamente**, sem expor IA/ORKYM.

## Experiência do usuário

### A. QR físico da arena (entrada livre)
1. Cliente escaneia `QR de check-in` na recepção/quadra → abre WhatsApp da arena com texto pré-preenchido `MoodPlay #QR-xxxxxxxx`.
2. Bot responde:
   - **Novo**: "Bem-vindo à Arena {nome} 👋 Como podemos te chamar?" → cliente digita nome (1 vez na vida).
   - **Conhecido**: pula direto para esporte.
3. Botões de esporte (das `arena.modalities`): Beach Tennis, Padel, Vôlei, Futevôlei…
4. Se a arena tiver mais de uma quadra ativa naquele horário → botões de quadra. Senão pula.
5. "Entrada confirmada 👍 Bom jogo!"

Total: ≤3 interações, sem CPF, sem e-mail, sem formulário.

### B. QR de reserva (grupo)
- Ao confirmar booking pago, o sistema gera **1 link de check-in coletivo** (`/c/{shortcode}`) e envia no WhatsApp do organizador: "Compartilhe este link com seus parceiros para confirmarem entrada 👇".
- Cada participante abre o link → mesmo fluxo da seção A, mas já vinculado ao `booking_id`.
- A arena vê na tela "Entradas de hoje" todos os check-ins agrupados pela reserva.

### C. Painel "Entradas de hoje" (arena)
- Nova aba dentro de `/arena/dashboard/qr` (ou `/arena/dashboard/entradas`): lista em tempo real de quem fez check-in hoje, com nome, esporte, horário, foto se houver, e badge "reserva #1234" quando vier de booking.
- Botão "Confirmar presença" para a recepção quando precisar validar manualmente.

## Mudanças técnicas

### 1. Banco (migration)
- **`arena_checkins`** (nova tabela, separada de `arena_attendance` que é class-only):
  - `id`, `arena_id`, `tenant_id`, `social_identity_id` (NOT NULL), `user_id` (nullable), `phone_e164`, `display_name`, `sport`, `court_id` (nullable), `booking_id` (nullable), `qr_token` (nullable), `source` (`qr`|`booking_link`|`manual`), `confirmed_by` (nullable, staff user_id), `created_at`.
  - RLS: arena owner + arena_staff veem da própria arena; tenant vê das suas arenas; admin tudo.
  - Realtime habilitado.
- **`booking_checkin_links`**: `booking_id PK`, `shortcode` (8 chars), `expires_at` (date+1d), `created_at`. Index único em `shortcode`.
- RPCs novas (SECURITY DEFINER, search_path public):
  - `arena_checkin_start(_qr_token uuid, _phone text)` → resolve identidade, retorna `{needs_name, sports[], courts[], identity_id, arena}`.
  - `arena_checkin_complete(_identity_id uuid, _arena_id uuid, _sport text, _court_id uuid, _booking_id uuid, _name text)` → cria/atualiza social_identity, insere `arena_checkins`, insere `social_events` (`event_type='checkin'`, visibility=`public` se identity allow), atualiza `wa_identities.last_seen_at` (novo campo), retorna `{ok, checkin_id}`.
  - `booking_checkin_link_get_or_create(_booking_id uuid)`.
  - `booking_checkin_resolve(_shortcode text)` → arena+booking público mínimo.

### 2. Edge functions
- **`wa-bridge`**: ao consumir `wa_qr_tokens` com `intent='checkin'` e `kind='checkin'`, em vez de chamar `arena_checkin_validate` (que exige aula), iniciar **multi-turn flow** (`conversational_sessions` Phase 12.7) com 3 passos: ask_name (skip se identity tem display_name) → ask_sport (botões = arena.modalities) → ask_court (se >1 quadra). Concluir chamando `arena_checkin_complete`. Mensagens via templates locais determinísticos em `_shared/checkin-templates.ts` (NÃO usar IA).
- **`moodplay-execute-action`**: adicionar action `arena_checkin` (chama `arena_checkin_complete`) — usado pelo flow.
- **`booking-webhook`**: ao marcar booking pago, chamar `booking_checkin_link_get_or_create` e enfileirar mensagem `wa-send-message` com o link.

### 3. Front-end
- **`/c/:shortcode`** (público, sem auth): página simples com nome da arena, botões esporte→quadra→confirmar. Usa `booking_checkin_resolve` + `arena_checkin_complete` (chamada via edge `arena-public-checkin` para passar pelo service role com rate limit por IP/telefone).
- **`/arena/dashboard/entradas`** (nova rota, dentro do shell da arena): lista realtime de `arena_checkins` do dia, filtros por esporte/quadra/reserva, botão "exportar CSV", botão "imprimir QR de check-in" reutilizando `QRPrintSheet`.
- **`ArenaQR.tsx`**: ao criar QR `kind='checkin'`, mostrar mensagem "Cole na recepção. Cliente escaneia e faz check-in pelo WhatsApp em segundos."
- **Sidebar arena** (`ArenaSidebar.tsx`): adicionar item "Entradas" em "Operação".
- **Feed**: o `social_events` com `event_type='checkin'` já é consumido pelo feed unificado; só validar que o renderizador tem template "{nome} fez check-in na Arena {nome}".

### 4. CRM automático
A tabela `social_identities` já é a fonte de contatos do CRM da arena. A trigger nova `trg_checkin_update_identity` em `arena_checkins`:
- atualiza `social_identities.updated_at` (= last_seen),
- incrementa `metadata->>visit_count`,
- grava `metadata->>last_sport` e `metadata->>last_arena_id`,
- garante vínculo `first_arena_id` se nulo.

A página existente `/arena/dashboard/clientes` (CRM) passa a ler frequência/última visita/esporte direto desse `metadata`, sem nova tabela.

## Privacidade e guardrails
- Feed: `social_events.visibility` default `arena` (só quem segue a arena vê); usuário pode escolher `public` no primeiro check-in via botão opcional. Sem CPF, sem e-mail obrigatório.
- Rate limit em `arena-public-checkin`: 5 check-ins / 10min por telefone.
- Kill-switch: `arenas.checkin_enabled` (default true) — desativa o QR sem apagar.
- Nada de IA/ORKYM na UX: respeitar regra de gateway (templates determinísticos em `_shared/checkin-templates.ts`).

## Arquivos a criar/editar (resumo)
- migration: `arena_checkins`, `booking_checkin_links`, RPCs, trigger, coluna `arenas.checkin_enabled`, coluna `wa_identities.last_seen_at`.
- edge: `_shared/checkin-templates.ts` (novo), `wa-bridge/index.ts` (estender), `moodplay-execute-action/index.ts` (nova action), `booking-webhook/index.ts` (gerar link), `arena-public-checkin/index.ts` (novo, público + rate limit).
- front: `src/pages/PublicCheckin.tsx` (`/c/:shortcode`), `src/pages/arena-dashboard/ArenaCheckinList.tsx` (`/arena/dashboard/entradas`), update `App.tsx`, `ArenaSidebar.tsx`, `ArenaQR.tsx`.

## Critério de aceite
- Cliente escaneia QR e em ≤3 mensagens recebe "Entrada confirmada".
- `social_identities` + `arena_checkins` + `social_events` criados sem duplicar identidade existente.
- Reserva paga gera link compartilhável e cada participante faz check-in individual vinculado ao booking.
- Painel "Entradas de hoje" atualiza em tempo real.
- CRM da arena reflete frequência e última visita automaticamente.
- Nenhuma menção a IA/ORKYM na UI ou nas mensagens.
