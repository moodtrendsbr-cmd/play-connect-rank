# Phase 12.7 — Multi-Turn Conversational Flows (Hardened)

## Princípio inegociável

ORKYM = cérebro (decide intent, extrai valores, formula prompts).
MoodPlay = máquina de estado (lock, valida, acumula, confirma com snapshot, executa idempotente, emite eventos).

**Zero NLP, zero IA, zero parser dentro do MoodPlay.**

---

## Arquitetura geral

```text
ORKYM                                    MoodPlay (session bridge HARDENED)
─────                                    ─────────────────────────────────
extrai (intent, values) do WhatsApp
        │
        │ POST /moodplay-session-step
        │ HMAC + timestamp + X-Idempotency-Key
        ▼
                                         1. AUTH (HMAC + skew 5min)
                                         2. RESOLVE sessão ativa (user+instance)
                                         3. ACQUIRE LOCK (SELECT ... FOR UPDATE NOWAIT)
                                            └─ se locked → 409 retry_after
                                         4. DETECT multi-intent
                                            └─ intent novo != atual → fecha antiga
                                               como abandoned e abre nova
                                         5. MERGE values em context_data + valida
                                         6. RECALCULA missing_fields
                                            └─ vazio → state=confirming + snapshot
                                         7. RELEASE LOCK
                                         8. EMIT event (session.* em
                                            security_audit_log)
        ◄────────────────────────────────
        { state, missing_fields[], next_prompt,
          confirmation_summary?, snapshot_hash? }

usuário responde "sim"
        │
        │ POST /moodplay-session-step { confirm: true }
        ▼
                                         1-3. AUTH + LOCK
                                         4. valida state == confirming
                                         5. valida snapshot_hash bate (anti-mudança
                                            entre confirm e execute)
                                         6. gera idempotency_key derterminístico
                                            (session_id + snapshot_hash)
                                         7. checa se já executado → retorna result
                                            cacheado (no replay de "sim sim sim")
                                         8. chama moodplay-execute-action interno
                                            com mesmo idempotency_key
                                         9. salva execution_result, marca completed
                                        10. RELEASE LOCK + EMIT event
        ◄────────────────────────────────
```

---

## Entrega A — Implementação

### 1. Migração SQL

**Tabela `conversation_sessions`** (campos finais):
```
id uuid pk
tenant_id uuid not null
arena_id uuid null
user_id uuid not null
profile_type text not null
whatsapp_instance_id uuid not null

current_intent text not null
state text not null check in (
  'collecting','confirming','executing','completed',
  'abandoned','failed','superseded'
)

context_data jsonb default '{}'      -- progresso vivo
context_snapshot jsonb null          -- congelado em state=confirming
snapshot_hash text null              -- sha256(context_snapshot) p/ anti-tamper

idempotency_key text null            -- gerado na confirmação
execution_result jsonb null
command_id uuid null                 -- FK conversational_commands

is_locked boolean default false      -- advisory flag
locked_at timestamptz null
locked_by text null                  -- request_id que segura

last_message_at timestamptz default now()
expires_at timestamptz not null      -- now() + ttl
resumable_until timestamptz null     -- expires_at + 30min (janela de resume)

correlation_id text null
metadata jsonb default '{}'

created_at timestamptz default now()
updated_at timestamptz default now()
completed_at timestamptz null
```

**Índices:**
- parcial `(user_id, whatsapp_instance_id) where state in ('collecting','confirming')` — 1 ativa por dupla
- `(expires_at) where state in ('collecting','confirming')` — para expiração
- `(idempotency_key) unique where idempotency_key is not null` — anti-replay
- `(tenant_id, created_at desc)` — admin/auditoria

**Constraint:** unique parcial garantindo no máximo **1 sessão ativa** por `(user_id, whatsapp_instance_id)` em estados `collecting|confirming`.

**RLS:** tenant admin vê suas; arena owner vê arena dela; admin vê tudo; service_role full.

**RPCs (todas SECURITY DEFINER):**

1. `acquire_session_lock(_session_id uuid, _request_id text, _ttl_seconds int default 30) returns boolean`
   - usa `SELECT ... FOR UPDATE NOWAIT` interno; se já travada por outro `request_id` ou lock < TTL, retorna false; senão marca `is_locked=true, locked_at=now(), locked_by=_request_id`.

2. `release_session_lock(_session_id uuid, _request_id text) returns void`
   - só libera se `locked_by = _request_id` (evita liberar lock alheio).

3. `resolve_or_create_session(...) returns conversation_sessions`
   - resolve ativa não expirada; se ORKYM mandou `intent` diferente do atual → marca antiga como `superseded` e cria nova; se vencida mas dentro de `resumable_until` → retorna como "resumable" (state mantido, flag `is_resumable=true` no payload da function).

4. `update_session_context(_session_id, _values jsonb, _validation_errors jsonb) returns void`
   - merge raso em `context_data`, atualiza `last_message_at` e estende `expires_at`.

5. `prepare_session_confirmation(_session_id, _snapshot jsonb, _hash text) returns void`
   - state → `confirming`, grava snapshot + hash.

6. `mark_session_executing(_session_id, _idempotency_key text) returns boolean`
   - retorna false se `idempotency_key` já existe em qualquer sessão (replay detectado), senão marca `executing`.

7. `complete_session(_session_id, _result jsonb, _success boolean) returns void`
   - state → `completed`/`failed`, grava `execution_result`, libera lock.

8. `expire_stale_sessions() returns int` — marca `abandoned` quando `expires_at < now()` e state coletando/confirmando. Define `resumable_until = expires_at + interval '30 min'`.

9. `abandon_session(_session_id, _reason text) returns void` — para uso explícito (`abort:true`).

**Eventos:** todas as RPCs gravam linha em `security_audit_log` com `event_type` em:
`session.created | session.locked | session.lock_denied | session.context_updated | session.intent_switched | session.confirmation_prepared | session.execution_started | session.execution_completed | session.execution_failed | session.abandoned | session.resumed | session.expired | session.replay_blocked`.

### 2. Flow schema declarativo

`supabase/functions/_shared/conversation-flows.ts`:
```ts
interface FlowField {
  name: string;
  type: 'string'|'uuid'|'date'|'time'|'integer'|'decimal'|'enum';
  required: boolean;
  enum_values?: string[];
  min?: number; max?: number;
  prompt: string;
  validate?: (v: unknown, ctx: any) => string | null;
}
interface FlowDef {
  intent: string;
  action_type: string;
  fields: FlowField[];
  ttl_minutes?: number;            // default 15
  summarize: (ctx: any) => string; // mensagem de confirmação humana
}
```

**Flows iniciais (5):**
- `reserve_court` → `book_court` (handler ainda não existe → `failed graceful`)
- `create_class` → `create_class` ✅
- `enroll_student` → `enroll_athlete_in_plan` (handler ainda não existe → `failed graceful`)
- `create_tournament` → `create_tournament` ✅
- `generate_billing_cycle` → `generate_billing_cycle` ✅

`getFlow(intent)` retorna `null` para intent desconhecido → 400 `unknown_intent`.

### 3. Edge function `moodplay-session-step`

**Auth:** HMAC + timestamp + (opcional) `X-Idempotency-Key` para a request inteira.

**Body:**
```json
{
  "tenant_id": "...", "arena_id": "...", "user_id": "...",
  "profile_type": "...", "whatsapp_instance_id": "...",
  "intent": "reserve_court",       // opcional se já há sessão
  "values": { "date": "2026-04-23", "time": "20:00" },
  "confirm": false,
  "abort": false,
  "resume": false,                  // explícito p/ retomar abandonada
  "correlation_id": "..."
}
```

**Resposta:**
```json
{
  "ok": true,
  "session_id": "uuid",
  "state": "collecting|confirming|executing|completed|abandoned|superseded",
  "current_intent": "reserve_court",
  "context_data": { ... },
  "missing_fields": [{ "name":"court_id","type":"uuid","prompt":"Qual quadra?" }],
  "validation_errors": [{ "field":"date","message":"data no passado" }],
  "next_prompt": "Qual quadra?",
  "confirmation_summary": "Reserva: Padel quadra 2 em 23/04 às 20h por 2h",
  "snapshot_hash": "sha256:...",
  "execution_result": null,
  "is_resumable": false,
  "lock_status": "acquired|denied"
}
```

**Pipeline:**
1. autentica HMAC + skew 5min.
2. `request_id = X-Idempotency-Key || uuid()`.
3. `resolve_or_create_session` (detecta multi-intent, retorna sessão + flag resumable).
4. **`acquire_session_lock`** — se `false` → retorna 409 `{ok:false, error:"session_locked", retry_after_ms:500}`. ORKYM faz backoff.
5. try / finally:
   - se `abort` → `abandon_session("user_aborted")`.
   - se `resume` em sessão `abandoned` dentro de `resumable_until` → reabre como `collecting`.
   - merge `values`, valida cada field via flow schema. Erros → `state=collecting` + `validation_errors[]`.
   - recalcula missing_fields. Se vazio:
     - monta snapshot = `{...context_data, _flow_intent, _ts}`
     - `snapshot_hash = sha256(canonical_json(snapshot))`
     - `prepare_session_confirmation(snapshot, hash)`
   - se `confirm == true && state == 'confirming'`:
     - recalcula hash do snapshot atual; se diferente do enviado pela ORKYM (caso ORKYM passe `expected_snapshot_hash`) → 409 `snapshot_mismatch`.
     - `idempotency_key = sha256(session_id + snapshot_hash)` (determinístico)
     - `mark_session_executing(idempotency_key)`; se `false` (replay) → busca `execution_result` da sessão e retorna direto (idempotente real).
     - chama `moodplay-execute-action` server-to-server **com o mesmo `X-Idempotency-Key`** (a function execute-action já honra essa chave).
     - `complete_session(result, success)`.
   - **finally:** `release_session_lock` (sempre).
6. emite eventos em `security_audit_log` em cada transição.

### 4. Helper `src/lib/wa.ts`
- `stepSession(input)` — chamada tipada para painéis admin que queiram operar sessões manualmente (debug).

### 5. Healthcheck
- `GET /moodplay-session-step?ping=1` → `{ok, version:"12.7", supported_intents:[...], lock_ttl_seconds:30, default_session_ttl_minutes:15, resume_window_minutes:30}`.
- Atualizar `GET /moodplay-execute-action?ping=1` com `meta.session_endpoint`.

### 6. Cron de expiração e resume
- `orkym-cron-tick` chama `expire_stale_sessions` a cada tick.
- Sessões expiradas viram `abandoned` mas mantêm `resumable_until = expires_at + 30min`.
- Limpeza dura: job mensal pode `delete from conversation_sessions where state in ('completed','abandoned','failed') and updated_at < now() - interval '90 days'`.

### 7. Testes Deno (`supabase/functions/moodplay-session-step/`)

**`hmac_test.ts`** — espelha execute-action.

**`flow_test.ts`** (unitário) — `getFlow`, validação por tipo, `summarize`, `canonical_json` p/ hash estável.

**`integration_test.ts`** — 14 cenários:
1. ping
2. iniciar sessão → `collecting` + missing_fields
3. valor parcial → segue collecting
4. valor inválido → validation_errors
5. completar tudo → `confirming` + summary + snapshot_hash
6. **lock concorrente** — duas requests paralelas; segunda recebe 409 `session_locked`
7. **multi-intent** — sessão de `reserve_court` ativa, ORKYM manda `create_class` → antiga vira `superseded`, nova `collecting`
8. **confirm idempotente** — `confirm:true` 3x → executa 1x, demais retornam mesmo `execution_result`
9. **snapshot tampering** — modificar `context_data` direto no DB entre prepare e confirm → hash diverge, retorna 409 `snapshot_mismatch`
10. confirm de flow sem handler (`reserve_court`) → `state=failed` + `error_message="unknown_action_type"` (não 500)
11. abort → `abandoned`, `resumable_until` setado
12. resume dentro da janela → reabre `collecting` com mesmo `context_data`
13. resume fora da janela → erro `not_resumable`, cria nova
14. unknown_intent → 400

### 8. Memória
- `mem://features/multi-turn-flows.md` — intents, schema, lock model, snapshot anti-tamper, resume window.
- atualizar `mem://integration/orkym-gateway-architecture.md` (linha do endpoint).
- atualizar `mem://integration/orkym-contract.md` com seção "Stateful flows (Phase 12.7 hardened)" cobrindo lock, idempotência, snapshot e multi-intent.

---

## Entrega B — Relatório

`/mnt/documents/orkym-phase-12-7-stateful-flows.md`:
- Tabela de intents + fields + action_type
- Diagrama do step engine + lock lifecycle
- 2 fluxos end-to-end:
  - reserva de quadra com lock concorrente simulado
  - criação de torneio com retry de "sim sim sim" demonstrando idempotência
- Catálogo de eventos `session.*` emitidos
- Mapping spec ↔ código (16 itens da spec, com endpoint/tabela/RPC/teste)

---

## Entrega C — Pendências futuras

- **Memória longa cross-session** (preferências do usuário) — Fase 12.8.
- **Personalização de prompts por tenant** (i18n + tom de voz) — depende de `tenant_settings.conversation_voice`.
- **Branching condicional** dentro de um flow — schema atual é linear; adicionar `next_field: (ctx) => fieldName` na 12.8.
- **Handlers operacionais que faltam:** `book_court`, `enroll_athlete_in_plan` — pré-requisito de go-live para os flows correspondentes.
- **Lock distribuído real** (Redis/pg_advisory_lock global) caso volte a ter múltiplas instâncias da edge function — hoje usamos `is_locked` + `FOR UPDATE NOWAIT` na linha, suficiente até ~50 RPS por sessão.
- **Métricas Prometheus** das transições — fica para observabilidade dedicada.

---

## Critério de aceite

- Migração aplicada (`conversation_sessions` + 9 RPCs) sem warnings do linter.
- `moodplay-session-step` deployado, healthcheck OK.
- 14+ testes Deno verdes (HMAC + flow + integração com lock/idempotência/snapshot).
- Cron expira sessões e calcula `resumable_until`.
- Nenhuma linha de NLP/IA — flows são schemas declarativos puros.
- ORKYM detém intent; MoodPlay nunca sobrescreve.
- Eventos `session.*` em `security_audit_log` para auditoria.
- Memória + relatório entregues.

---

## Defaults aplicados (já decididos)

- TTL de sessão ativa: **15 min** (configurável por flow via `ttl_minutes`).
- Janela de resume após abandono: **30 min**.
- Lock TTL: **30s** (auto-released em finally; se request crashar, próximo tick libera após TTL).
- Multi-intent: nova intent **encerra antiga como `superseded`** e abre nova (sem erro pro usuário).
- Flows sem handler retornam `failed` graciosamente com `unknown_action_type` (documentado em Entrega C).

Se algum default não servir, me diga antes; senão sigo com este escopo hardened.
