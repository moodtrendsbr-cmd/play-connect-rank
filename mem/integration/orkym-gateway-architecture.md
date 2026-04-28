---
name: ORKYM-as-Gateway Architecture (consolidated)
description: Single source of truth mapping the 12 spec items to where each lives in the codebase. Read this first when touching the integration layer.
type: feature
---

# ORKYM-as-Gateway Architecture

**Principle**: ORKYM decides, MoodPlay executes. Zero AI/decision logic in MoodPlay.

## Spec → Implementation map

| Spec area | Tables | RPCs | Edge functions | Frontend |
|---|---|---|---|---|
| 1. Instance routing | `whatsapp_instances`, `whatsapp_bindings` | `resolve_whatsapp_instance`, `resolve_whatsapp_instance_by_phone` | — | `AdminWhatsAppInstances`, `AdminWhatsAppBindings`, `TenantWhatsAppRouting` |
| 2. Identity resolution | `wa_identities`, `wa_leads`, `wa_qr_tokens` | `resolve_whatsapp_identity`, `wa_register_identity`, `wa_verify_identity`, `wa_consume_qr_token` | `wa-bridge` (inbound) | `WaIdentityPanel`, `QrEntryCard` |
| 3. Execution bridge | — | reuses 19 RPCs (read/operational/proposal) | `moodplay-execute-action` (HMAC+TS+idempotency) | — |
| 4. Event feedback | `security_audit_log`, `conversational_commands` | — | response payload from `moodplay-execute-action` | `CommandStatusBadge` |
| 5. Command history | `conversational_commands` | — | persisted by `moodplay-execute-action` and `wa-bridge` | `CommandHistoryCard` (Realtime) |
| 6. Proactive opt-in | `orkym_proactive_eligibility` | — | (consumed by ORKYM externally) | — |
| 7. Fallback hierarchy | `whatsapp_bindings.priority` + `is_global_fallback` | `resolve_whatsapp_instance` chain: arena → organizer → company → tenant → profile_type → global | — | — |
| 8. Security | `security_audit_log` | cross-tenant validation inside handlers | HMAC SHA-256 + 5min skew + idempotency in `moodplay-execute-action` | — |
| 9. Dashboard reflection | `conversational_commands` (Realtime publication) | — | — | `*Commands.tsx` pages for every role |
| 10. No local AI | enforced by code review | shared handlers in `_shared/orkym-handlers.ts` are pure execution wrappers | — | — |

## Key invariants

- **Single execution surface**: only `moodplay-execute-action` accepts ORKYM calls. Anything else (no `wa-send-message`, no `wa-delivery-webhook`).
- **Single handler module**: `supabase/functions/_shared/orkym-handlers.ts` is shared by `orkym-execute-action` (internal proposal flow) and `moodplay-execute-action` (external ORKYM flow). Never duplicate.
- **HMAC secret**: `ORKYM_HMAC_SECRET` (legacy `ORKYM_SERVICE_TOKEN` accepted).
- **Outbound is ORKYM's job**: MoodPlay never sends WhatsApp messages. It only returns `response_summary` strings that ORKYM may relay.
- **Audit everywhere**: every phase of every call writes a `security_audit_log` row.

## Tests
`supabase/functions/moodplay-execute-action/{hmac_test.ts, integration_test.ts}` — 11 tests covering ping, missing/skewed timestamp, invalid HMAC, malformed JSON, missing action_type, and success path. Run via `supabase--test_edge_functions`.

## When to update this file
- New action_type added to the catalog → update `mem://integration/orkym-contract.md` AND keep the count in this file accurate.
- New routing scope (e.g., per-modality bindings) → update tables column.
- Anything that breaks the "ORKYM decides, MoodPlay executes" rule → STOP and reconsider.
