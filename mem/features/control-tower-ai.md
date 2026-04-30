---
name: Control Tower AI (Phase H)
description: Read-only synthesis layer (health score + alerts + opportunities + NBA) over existing Phase 8/9/G data. Decisions/exec via ORKYM only.
type: feature
---

# Phase H — Control Tower AI

Camada de **síntese executiva** sobre dados existentes. Zero IA local, zero tabelas novas, zero edge function nova.

## RPC única
`public.control_tower_summary(_scope_type text, _scope_id uuid) → jsonb`
- `SECURITY INVOKER` — RLS dos dados-fonte controla acesso.
- Escopos: `admin | tenant | arena | organizer | company`.
- Lê apenas: `tournaments`, `enrollments`, `financial_transactions`, `bookings`, `court_availability`, `xp_events`, `orkym_action_proposals`, `orkym_triggers_queue`, `orkym_revenue_attribution`, `growth_budgets`.

## Health score (0–100)
Média ponderada dos sub-scores disponíveis (pesos renormalizados quando faltam dados):
- `enrollment` 0.25 — pagas/capacidade torneios futuros/ativos
- `revenue` 0.25 — 7d vs 7d anteriores (50 = estável, cap 0..100)
- `occupancy` 0.20 — bookings pagos vs slots disponíveis 14d (admin/tenant/arena)
- `engagement` 0.15 — DAU 7d / MAU 30d via xp_events (admin/tenant/arena)
- `orkym_adoption` 0.15 — (auto+approved)/total proposals 30d

## Saída
```json
{
  "health_score": 0..100|null,
  "sub_scores": { ... },
  "alerts": [{severity, kind, title, body}],
  "opportunities": [{id, kind, title, impact}],
  "recommendations": [{id, title, action_type, trigger_id, impact, effort}],
  "next_best_action": <reco com max(impact-effort)>
}
```

## Catálogo
- **Alerts**: `low_enrollment_tournament`, `revenue_drop` (now/prev<0.7), `budget_exhausted` (≥90%).
- **Opportunities**: vêm de `orkym_triggers_queue` pendente (já deduplicado por Phase G).
- **Recommendations** mapeiam triggers para a allowlist Phase G:
  - `tournament_low_enrollment → tournament_boost`
  - `inactive_athlete → reactivation_message`
  - `near_rank_up → send_proactive_message`
  - `idle_court_slot → fill_idle_slots`

## Frontend (UX 100% não-técnica)
- `src/hooks/useControlTowerSummary.ts` — chama RPC, polling 60s.
- `src/components/control-tower/ControlTowerAIPanel.tsx` — título **"Visão geral"** (sem "AI"/Sparkles). Blocos: Saúde do negócio, O que precisa de atenção, O que fazer agora.
- `src/lib/controlTowerCopy.ts` — mapeia `action_type`/`kind` para rótulo + frase humana. **Nunca** expor "ORKYM", "IA", "decisão", `action_type`, `impact`, `effort`. Sub-score `orkym_adoption` é **omitido** da UI (segue calculado no backend).
- `src/components/control-tower/HealthScoreBadge.tsx` — utilitário visual.
- Mounts (topo): AdminControlTower, TenantDashboard, ArenaControlTower, OrganizerDashboard, CompanyDashboard.

## CTA humano (1 problema → 1 botão → 1 clique → execução real)
Botão usa rótulo de `copyForAction(action_type)` (ex.: "Divulgar torneio", "Preencher horário"). Internamente chama a edge function **`control-tower-execute`** com `{ scope, recommendation }`. Esta função:
1. Resolve `tenant_id`/`arena_id` a partir do `scope` + permissão (`is_admin`/`is_tenant_admin`/`is_arena_owner`/owner de company).
2. Verifica kill-switch em `autonomy_kill_switches` (global/tenant/arena/action_type).
3. Para ações com orçamento (`tournament_boost`, `create_campaign`, `product_boost`, `company_boost`) chama `growth_check_budget` → bloqueia se zerado e registra `growth_record_spend` ao final.
4. Cria `orkym_action_proposals` em modo `auto` (idempotente via `orkym_request_id = ct:<tenant>:<arena>:<action_type>:<entity_id>:<YYYY-MM-DDTHH>`).
5. Despacha via `dispatchAction` (handlers compartilhados em `_shared/orkym-handlers.ts` — ver tabela abaixo).
6. Marca `executed/auto_executed=true` e registra `arena_operational_events` (`event_type='control_tower.action_executed'`).

Estados visíveis: `Iniciando…` → `Em andamento…` (após 800 ms) → `Concluído` (CheckCircle2). Toasts: success com frase humana de `controlTowerCopy.feedback`; bloqueio (kill-switch/budget/no_targets/already_running) → "Tudo já está sob controle por agora."; erro → "Não conseguimos agora. Tente novamente em instantes." Nunca expor reason ao usuário.

### Mapa action_type → execution flow (em `_shared/orkym-handlers.ts`)
| action_type | Fluxo |
|---|---|
| `tournament_boost` | INSERT `ad_campaigns(kind='tournament_highlight', status='active', target_type='tournament')` + queue `relevant_tournament` |
| `create_campaign` | INSERT `ad_campaigns(kind='feed_highlight')` |
| `product_boost` | INSERT `ad_campaigns(kind='marketplace_highlight', target_type='product')` |
| `company_boost` | INSERT `ad_campaigns(kind='arena_highlight', target_type='arena')` |
| `fill_idle_slots` | queue `idle_court_slot` (arena required) |
| `reactivation_message` | queue `inactive_athlete` |
| `send_proactive_message` | queue `<payload.trigger_type>` (default `relevant_tournament`) |
| `recommend_product` | queue `top_product` |
| `upsell_plan` | queue `relevant_tournament` |

`ad_campaigns.kind` permitidos hoje: `feed_highlight | tournament_highlight | arena_highlight | marketplace_highlight` — handlers mapeiam os action_types Phase G/M para esses kinds. `company_id` faz fallback para a primeira `companies` do tenant quando não vem no payload.

## Hard rules
- Nunca decidir/personalizar localmente; conteúdo de mensagem é decidido por ORKYM no consumo da queue (`orkym-proactive-process`).
- Nunca gerar mensagem fora de `wa-send-message`.
- Nunca bypass de opt-in/cooldown/budget — guardrails atuais são autoritativos.
- Sem novas tabelas. Apenas uma nova edge function (`control-tower-execute`) que reusa handlers existentes.
