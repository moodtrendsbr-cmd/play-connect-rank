---
name: ORKYM ↔ MoodPlay execution contract
description: Public HTTP contract for the ORKYM brain to call moodplay-execute-action server-to-server.
type: reference
---

# ORKYM Execution Contract (Phase 12.6 — ORKYM-as-Gateway)

**Endpoint**: `POST {SUPABASE_URL}/functions/v1/moodplay-execute-action`
**Healthcheck**: `GET {SUPABASE_URL}/functions/v1/moodplay-execute-action?ping=1` → returns `{ok, version, supported_actions[]}`. No HMAC required.

> **Architectural rule**: ORKYM owns the WhatsApp channel (inbound parsing AND outbound dispatch). MoodPlay only exposes this single endpoint to receive execution calls. There is no `wa-send-message` or `wa-delivery-webhook` in MoodPlay anymore.

## Required headers
- `Content-Type: application/json`
- `X-MoodPlay-Signature` — HMAC-SHA256 hex of raw body using shared secret `ORKYM_HMAC_SECRET` (legacy alias `ORKYM_SERVICE_TOKEN` still accepted)
- `X-Request-Timestamp` — ms epoch; **mandatory**, rejected if skew > 5 min
- `X-Idempotency-Key` — uuid (recommended)

> All non-ping requests MUST include valid HMAC + timestamp. There is no mock mode.

## Body
```json
{
  "tenant_id": "uuid|null",
  "arena_id": "uuid|null",
  "user_id": "uuid|null",
  "profile_type": "athlete|organizer|arena|company|tenant|admin",
  "action_type": "<see catalog>",
  "payload": { "...": "action-specific" },
  "source": "orkym_whatsapp|orkym_proactive|orkym_api",
  "correlation_id": "uuid"
}
```

## Action catalog

### Read-only (executed immediately)
| action_type | payload |
|---|---|
| `get_arena_summary` | — |
| `list_today_classes` | — |
| `list_pending_enrollments` | — |
| `get_revenue_today` | — |
| `get_athlete_ranking` | `{athlete_id?, modality?}` |
| `list_today_matches` | — |
| `get_athlete_performance` | `{athlete_id?, period_days?}` |
| `get_tournament_standings` | `{tournament_id}` |
| `list_upcoming_classes` | `{days?}` |

### Operational (mutates DB via existing RPCs)
`generate_billing_cycle`, `mark_cycle_paid`, `validate_checkin`, `create_tournament`, `create_class`.

### Proposal-based (auto-approved, dispatched via shared handlers)
`create_followup`, `create_reminder`, `create_occurrence`, `propose_manual_charge`, `flag_enrollment_attention`, `propose_promotion`, `schedule_operational_review`, `open_communication_thread`, `recovery_campaign_draft`.

## Response shape
```json
{
  "ok": true,
  "command_id": "uuid",
  "execution_status": "executed|failed|deduplicated|no_action",
  "linked_entity": { "type": "...", "id": "uuid" } | null,
  "checkout_link": "https://..." | null,
  "qr_link": "https://..." | null,
  "response_summary": "Texto curto para WhatsApp",
  "follow_up_actions": []
}
```

## Error codes
| Code | Meaning |
|---|---|
| `invalid_signature` | HMAC mismatch |
| `timestamp_required` | header missing |
| `timestamp_skew` | clock drift > 5 min |
| `invalid_json` | body parse failed |
| `action_type_required` | missing action_type |
| `cross_tenant_violation` | arena_id does not belong to tenant_id |
| `unknown_action_type` | action not in catalog |
| `command_insert_failed:*` | DB insert error |

## Identity & instance lookup (helper RPCs)
- `resolve_whatsapp_instance(tenant, arena, profile, organizer, company)` — chain: arena → organizer → company → tenant → profile_type → global fallback.
- `resolve_whatsapp_instance_by_phone(phone)` — used by ORKYM to know which instance received the message.
- `resolve_whatsapp_identity(wa_phone, instance_id?)` — returns `{user_id, profile_type, tenant_id, arena_id, verified, is_lead, available_profiles[]}`.

## Proactive eligibility
Table `orkym_proactive_eligibility` stores per-user opt-in flags. ORKYM checks this before sending `marketing` / `retention` outbound. `billing` / `operations` are transactional and bypass opt-in.

## Audit trail
Every phase writes to `security_audit_log`:
`received`, `executed`, `failed`, `no_action`, `deduplicated`. Each row has `action_type`, `source`, `correlation_id`, `linked_entity_type/id`.

## Example curl
```bash
BODY='{"tenant_id":"...","arena_id":"...","action_type":"get_arena_summary","correlation_id":"..."}'
TS=$(date +%s%3N)
SIG=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$ORKYM_HMAC_SECRET" -hex | awk '{print $2}')
curl -X POST "$SUPABASE_URL/functions/v1/moodplay-execute-action" \
  -H "Content-Type: application/json" \
  -H "X-MoodPlay-Signature: $SIG" \
  -H "X-Request-Timestamp: $TS" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d "$BODY"
```
