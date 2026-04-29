---
name: Memory + Personalization Layer (Phase 12.8)
description: Operational memory in conversational_memory; deterministic extraction; ORKYM consumes via moodplay-memory-context. Zero local AI.
type: feature
---

# Phase 12.8 — Memory & Personalization

**Princípio**: ORKYM cérebro, MoodPlay armazena memória estruturada. Sem IA/LLM/embeddings local.

## Tabelas
- `conversational_memory` — uma linha por (entity_type, entity_id, key). Campos: tenant_id, arena_id, user_id, profile_type, memory_type, value(jsonb), confidence(0..1), source, sample_size, last_seen_at, expires_at.
- `conversational_memory_events` — auditoria created/updated/expired/used/decayed.

## RLS
SELECT só para admin/tenant_admin/arena_owner/company_owner/organizer/próprio user. Sem INSERT/UPDATE client — apenas SECURITY DEFINER funcs.

## RPCs
- `memory_upsert(...)` — merge incremental; confidence = `min(0.99, 0.30 + ln(sample+1)*0.15)`.
- `memory_extract_athlete|arena|organizer|company|tenant(_id)` — varredura determinística (180/90/365d conforme).
- `memory_extract_all(_batch_size)` — orquestrador.
- `memory_apply_decay()` — −0.05 confidence se >60d sem ver; expira se >180d.

## Triggers
`bookings(confirmed)` → preferred_time_window, preferred_arena.
`enrollments(insert)` → preferred_sport.
`marketplace_orders(paid)` → top_products.

## Edge functions
- `moodplay-memory-context` (HMAC, verify_jwt=false) — ORKYM consulta `{tenant_id, profile_type, context, ...}` → `{memory_context: {entity_type, entity_id, memories[], summary}}` ou `{degraded:true}`.
- Helper `_shared/memory.ts:getMemoryContext()` — query direta usada por `moodplay-execute-action`, `moodplay-session-step`, `wa-bridge` para anexar `memory_context` nas respostas/forwards. Best-effort, nunca quebra.

## Cron
`orkym-cron-tick` chama `memory_apply_decay()` + `memory_extract_all(100)` a cada tick.

## UI
`src/components/memory/MemoryTransparencyCard.tsx` + `useMemoryContext` (RLS protege). Pode ser plugado em qualquer dashboard.

## Filtro por contexto
`booking|billing|tournament|marketplace|growth|general` mapeiam para subset de keys (CONTEXT_KEYS em `_shared/memory.ts`).
