
# Phase 12.8 — Memory + Personalization Layer

**Princípio:** ORKYM é o cérebro. MoodPlay apenas **armazena, extrai deterministicamente e expõe** memória operacional estruturada. Zero IA local. Zero embeddings. Zero scoring complexo.

## Arquitetura

Tabela única genérica `conversational_memory` (não fragmentar por perfil — perfil vira coluna). Extração determinística via SQL (triggers + função periódica). API única para ORKYM consumir. Injeção opcional nos edge functions existentes.

---

## 1. Schema (1 migração)

### `conversational_memory`
```text
id uuid pk
tenant_id uuid not null              -- isolamento obrigatório
arena_id uuid null                   -- escopo opcional
user_id uuid null                    -- escopo opcional (atleta/aluno)
profile_type text not null           -- athlete|arena|organizer|company|tenant
entity_type text not null            -- 'user'|'arena'|'organizer'|'company'|'tenant'
entity_id uuid not null              -- a chave do dono da memória
memory_type text not null            -- 'preference'|'pattern'|'history'|'behavior'|'insight'
key text not null                    -- 'preferred_sport', 'preferred_time', 'top_product'…
value jsonb not null                 -- {value, label?, count?, samples?}
confidence numeric(3,2) not null default 0.50  -- 0.00..1.00
source text not null                 -- 'enrollments'|'bookings'|'commands'|'orders'|'events'|'manual'
sample_size int not null default 1
last_seen_at timestamptz default now()
expires_at timestamptz null          -- null = sem expiração
created_at timestamptz default now()
updated_at timestamptz default now()
unique (entity_type, entity_id, key)
```

Índices: `(tenant_id, profile_type)`, `(entity_type, entity_id)`, `(arena_id, key)`, `(expires_at)` parcial WHERE not null.

### `conversational_memory_events` (auditoria leve)
```text
id, tenant_id, memory_id (nullable), event_type ('created'|'updated'|'expired'|'used'),
context jsonb, created_at
```

### RLS
- `conversational_memory`: SELECT permitido a admin do tenant, dono do escopo (arena owner, company owner, organizer, próprio user). Sem INSERT/UPDATE direto pelo client — só funções `SECURITY DEFINER`.
- `conversational_memory_events`: SELECT só admin/owner; INSERT só via funções.

---

## 2. Extração determinística (SQL puro)

### RPCs SECURITY DEFINER
- `memory_upsert(_entity_type, _entity_id, _tenant, _arena, _user, _profile_type, _memory_type, _key, _value, _confidence, _source, _sample_size, _ttl_days)` — upsert com merge de `sample_size`/`last_seen_at` e re-cálculo de confidence (`min(0.99, 0.3 + sample_size*0.05)`).
- `memory_extract_athlete(_user_id)` — varre `enrollments`, `bookings`, `athlete_activities` dos últimos 180d e calcula:
  - `preferred_sport` (modalidade mais frequente, mín. 3 ocorrências)
  - `preferred_time_window` (faixa horária mais usada em bookings)
  - `preferred_arena` (arena com mais bookings/enrollments)
  - `level_category` (último `category` mais usado)
  - `enrollment_pattern` (`'last_minute'` | `'early_bird'` baseado em delta médio)
- `memory_extract_arena(_arena_id)` — varre 90d:
  - `idle_slot_pattern` (dia/hora com ocupação <30%)
  - `recurring_students` (top 10 alunos ativos)
  - `chronic_overdue_students` (>= 2 ciclos overdue)
  - `top_instructor` (mais aulas atendidas)
  - `low_occupancy_classes`
- `memory_extract_organizer(_organizer_user_id)`:
  - `frequent_tournament_type`, `frequent_categories`, `preferred_arenas`
- `memory_extract_company(_company_id)`:
  - `top_products` (top 5 por unidades), `best_campaign_type`
- `memory_extract_tenant(_tenant_id)`:
  - `top_arenas`, `recurring_issues` (de `arena_operational_events`), `orkym_usage_pattern`
- `memory_extract_all()` — orquestrador que itera entidades ativas (atletas com atividade últimos 60d, arenas ativas, etc.) e chama os extractors. Limita batch (ex: 200 entidades por chamada).

### Triggers leves (incrementais)
- `trg_memory_from_booking` AFTER INSERT em `bookings` (status confirmed) → bump `preferred_time_window` + `preferred_arena` do user.
- `trg_memory_from_enrollment` AFTER INSERT em `enrollments` → bump `preferred_sport` (modalidade) do atleta.
- `trg_memory_from_order` AFTER INSERT em `marketplace_orders` (status paid) → bump `top_products` da company.

Triggers chamam `memory_upsert` com `sample_size=1`. Confidence cresce naturalmente.

### Decay
- Função `memory_apply_decay()` chamada pelo `orkym-cron-tick`:
  - Marca `expires_at = now()` para memórias com `last_seen_at < now() - interval '180 days'`.
  - Insere evento `expired`.
  - Decrementa confidence em 0.05 quando `last_seen_at` > 60d (sem expirar ainda).

---

## 3. Edge function `moodplay-memory-context`

Path: `supabase/functions/moodplay-memory-context/index.ts` (`verify_jwt = false`, HMAC obrigatório igual a `moodplay-execute-action`).

**Request**:
```json
{
  "tenant_id": "uuid",
  "arena_id": "uuid?",
  "user_id": "uuid?",
  "company_id": "uuid?",
  "organizer_user_id": "uuid?",
  "profile_type": "athlete|arena|organizer|company|tenant",
  "context": "booking|billing|tournament|marketplace|growth|general",
  "max_items": 20
}
```

**Lógica**:
1. Verifica HMAC + timestamp (reusa helpers de `moodplay-execute-action`).
2. Resolve `entity_type`/`entity_id` pelo `profile_type`.
3. Filtra `conversational_memory` por entity + tenant + (opcional) `key` relevantes para `context`:
   - `booking` → time_window, arena, sport
   - `billing` → overdue patterns, recurring_students
   - `tournament` → preferred_sport, level_category, frequent_categories
   - `marketplace` → top_products, best_campaign
   - `growth` → tenant/arena patterns
   - `general` → tudo, ordenado por confidence
4. Ordena por `confidence DESC, last_seen_at DESC`, limita `max_items`.
5. Gera `summary` determinístico (template string em PT-BR concatenando top 3 chaves — sem LLM).
6. Registra `memory.used` em `conversational_memory_events`.

**Response**:
```json
{
  "ok": true,
  "memory_context": {
    "entity_type": "user",
    "entity_id": "...",
    "memories": [
      { "key": "preferred_sport", "value": {"value":"beach_tennis","count":7},
        "confidence": 0.78, "source": "enrollments",
        "last_seen_at": "..." }
    ],
    "summary": "Atleta costuma jogar beach tennis à noite na Arena Praia Grande."
  }
}
```

7. Falhas → `{ok:true, memory_context:null, degraded:true}` (nunca quebra ORKYM).

---

## 4. Injeção nos fluxos existentes

Sem reescrever lógica. Apenas anexar campo opcional `memory_context` na resposta:

- **`moodplay-execute-action`**: depois de resolver tenant/arena/user, chamar internamente `getMemoryContext()` (helper compartilhado em `_shared/memory.ts` que faz query direta — sem HTTP). Anexar `memory_context` ao response payload. Custo: 1 query.
- **`moodplay-session-step`**: idem ao iniciar/avançar sessão; injeta `memory_context` no snapshot da sessão.
- **`wa-bridge`**: ao resolver identidade, anexar `memory_context` no payload encaminhado para ORKYM.

ORKYM consome ou ignora — MoodPlay não muda seu comportamento.

Helper `_shared/memory.ts`:
```ts
export async function getMemoryContext(admin, params): Promise<MemoryContext|null>
```

---

## 5. Governança

- `confidence` recalculado a cada upsert: `min(0.99, 0.3 + log(sample_size+1)*0.15)`.
- `expires_at` opcional via `_ttl_days` no upsert.
- `memory_apply_decay()` no cron (já agendado em `orkym-cron-tick`).
- Eventos `created`/`updated`/`expired`/`used` em `conversational_memory_events`.
- Cap por entidade: máx 50 memórias ativas (extractor descarta as de menor confidence).

---

## 6. UI mínima de transparência

Componente `src/components/memory/MemoryTransparencyCard.tsx` (lista chave/valor/confidence/última atualização).

Aplicar em:
- `src/pages/Profile.tsx` (atleta) — seção "Preferências percebidas".
- `src/pages/arena-dashboard/ArenaDashboard.tsx` — card "Padrões da arena".
- `src/pages/organizer/OrganizerDashboard.tsx` — card "Padrões dos seus eventos".
- `src/pages/company/CompanyDashboard.tsx` — card "Padrões dos clientes".
- `src/pages/tenant/TenantDashboard.tsx` — card "Padrões da rede".

Hook `src/hooks/useMemoryContext.ts` que faz SELECT direto em `conversational_memory` (RLS protege). Sem botão de edição (governança automática). Toggle "ocultar" só visual.

---

## 7. Arquivos

**Migrações**:
- `supabase/migrations/<ts>_phase_12_8_memory_layer.sql` — tabelas, RLS, RPCs upsert/extract/decay, triggers.

**Edge functions**:
- `supabase/functions/moodplay-memory-context/index.ts`
- `supabase/functions/_shared/memory.ts` (helper para injeção)
- editar: `moodplay-execute-action/index.ts`, `moodplay-session-step/index.ts`, `wa-bridge/index.ts`, `orkym-cron-tick/index.ts` (chamar `memory_apply_decay` + `memory_extract_all` em cadence).

**Config**:
- `supabase/config.toml`: `[functions.moodplay-memory-context] verify_jwt = false`.

**Frontend**:
- `src/components/memory/MemoryTransparencyCard.tsx`
- `src/hooks/useMemoryContext.ts`
- editar 5 dashboards + Profile (1 import + 1 card cada).

**Testes**:
- `supabase/functions/moodplay-memory-context/integration_test.ts` — HMAC, escopo, isolamento entre tenants, degraded mode.

**Memória do projeto**:
- `mem/features/memory-personalization.md` (novo)
- atualizar `mem/integration/orkym-gateway-architecture.md` (linha 12.8)
- atualizar `mem/index.md` Core: "Memória operacional em `conversational_memory`. Extração determinística. ORKYM consome via `moodplay-memory-context`."

---

## 8. NÃO faremos
- Sem embeddings, sem vector search, sem LLM.
- Sem nova tabela por perfil (uma única `conversational_memory`).
- Sem armazenar conteúdo bruto de mensagens (só sinais agregados em `value` jsonb).
- Sem alterar lógica de `orkym-handlers.ts`.
- Sem expor memória cross-tenant.
- Sem permitir client-side INSERT/UPDATE direto.

---

## 9. Critério de sucesso (verificável)
- [ ] Tabela + RLS + RPCs criadas, migração roda limpa.
- [ ] Triggers populam memória após booking/enrollment/order.
- [ ] `memory_extract_all` roda no cron sem erro.
- [ ] `moodplay-memory-context` retorna `memory_context` correto por escopo, com HMAC válido.
- [ ] `moodplay-execute-action` anexa `memory_context` no response sem regredir os 11 testes existentes.
- [ ] UI mostra preferências em 5 dashboards + Profile.
- [ ] Isolamento por tenant validado em teste integration.
- [ ] Decay marca expiração corretamente.
- [ ] Zero código de IA/LLM/embedding adicionado.

Pronto para aprovação. Após aprovado executo: migração → edge function nova → helper compartilhado → injeção nos 3 edge functions → cron → UI → testes → memória.
