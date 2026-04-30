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

## Frontend
- `src/hooks/useControlTowerSummary.ts` — chama RPC, polling 60s.
- `src/components/control-tower/ControlTowerAIPanel.tsx` — 4 blocos: score+sub-scores, alerts, opportunities, NBA com CTA "Executar via ORKYM".
- `src/components/control-tower/HealthScoreBadge.tsx` — utilitário visual.
- Mounts (topo): AdminControlTower, TenantDashboard, ArenaControlTower, OrganizerDashboard, CompanyDashboard.

## CTA "Executar via ORKYM"
Chama `invokeOrkym('growth','decide', { entity:{trigger_id, entity_type, entity_id}, context:{source:'control_tower_ai', action_type} })`.
ORKYM cria proposta em `orkym_action_proposals`, que segue o pipeline existente (eligibility, guardrails, budget, autonomia).

## Hard rules
- Nunca decidir/personalizar localmente; sempre via `orkym-invoke`.
- Nunca gerar mensagem fora de `wa-send-message`.
- Nunca bypass de opt-in/cooldown/budget — guardrails atuais são autoritativos.
- Sem novas tabelas, sem novas edge functions, sem ML.
