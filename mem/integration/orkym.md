---
name: ORKYM Integration Contract
description: Server-to-server bridge from MoodPlay to external ORKYM intelligence API. Contract, secrets, hooks, fail-safe behaviour.
type: feature
---

## Architectural rule
MoodPlay implements ZERO local intelligence. All reasoning, ranking, scoring, recommendation and prediction is delegated to ORKYM via `invokeOrkym`. MoodPlay only: builds context, calls, registers, displays.

## Secrets (server-side only)
- `ORKYM_API_BASE_URL` — base URL of ORKYM API
- `ORKYM_SERVICE_TOKEN` — bearer token server-to-server
- `ORKYM_HMAC_SECRET` — optional, signs `request_id + body`
- `ORKYM_TIMEOUT_MS` — default 8000

Without secrets the bridge runs in **degraded mode**: `ok:false, degraded:true`, app never breaks.

## Bridge endpoint
Edge function `orkym-invoke` (verify_jwt=true). Flow: auth → validate → secrets check → dedup → rate-limit (60/min/tenant) → fetch ORKYM with timeout → retry 5xx (max 2, backoff 200/800ms) → ingest tasks → log to `orkym_api_calls`.

## Outbound contract
POST `${ORKYM_API_BASE_URL}/invoke`
```json
{
  "request_id": "uuid",
  "correlation_id": "uuid",
  "domain": "arena_operations|finance|tournaments|growth",
  "action": "string",
  "tenant_id": "uuid",
  "arena_id": "uuid|null",
  "payload": { "context": {}, "entity": {}, "metadata": {} }
}
```
Headers: `Authorization: Bearer <token>`, `X-Request-Id`, `X-Tenant-Id`, optional `X-HMAC-Signature: hex(hmac_sha256(secret, request_id+body))`.

## Inbound contract (response)
```json
{
  "ok": true,
  "tasks": [{"title": "...", "description": "...", "priority": 1|2|3, "task_type": "..."}],
  "suggestions": [{"id": "...", "title": "...", "body": "...", "cta": {"label": "...", "href": "..."}}],
  "alerts": [{"id": "...", "severity": "info|warning|critical", "title": "...", "body": "..."}],
  "meta": {}
}
```

## Hooks (where MoodPlay calls ORKYM)
- `ArenaDashboard` mount → `arena_operations.daily_briefing`
- `orkym-cron-tick` (every ~15min) → batched events from `arena_operational_events`
- Future: post-publish tournament, post-marketplace order

## Tasks output
ORKYM `tasks[]` are inserted in `arena_operational_tasks` via SECURITY DEFINER `orkym_ingest_tasks` with `source='orkym'` and `correlation_id` linking back to the call log.

## Audit & metrics
- `orkym_api_calls` — sanitized request/response summaries (PII removed)
- `v_orkym_metrics` — per-day aggregated KPIs
- `/admin/orkym` — monitor UI

## Fail-safe rules
- Bridge ALWAYS returns HTTP 200 (errors carry `degraded:true`)
- Client wrapper never throws; consumer checks `ok` and `degraded`
- Dedup TTL 5min prevents accidental loops
- Retry only for 5xx and timeouts; never for 4xx
- Sensitive keys redacted in logs: `password, cpf, email, phone, whatsapp, token, *_secret`
