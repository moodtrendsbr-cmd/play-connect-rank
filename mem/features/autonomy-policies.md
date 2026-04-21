---
name: Autonomy Policies (Phase 9)
description: Camada oficial de políticas SUGGEST/APPROVE/AUTO sobre as Action Proposals (Fase 8). Resolver central, guardrails, kill switches, fallback seguro = approve. Zero IA local.
type: feature
---

## Modelo
SUGGEST → APPROVE → AUTO. Cada action proposta pela ORKYM passa pelo `autonomy_resolve_policy` ANTES de virar proposta executável.

## Tabelas
- `autonomy_policies` — escopo (global/tenant/arena), domain, action_type, mode, risk, conditions, priority. CHECK garante coerência scope↔ids.
- `autonomy_kill_switches` — emergency stop por escopo (global/tenant/arena/domain/action_type). Quando ativo força mode=`suggest`.
- `autonomy_policy_logs` — auditoria de cada decisão (proposal_id, resolved_mode, policy_id, source, guardrail_blocked).
- `orkym_action_proposals` ganhou: `execution_mode`, `policy_id`, `policy_source`, `auto_executed`, `initial_status`.
- View `v_autonomy_metrics` (security_invoker) — agrega por dia/tenant/action_type.

## Precedência (resolver)
1. kill_switch ativo aplicável → `suggest` + `kill_switch`
2. arena + action_type
3. arena + domain
4. tenant + action_type
5. tenant + domain
6. tenant catch-all
7. global + action_type
8. global + domain
9. fallback hardcoded → `approve`

## Risk map (hardcoded em `autonomy_action_risk`)
- low: create_followup, create_reminder, schedule_operational_review, open_communication_thread
- medium: create_occurrence, flag_enrollment_attention, recovery_campaign_draft, propose_manual_charge
- high: propose_promotion
- critical: refund/cancel_payment/change_split/delete_*/suspend_user (bloqueados no ingest da Fase 8)

## Guardrails (`autonomy_check_guardrails`, só quando mode=`auto`)
- risk high/critical → block
- blocklist hardcoded → block
- max 10 auto-execs/h por (tenant, action_type)
- max 30 auto-execs/h por tenant
- cooldown 60s mesmo (action_type, related_entity_id)
- conditions.max_amount > payload.amount → block
- conditions.allowed_hours `[start,end]` fora da janela → block

Bloqueio NÃO falha — rebaixa para `approve` e loga `guardrail_blocked`.

## Ingest (`orkym_ingest_actions` extendido)
1. Allowlist + blocklist hardcoded
2. Resolve policy → mode/policy_id/source
3. Se mode=auto: guardrails. Se bloqueia → mode=approve + source=`guardrail_block`
4. Status inicial: suggest→`canceled`, approve→`proposed`, auto→`approved` (auto_executed=false)
5. INSERT proposal + log

## RLS
- `autonomy_policies` SELECT: admin, tenant_admin (tenant + global), arena_owner (arena + tenant pai + global)
- INSERT/UPDATE: admin (tudo); tenant_admin (tenant/arena do seu tenant); arena_owner (apenas scope=arena própria, NUNCA mode=`auto` para risk≥high)
- `autonomy_kill_switches`: idem, sem distinção de mode
- `autonomy_policy_logs`: SELECT mesmo padrão; INSERT só via SECURITY DEFINER

## UI
- `/admin/autonomy` — AdminAutonomy: Tabs Políticas / Kill Switches / Métricas (7d) / Logs
- `/arena/dashboard/autonomia` — ArenaAutonomy: políticas próprias + herdadas read-only + botão "Pausar autonomia desta arena"
- `PolicyDecisionBadge` — mostra mode + tooltip com source. Ícone ⚡ quando `auto_executed=true`.
- `KillSwitchPanel` — ativos + histórico, com botões emergency global / tenant / arena.

## Compatibilidade Fase 8
- Sem policies → fallback retorna `approve` para tudo (comportamento idêntico).
- Propostas legadas → backfill `execution_mode='approve'`, `policy_source='legacy'`.
- `OrkymActionsCard` segue filtrando `status='proposed'` — auto-executadas não poluem fila.

## NÃO permitido nesta fase
- Mode `auto` para `propose_manual_charge`, `propose_promotion` ou qualquer high/critical (rebaixado por guardrail mesmo se policy tentar).
- Auto-refund, auto-cancel, mudança de split via autonomia.
- IA local — toda decisão de proposta vem da ORKYM.

## Cron
- `autonomy_purge_old_logs()` — limpeza diária de logs > 90d.
