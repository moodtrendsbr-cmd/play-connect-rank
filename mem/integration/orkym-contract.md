---
name: ORKYM ↔ MoodPlay execution contract
description: Public HTTP contract for the ORKYM brain to call moodplay-execute-action server-to-server.
type: reference
---

# ORKYM Execution Contract (Phase 12.6)

**Endpoint**: `POST {SUPABASE_URL}/functions/v1/moodplay-execute-action`
**Healthcheck**: `GET {SUPABASE_URL}/functions/v1/moodplay-execute-action?ping=1` → returns `{ok, version, supported_actions[]}`. No HMAC required.

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

## Error codes
| Code | Meaning |
|---|---|
| `invalid_signature` | HMAC mismatch |
| `timestamp_skew` | clock drift > 5 min |
| `cross_tenant_violation` | arena_id does not belong to tenant_id |
| `unknown_action_type` | action not in catalog |
| `command_insert_failed:*` | DB insert error |

## Outbound (proactive WhatsApp)
**Endpoint**: `POST {SUPABASE_URL}/functions/v1/wa-send-message`
Same HMAC headers. Body:
```json
{
  "to_phone": "5511...",
  "tenant_id": "uuid", "arena_id": "uuid|null", "user_id": "uuid|null",
  "message_type": "text|template",
  "body": "...",
  "template_name": "...", "template_vars": {...},
  "category": "billing|operations|retention|marketing",
  "correlation_id": "uuid",
  "initiated_by": "orkym"
}
```
Categories `marketing` and `retention` require `orkym_proactive_eligibility.opted_in = true` for the user.

## Delivery webhooks (provider → MoodPlay)
- Twilio: `POST /functions/v1/wa-delivery-webhook/twilio`
- Meta:   `POST /functions/v1/wa-delivery-webhook/meta` (also serves GET handshake `hub.verify_token = WA_META_VERIFY_TOKEN`)
- Evolution: `POST /functions/v1/wa-delivery-webhook/evolution` (header `apikey`)

Status updates are idempotent and never downgrade (`read` → `delivered` ignored).

## Required secrets per provider
- Twilio: `WA_TWILIO_ACCOUNT_SID`, `WA_TWILIO_AUTH_TOKEN`, `WA_TWILIO_FROM`
- Meta: `WA_META_TOKEN`, `WA_META_PHONE_NUMBER_ID`, `WA_META_APP_SECRET`, `WA_META_VERIFY_TOKEN`
- Evolution: `WA_EVOLUTION_BASE_URL`, `WA_EVOLUTION_API_KEY`

Per-instance overrides live in `whatsapp_instances.outbound_credentials` (jsonb).

## Example curl
```bash
BODY='{"tenant_id":"...","arena_id":"...","action_type":"get_arena_summary","correlation_id":"..."}'
TS=$(date +%s%3N)
SIG=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$ORKYM_SERVICE_TOKEN" -hex | awk '{print $2}')
curl -X POST "$SUPABASE_URL/functions/v1/moodplay-execute-action" \
  -H "Content-Type: application/json" \
  -H "X-MoodPlay-Signature: $SIG" \
  -H "X-Request-Timestamp: $TS" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d "$BODY"
```
