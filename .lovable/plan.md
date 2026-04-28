# Phase 12.7 — Multi-Turn Conversational Flows (Stateful Sessions)

## Princípio (não esquecer)

ORKYM continua sendo o cérebro. MoodPlay ganha **estado mínimo de sessão** + **schema declarativo de fluxos** para:
- guardar dados parciais entre mensagens
- dizer à ORKYM o que ainda falta
- forçar confirmação antes de executar
- expirar sessões abandonadas

**Zero NLP, zero IA, zero parser.** A ORKYM continua extraindo valores do texto livre; a MoodPlay só **valida**, **acumula** e **decide o próximo passo**.

---

## Arquitetura

```text
ORKYM                          MoodPlay (novo: session bridge)
─────                          ─────────────────────────────────
recebe msg WhatsApp
extrai (intent + valores)
        │
        │ POST /moodplay-session-step
        │ { user_id, instance_id, intent?, values?, confirm? }
        ▼
                               1. resolve sessão ativa (user+instance)
                                  ou cria nova com intent
                               2. merge values em context_data
                               3. valida via flow schema
                               4. retorna:
                                  { state, missing_fields[], next_prompt,
                                    confirmation_summary?, ready_to_execute }
        ◄──────────────────────
formula próxima pergunta
ou pede confirmação
        │
        │ usuário responde "sim"
        │ POST /moodplay-session-step { confirm: true }
        ▼
                               5. chama moodplay-execute-action internamente
                               6. marca session=completed, retorna resultado
        ◄──────────────────────
relay para usuário
```

---

## Entrega A — Implementação

### 1. Migração SQL
- **Tabela** `conversation_sessions`:
  ```
  id, tenant_id, arena_id, user_id, profile_type, whatsapp_instance_id,
  current_intent text, state text CHECK IN ('collecting','confirming','executing','completed','abandoned','failed'),
  context_data jsonb DEFAULT '{}', last_message_at timestamptz, expires_at timestamptz,
  created_at, completed_at, command_id uuid (link → conversational_commands),
  correlation_id text, metadata jsonb
  ```
- Índices: `(user_id, whatsapp_instance_id, state)` parcial onde `state IN ('collecting','confirming')`; `(expires_at)` para job de expiração; `(tenant_id, created_at DESC)`.
- RLS: tenant admin vê suas; arena owner vê arena dela; admin vê tudo; service_role full.
- **RPC** `expire_stale_sessions()` — marca `state='abandoned'` onde `expires_at < now() AND state IN ('collecting','confirming')`. Reutilizada pelo `orkym-cron-tick`.
- **RPC** `resolve_active_session(_user, _instance, _ttl_minutes)` — retorna sessão ativa não expirada ou null.
- **RPC** `start_session(...)`, `update_session_context(...)`, `mark_session_executing(...)`, `complete_session(...)` — todas SECURITY DEFINER.

### 2. Flow schema declarativo (em código, não no DB)
Arquivo `supabase/functions/_shared/conversation-flows.ts`:
```ts
export interface FlowField { name: string; type: 'string'|'uuid'|'date'|'time'|'integer'|'decimal'|'enum';
  required: boolean; enum_values?: string[]; min?: number; max?: number;
  prompt: string; // texto que ORKYM usa como hint para perguntar
  validate?: (v: unknown, ctx: any) => string | null; // retorna mensagem de erro
}
export interface FlowDef { intent: string; action_type: string; // ação final em moodplay-execute-action
  fields: FlowField[]; summarize: (ctx: any) => string; // monta texto de confirmação
}
```
Fluxos iniciais (5):
- `reserve_court` → `create_booking` (futuro `book_court` action)
- `create_class` → `create_class`
- `enroll_student` (em plano de arena) → `enroll_athlete_in_plan` (a wrapper)
- `create_tournament` → `create_tournament`
- `generate_billing_cycle` → `generate_billing_cycle`

> Para esta fase, só precisamos garantir que a ação final **já existe** no catálogo do `moodplay-execute-action`. As 4 já cobertas (`create_class`, `create_tournament`, `generate_billing_cycle`, `validate_checkin`) são reutilizadas. `reserve_court` e `enroll_student` viram **flows funcionais cujo execute** falha graciosamente com `unknown_action_type` se ainda não existir o handler — documentamos como pendência (Entrega C). Não vamos criar novos handlers de execução nesta fase para respeitar o "não duplicar".

### 3. Edge function nova: `moodplay-session-step`
- Mesmo padrão de auth do `moodplay-execute-action` (HMAC + timestamp + idempotência).
- Body:
  ```json
  {
    "tenant_id": "...", "arena_id": "...", "user_id": "...",
    "profile_type": "...", "whatsapp_instance_id": "...",
    "intent": "reserve_court",      // opcional se já há sessão
    "values": { "date": "2026-04-23", "time": "20:00" },
    "confirm": false,                // true só na confirmação final
    "abort": false,                  // true para cancelar sessão atual
    "correlation_id": "..."
  }
  ```
- Resposta:
  ```json
  {
    "ok": true,
    "session_id": "uuid",
    "state": "collecting|confirming|executing|completed|abandoned",
    "current_intent": "reserve_court",
    "context_data": { ... },
    "missing_fields": [
      { "name": "court_id", "type": "uuid", "prompt": "Qual quadra?", "required": true }
    ],
    "next_prompt": "Qual quadra?",          // primeira da lista, conveniência
    "confirmation_summary": "Reserva: ..."  // só quando state=confirming
    "execution_result": null | { ... }      // só quando state=completed
  }
  ```
- Lógica:
  1. autentica + resolve sessão ativa (`user+instance`, TTL 15min default, configurável via `metadata.ttl_minutes` no flow)
  2. se `abort` → marca `abandoned`, devolve novo estado vazio
  3. se sem sessão → cria com `intent` (rejeita `unknown_intent` se não estiver no catálogo)
  4. merge `values` em `context_data`, validando cada campo. Erros de validação retornam `state=collecting` com `validation_errors[]`.
  5. recalcula `missing_fields`. Se vazio → `state=confirming` + `confirmation_summary`. Senão → `state=collecting`.
  6. se `confirm=true && state=confirming` → marca `executing`, monta payload, invoca `moodplay-execute-action` server-to-server (HMAC interno), grava resultado, marca `completed` ou `failed`.
  7. tudo audita em `security_audit_log` (`session.created|updated|confirmed|executed|aborted|expired`).

### 4. Helper TypeScript no frontend (`src/lib/wa.ts`)
- `stepSession(input): Promise<SessionStepResult>` — para uso futuro da ORKYM ou de painéis admin que queiram operar uma sessão.

### 5. Catálogo no healthcheck
- `GET /moodplay-session-step?ping=1` retorna `{ok, version: "12.7", supported_intents: [...]}`.
- Atualizar `GET /moodplay-execute-action?ping=1` para incluir `session_endpoint: "/moodplay-session-step"` em `meta`.

### 6. Cron de expiração
- `orkym-cron-tick` já roda; adicionar chamada `await admin.rpc("expire_stale_sessions")` ao loop.

### 7. Testes Deno (`supabase/functions/moodplay-session-step/`)
- `hmac_test.ts` — HMAC + skew (espelha o do execute-action).
- `flow_test.ts` (unitário) — `getFlow('reserve_court')`, validação por tipo, `summarize()`.
- `integration_test.ts` — cenários:
  1. ping
  2. iniciar sessão → state=collecting com missing_fields
  3. enviar valor parcial → continua collecting
  4. valor inválido → validation_errors
  5. completar todos os campos → state=confirming + summary
  6. confirm=true → state=completed (ou failed graciosamente se action ainda não suportada — assertamos que session.state vira `failed` com `error_message` claro, não 500)
  7. abort → state=abandoned
  8. nova mensagem após abort → cria nova sessão
  9. unknown_intent → 400

### 8. Memória
- Criar `mem://features/multi-turn-flows.md` (intents suportadas, schema do flow, fluxograma).
- Atualizar `mem://integration/orkym-gateway-architecture.md` adicionando o novo endpoint na tabela.
- Atualizar `mem://integration/orkym-contract.md` com seção "Stateful flows (Phase 12.7)".

---

## Entrega B — Relatório

`/mnt/documents/orkym-phase-12-7-stateful-flows.md` cobrindo:
- Intents suportadas + fields + action_type final
- 2 exemplos de fluxo end-to-end (reserva de quadra com 4 turnos; criação de torneio com 6 turnos)
- Diagrama do step engine
- Tabela de mapping spec ↔ código (endpoint, tabela, RPCs, testes)

---

## Entrega C — Pendências futuras

- **Memória longa cross-session** (preferências do usuário) — fica para 12.8.
- **Personalização de prompts por tenant** (i18n + tom de voz) — depende de tabela `tenant_settings.conversation_voice`, fora de escopo.
- **Branching condicional** dentro de um flow (ex: se modalidade=padel pedir parceiro) — schema atual é linear; adicionar `next_field: (ctx) => fieldName` opcional na Phase 12.8.
- **Handlers operacionais novos** que faltam para flows completos: `book_court`, `enroll_athlete_in_plan` — exigem design de payload + RLS, fora de escopo desta fase (documentar como pré-requisito do go-live).
- **Multi-binding por escopo** (12.7 original do roadmap) é separado; sessões hoje resolvem por `user_id + instance_id`.

---

## Critério de aceite

- Migração aplicada (`conversation_sessions` + 5 RPCs) sem warnings do linter.
- `moodplay-session-step` deployado, healthcheck OK.
- 11+ testes Deno verdes (HMAC + flow + integração).
- Cron expira sessões abandonadas.
- Nenhuma linha de NLP/IA adicionada — flows são schemas declarativos.
- Memória + relatório entregues.

---

## Decisões a confirmar antes de eu codar

1. **TTL padrão de sessão**: vou usar **15 min** (ponto médio do range 10-20). OK?
2. **Política de "uma sessão por user+instance"**: se já existir sessão ativa e ORKYM mandar novo `intent` diferente, eu **abandono a antiga e crio nova** (mais limpo que erro). OK?
3. **Flows com action_type ainda não implementado** (`reserve_court`, `enroll_student`): manter os flows definidos mas execução final retorna `failed` com `unknown_action_type` claro, e listo como pendência na Entrega C. Alternativa: deixar só os 3 flows que já têm action (`create_class`, `create_tournament`, `generate_billing_cycle`). Qual prefere?

Se quiser, sigo direto com defaults (15 min, abandona-e-cria, manter os 5 flows com pendência documentada).
