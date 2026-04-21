---
name: ORKYM Action Proposals (Phase 8)
description: Controlled autonomy. ORKYM proposes executable actions; humans approve; system executes via existing flows; everything audited.
type: feature
---

## Modelo
SUGERIR (ORKYM) → APROVAR (humano) → EXECUTAR (edge function) → AUDITAR (proposals + executions + events).
Zero IA local. Zero auto-execução irreversível.

## Allowlist (9 action_types)
| action_type | Domain | Reuso |
|---|---|---|
| create_followup / create_reminder / schedule_operational_review / open_communication_thread / recovery_campaign_draft / flag_enrollment_attention | arena_operations | INSERT em `arena_operational_tasks` (source='orkym') |
| create_occurrence | arena_operations | INSERT em `arena_occurrences` (status='open') |
| propose_manual_charge | finance | RPC `arena_generate_billing_cycle` (cycle pending — não cobra) |
| propose_promotion | growth | INSERT em `ad_campaigns` (status='pending', aguarda admin) |

**Bloqueado** no ingest (silenciosamente): refund, cancel_payment, change_split, delete_*, suspend_user, force_*, automatic_charge.

## Permissões
- arena_owner: aprova/executa ações com `arena_id` próprio (exceto `propose_promotion`)
- tenant_admin: todas do tenant
- admin global: todas
- demais roles: nenhum acesso

## Tabelas
- `orkym_action_proposals` — lifecycle (proposed/approved/rejected/executing/executed/failed/expired/canceled). RLS: SELECT por role; INSERT/UPDATE bloqueado a clients.
- `orkym_action_executions` — append-only por tentativa.
- View `v_orkym_action_metrics` — agregado por dia/domain/action_type.

## RPCs
- `orkym_ingest_actions(jsonb)` — service role only, valida allowlist, sanitiza payload (remove password/cpf/email/phone/etc), dedup via UNIQUE `(orkym_request_id, action_type, related_entity_id)`.
- `orkym_action_approve(uuid)` / `orkym_action_reject(uuid, text)` — valida role + estado + expires_at.
- `orkym_action_mark_executing(uuid)` — CAS approved→executing (anti dupla execução).
- `orkym_action_mark_executed/failed` — service role only, append em executions.
- `orkym_action_expire_stale()` — cron diário.

## Edge functions
- `orkym-invoke` (extensão Phase 7): se response inclui `actions[]`, chama `orkym_ingest_actions` e retorna `actions_proposed`.
- `orkym-execute-action`: auth JWT → check permission → CAS mark_executing → handler dispatch → mark_executed/failed → emit event `orkym.action_executed` ou `.action_failed`.

## Idempotência tripla
1. UNIQUE no DB (orkym_request_id + action_type + related_entity_id)
2. Dedup ORKYM (Phase 7, `orkym_dedup`, TTL 5min)
3. CAS em `orkym_action_mark_executing` (UPDATE WHERE status='approved')

## Modo degradado
Se ORKYM cair: nenhuma nova proposta entra, mas propostas já existentes continuam aprováveis e executáveis (handlers só leem DB local).

## UI
- `OrkymActionsCard` — dashboard arena, max 3 propostas pendentes + link "Ver todas"
- `/arena/:slug/actions` — ArenaActions com tabs (Pendentes/Aprovadas/Executadas/Rejeitadas+Falhas)
- `/admin/orkym-actions` — AdminOrkymActions com métricas + tabela filtrada
- `ActionProposalDetail` — sheet mostrando apenas `human_summary` (NUNCA `proposed_payload` cru)
