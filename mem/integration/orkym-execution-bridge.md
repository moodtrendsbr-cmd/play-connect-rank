---
name: ORKYM Execution Bridge (Phase 12.5)
description: Server-to-server bridge ORKYM ↔ MoodPlay, instance routing, identity resolution and proactive outbound layer.
type: feature
---

# ORKYM Execution Bridge

MoodPlay exposes a **server-to-server execution surface** so ORKYM can operate the platform without going through the WhatsApp inbound webhook. ORKYM remains the brain; MoodPlay only resolves context, executes, and returns feedback.

## Routing hierarchy
`resolve_whatsapp_instance(tenant, arena, profile, organizer, company)` returns an instance applying the priority chain:
1. Arena-specific binding
2. Organizer-specific binding
3. Company-specific binding
4. Tenant-wide binding
5. Profile_type binding
6. Global fallback (`is_global_fallback = true`)

`resolve_whatsapp_instance_by_phone(phone)` is used by inbound webhooks (wa-bridge) to identify which instance received the message.

## Identity resolution
`resolve_whatsapp_identity(wa_phone, instance_id)` returns `{user_id, profile_type, tenant_id, arena_id, verified, is_lead, identity_id}`. Unknown phones return `is_lead: true` so ORKYM can run a capture flow.

## Execution bridge — `moodplay-execute-action`
- Auth: HMAC `X-MoodPlay-Signature` (env `MOODPLAY_BRIDGE_SECRET`) + bearer `ORKYM_SERVICE_TOKEN`.
- Replay protection: `X-Request-Timestamp` (5min window) + `X-Idempotency-Key`.
- Payload: `{ tenant_id, arena_id, user_id, profile_type, action_type, payload, source, correlation_id }`.
- Cross-tenant validation: arena must belong to tenant; user must have membership/role.
- Reuses `_shared/orkym-handlers.ts` (extracted from `orkym-execute-action`); zero new business logic.
- Returns: `{ ok, command_id, execution_status, linked_entity, checkout_link?, qr_link?, response_summary, follow_up_actions[] }`.

### Action catalog
- **ORKYM proposal handlers** (reused): `create_followup`, `create_reminder`, `create_occurrence`, `propose_manual_charge`, `flag_enrollment_attention`, `propose_promotion`, `schedule_operational_review`, `open_communication_thread`, `recovery_campaign_draft`.
- **Operational wrappers**: `create_tournament`, `create_class`, `generate_billing_cycle`, `mark_cycle_paid`, `validate_checkin`.
- **Read-only RPCs**: `get_arena_summary`, `list_today_classes`, `list_pending_enrollments`, `get_revenue_today`.

## Outbound — owned by ORKYM
ORKYM is the WhatsApp gateway. MoodPlay does NOT dispatch outbound messages
and does NOT receive delivery callbacks. The legacy `wa-send-message` and
`wa-delivery-webhook` Edge Functions were removed. MoodPlay still maintains
`orkym_proactive_eligibility` (opt-in flags) which ORKYM consults before
sending marketing/retention messages.

## Command history
`conversational_commands` now carries `direction`, `whatsapp_instance_id`, `linked_entity_type`, `linked_entity_id`, `normalized_input`, `initiated_by`. Realtime subscription in `CommandHistoryCard` reflects both inbound and ORKYM-initiated executions.

## What is NOT in MoodPlay
- No NLU / decision engine
- No upsell / campaign logic
- No proactive scheduling / cron decisions
- No template authoring
ORKYM owns all of those. MoodPlay only provides routing, identity, execution, and audit trails.

## Pending (future phases)
- Multi-binding per scope (12.7).
- Webhook reverso ORKYM → MoodPlay para eventos assíncronos longos (futuro).

## Phase 12.6 additions

- `resolve_whatsapp_identity` now returns `available_profiles[]` aggregating
  user_roles + arenas/tenants/companies owned by the user, with `is_default`
  flag. Lets ORKYM offer in-chat profile switching aliases.
- Use `resolveIdentity(phone, instanceId?)` from `src/lib/wa.ts` (returns
  `ResolvedIdentity` with `available_profiles`).
- `moodplay-execute-action` writes to `security_audit_log` for every phase:
  `received`, `executed`, `failed`, `no_action`, `deduplicated`. Each record
  includes `action_type`, `source`, `correlation_id` and (when relevant)
  `linked_entity_type/id`.
- Deno tests cover the full contract: 4 unit (HMAC determinism, body change,
  skew rejection, valid window) + 7 integration (ping, missing timestamp,
  skew, invalid signature, malformed JSON, missing action_type, success path).
  All 11 green as of Phase 12.6 close.
- Expanded read-only catalog (Phase 12.8) shipped: `get_athlete_ranking`,
  `list_today_matches`, `get_athlete_performance`, `get_tournament_standings`,
  `list_upcoming_classes`.
