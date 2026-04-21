

# Fase 7 — ORKYM Full: Conexão de Produção + Operations Deepening

Ativar a ORKYM como camada real de inteligência via API server-to-server. **Zero IA local.** MoodPlay monta contexto, chama, registra, exibe — nada decide.

---

## 0. Auditoria — reuso

| Existe | Decisão |
|---|---|
| `orkym-invoke` (placeholder 501) | Reescrever para chamar API externa real |
| `src/lib/orkym.ts` (wrapper supabase.functions.invoke) | Estender com tipos canônicos de payload/response |
| `arena_operational_events` (trilha bruta + `processed_at`) | Fonte de eventos — ORKYM consome via backlog |
| `arena_operational_tasks` (open/done/dismissed, source `manual`/`orkym`/`system`) | Sink de output da ORKYM — sem mudanças estruturais |
| Dashboard "Caixa de pendências" | Já lê tasks com badge ORKYM — apenas adicionar seção "Sugestões/Alertas" |

---

## 1. Secrets (necessários antes da implementação)

Solicitar ao usuário via `add_secret`:
- `ORKYM_API_BASE_URL` — base da API ORKYM (ex: `https://api.orkym.com/v1`)
- `ORKYM_SERVICE_TOKEN` — bearer token server-to-server
- `ORKYM_HMAC_SECRET` — opcional, para assinatura adicional dos requests
- `ORKYM_TIMEOUT_MS` — opcional, default 8000

Sem estes secrets, `orkym-invoke` permanece em modo `degraded` (retorna `ok:false, degraded:true`, app não quebra).

---

## 2. Migration — estrutura mínima

`supabase/migrations/<ts>_phase7_orkym_integration.sql`:

### 2.1 Tabela `orkym_api_calls` (log auditável)
```
id uuid PK, request_id text NOT NULL, correlation_id text,
tenant_id uuid, arena_id uuid,
domain text NOT NULL, action text NOT NULL,
http_status int, status text CHECK IN ('success','failed','timeout','degraded','rate_limited'),
duration_ms int,
request_summary jsonb,    -- payload sanitizado (sem PII pesada)
response_summary jsonb,   -- response sanitizado
error_message text,
retried_count int DEFAULT 0,
created_at timestamptz DEFAULT now()
```
INDEX `(tenant_id, created_at DESC)`, `(domain, action, created_at DESC)`, `(status, created_at DESC)`.
RLS: SELECT só admin + tenant_admin. INSERT só via SECURITY DEFINER (edge function via service role).

### 2.2 Tabela `orkym_dedup` (anti-loop / debounce)
```
id uuid PK, dedup_key text UNIQUE NOT NULL,    -- hash(domain|action|entity_id|window)
tenant_id uuid, expires_at timestamptz NOT NULL,
created_at timestamptz DEFAULT now()
```
INDEX `(expires_at)`. Cleanup via RPC `orkym_purge_dedup()`.

### 2.3 RPC `orkym_ingest_tasks(_payload jsonb)`
SECURITY DEFINER, chamada **apenas** por `orkym-invoke` (com service role). Recebe `tasks[]` da resposta ORKYM e faz INSERT em `arena_operational_tasks` com `source='orkym'`, mapeando `priority`, `correlation_id` em metadata.

### 2.4 ALTER `arena_operational_tasks` ADD `correlation_id text`, `metadata jsonb DEFAULT '{}'`
Já tem `source` — só falta correlação com chamada ORKYM.

### 2.5 View `v_orkym_metrics` (observabilidade simples)
Agrega `orkym_api_calls` por dia/domain: total, success, failed, avg_duration. SELECT admin + tenant_admin.

---

## 3. Edge Function `orkym-invoke` — reescrita completa

Fluxo:
```
1. CORS + auth (getClaims) — JWT do usuário MoodPlay
2. Valida body: { domain, action, payload: { tenant_id, arena_id?, context?, entity?, metadata? } }
3. Verifica secrets ORKYM_* — se faltam → retorna { ok:false, degraded:true } + log status='degraded'
4. Verifica dedup: gera dedup_key, consulta orkym_dedup; se existe → retorna { ok:true, deduped:true }
5. Verifica rate-limit por tenant (in-memory simples + log) — 60 calls/min/tenant
6. Gera request_id (uuid) + correlation_id (do body ou novo)
7. Monta headers: Authorization Bearer ORKYM_SERVICE_TOKEN, X-Request-Id, X-Tenant-Id, X-HMAC (opcional)
8. fetch ORKYM com AbortController + timeout (ORKYM_TIMEOUT_MS)
9. Retry: max 2 retries para 5xx/timeout, com backoff exponencial (200ms, 800ms). Nunca retry para 4xx.
10. Parse response (espera contrato: { ok, tasks?, suggestions?, alerts?, meta? })
11. Se tasks[] presente: chama RPC orkym_ingest_tasks com service role
12. Insere orkym_dedup (TTL 5min default)
13. INSERT orkym_api_calls com sumário sanitizado
14. Retorna { ok, tasks_created, suggestions, alerts, meta, request_id }
```

Em caso de erro (timeout, 5xx pós-retries, parse fail):
- Retorna `{ ok:false, degraded:true, error: <safe_msg>, request_id }` com **HTTP 200** (app não trata como falha crítica)
- Loga em `orkym_api_calls` com status apropriado

**Service role client** criado dentro da função para `orkym_ingest_tasks` e `orkym_api_calls` INSERT (via `SUPABASE_SERVICE_ROLE_KEY`).

---

## 4. Frontend `src/lib/orkym.ts` — tipos canônicos

```typescript
export type OrkymDomain = "arena_operations" | "finance" | "tournaments" | "growth";

export interface OrkymPayload {
  tenant_id: string;
  arena_id?: string;
  context?: Record<string, unknown>;
  entity?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface OrkymTask { title: string; description?: string; priority?: 1|2|3; task_type?: string; related_entity_type?: string; related_entity_id?: string; }
export interface OrkymSuggestion { id: string; title: string; body: string; cta?: { label: string; href?: string }; }
export interface OrkymAlert { id: string; severity: "info"|"warning"|"critical"; title: string; body?: string; }

export interface OrkymResponse {
  ok: boolean;
  degraded?: boolean;
  deduped?: boolean;
  tasks_created?: number;
  suggestions?: OrkymSuggestion[];
  alerts?: OrkymAlert[];
  meta?: Record<string, unknown>;
  request_id?: string;
  error?: string;
}

export async function invokeOrkym(domain: OrkymDomain, action: string, payload: OrkymPayload): Promise<OrkymResponse>
```

Wrapper trata `degraded:true` silenciosamente (sem toast de erro), apenas loga em console.

---

## 5. Context Resolver `src/lib/orkymContext.ts` (novo)

Funções helper que **lêem do banco** (não decidem nada) e montam context blocks reutilizáveis:

- `buildArenaOperationsContext(arenaId)` → alunos ativos, aulas próximas, presença 7d, billing pending/overdue, ocorrências abertas, eventos não processados
- `buildFinanceContext(tenantId, arenaId?)` → transações 30d, splits pendentes, billing cycles, refunds recentes
- `buildTournamentsContext(tournamentId)` → enrollments, categorias, brackets, check-ins
- `buildGrowthContext(tenantId)` → ads ativos, top produtos, atividades recentes do feed

Cada uma retorna jsonb pronto para injetar em `payload.context`. Sem ranking, sem score — apenas dados crus organizados.

---

## 6. Hooks operacionais (triggers de chamada)

Adicionar ganchos que chamam `invokeOrkym` em pontos-chave (não automático em DB — chamado do client/edge para manter controle):

| Hook | Onde | Quando | Domain.action |
|---|---|---|---|
| Dashboard load | `ArenaDashboard.tsx` | mount + pull-to-refresh | `arena_operations.daily_briefing` |
| Aluno faltou 3+ vezes | edge function `orkym-evaluate-attendance` (cron diário) | scheduled | `arena_operations.absent_pattern` |
| Mensalidade overdue | trigger DB já emite event → cron lê backlog | a cada 1h | `finance.overdue_review` |
| Torneio publicado | `ManageTournament.tsx` post-publish | on action | `tournaments.launch_review` |
| Marketplace order | já tem trigger event → cron processa | a cada 30min | `growth.purchase_signal` |

Edge function nova `orkym-cron-tick`: roda a cada 15min, lê `arena_operational_events` com `processed_at IS NULL`, agrupa por arena+domain, chama `orkym-invoke` em batch, marca eventos como `processed_at=now()`. Configurar via Supabase cron extension.

---

## 7. Dashboard — seção "ORKYM Insights"

Em `ArenaDashboard.tsx`, abaixo de "Caixa de pendências":

**Card novo "Sugestões da ORKYM"** — chama `invokeOrkym("arena_operations","daily_briefing",ctx)` no mount, exibe `suggestions[]` e `alerts[]` retornados como cards compactos. Status visíveis:
- 🟢 Conectada (última call success < 1h)
- 🟡 Degradada (últimas 3 calls failed/timeout)
- 🔴 Offline (sem secrets)

Ações por card: "Aceitar" (cria task via RPC), "Dispensar". Sem chat, sem livre texto.

**Página nova `/admin/orkym`** — `AdminOrkymMonitor.tsx`: tabela `orkym_api_calls` últimas 100, filtros por domain/status, card de métricas (total, success rate, avg duration) lendo `v_orkym_metrics`. Apenas leitura.

---

## 8. Contrato API ORKYM (documentado em memory)

**Request** (POST `${ORKYM_API_BASE_URL}/invoke`):
```json
{
  "request_id": "uuid",
  "correlation_id": "uuid|null",
  "domain": "arena_operations",
  "action": "daily_briefing",
  "tenant_id": "uuid",
  "arena_id": "uuid|null",
  "payload": { "context": {...}, "entity": {...}, "metadata": {...} }
}
```
Headers: `Authorization: Bearer <token>`, `X-Request-Id`, `X-Tenant-Id`, `Content-Type`, `X-HMAC-Signature` (opcional).

**Response esperada**:
```json
{
  "ok": true,
  "tasks": [{ "title": "...", "description": "...", "priority": 2, "task_type": "absent_pattern" }],
  "suggestions": [{ "id": "...", "title": "...", "body": "...", "cta": {...} }],
  "alerts": [{ "id": "...", "severity": "warning", "title": "..." }],
  "meta": { "model_version": "...", "latency_ms": 450 }
}
```

**Códigos de erro tratados**: 401 (auth) → degraded; 429 → log rate_limited + skip; 5xx → retry; timeout → log timeout + degraded.

---

## 9. Segurança

- Secrets nunca expostos no client. `invokeOrkym` no client passa só JWT do usuário; orkym-invoke (server) injeta service token.
- HMAC opcional: header `X-HMAC-Signature: hex(hmac_sha256(ORKYM_HMAC_SECRET, request_id+body))`.
- Sanitização de payload em logs: remove campos prefixados `_secret`, `password`, `cpf`, `email`, `phone` antes de gravar `request_summary`/`response_summary`.
- Rate-limit por tenant: 60 calls/min (in-memory + check em `orkym_api_calls`).
- Anti-loop: dedup TTL 5min por `(domain, action, entity_id ou hash(payload))`.

---

## 10. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase7_orkym_integration.sql` |
| Edge function | `supabase/functions/orkym-invoke/index.ts` (reescrita), `supabase/functions/orkym-cron-tick/index.ts` (novo) |
| Frontend lib | `src/lib/orkym.ts` (estendido), `src/lib/orkymContext.ts` (novo) |
| Frontend novo | `src/pages/admin/AdminOrkymMonitor.tsx`, `src/components/orkym/InsightsCard.tsx`, `src/components/orkym/StatusBadge.tsx` |
| Frontend edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` (+InsightsCard), `src/pages/admin/AdminLayout.tsx` (+rota), `src/App.tsx` (+rota) |
| Memory | `mem/integration/orkym.md` (novo — contrato, secrets, hooks, fail-safe) |

**Total**: 1 migration + 2 edge functions + 1 lib nova + 3 componentes + 4 edits.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| ORKYM plugada em | dashboard arena (briefing), cron de eventos, post-publish torneio, post-order marketplace |
| Eventos disparadores | mount dashboard, cron 15min sobre `arena_operational_events`, ações pontuais |
| Contexto montado por | `buildArenaOperationsContext`, `buildFinanceContext`, `buildTournamentsContext`, `buildGrowthContext` |
| Auth | JWT user → orkym-invoke → service token → ORKYM (+ HMAC opcional) |
| Timeout/retry/fallback | 8s timeout, 2 retries 5xx, degraded mode silencioso |
| Logs | `orkym_api_calls` (sumário sanitizado) + view `v_orkym_metrics` |
| Domains ativos | `arena_operations`, `finance`, `tournaments`, `growth` |

---

## ENTREGA C — Riscos / Próximos passos

**Síncrono nesta fase** (assíncrono futuro):
- `daily_briefing` no mount do dashboard (pode atrasar render — mitigado por degraded silencioso)
- Cron tick processando backlog (15min — pode crescer; mover para fila SQS/PgMQ depois)

**Pendente Fase 8+**:
- Auto-actions com aprovação (hoje só sugere/cria task — humano executa)
- Streaming de respostas ORKYM (hoje request/response simples)
- Schema de validação Zod compartilhado MoodPlay↔ORKYM via npm package
- Métricas de impacto (sugestões aceitas, ROI por domain) — base já existe
- Particionamento de `orkym_api_calls` quando volume > 1M
- Webhook reverso ORKYM → MoodPlay (eventos push, não só pull)
- Chat operacional integrado

**Compatibilidade**:
- Sem ORKYM secrets, app funciona normal — só não recebe sugestões
- Sem quebra de fluxos existentes
- `arena_operational_tasks.source='manual'` continua funcionando

**Critérios de sucesso**:
- ✅ orkym-invoke chama API externa real com auth server-to-server
- ✅ Contexto rico montado por helpers tipados
- ✅ Tasks ORKYM aparecem na caixa de pendências (badge Bot)
- ✅ Dashboard mostra Sugestões/Alertas com status de conectividade
- ✅ Logs auditáveis em `orkym_api_calls` com sanitização
- ✅ Timeout/retry/dedup/rate-limit implementados
- ✅ Modo degradado silencioso — app nunca quebra
- ✅ Zero IA local; toda decisão é da ORKYM

