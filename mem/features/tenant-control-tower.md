---
name: Tenant Control Tower (Phase 11.3)
description: /tenant/dashboard structured as 5 executive blocks for white-label network owners
type: feature
---

`/tenant/dashboard` (component `src/pages/tenant/TenantDashboard.tsx`) is the executive cockpit for a white-label network owner. UX-only reorganization — zero new tables, zero edge functions, zero RLS changes, zero new ORKYM logic.

## 5 blocks (top → bottom)

1. **Control Tower (dominant)** — KPI grid: arenas total/active · organizadores · receita 30d · chamadas IA · auto-execuções · alertas abertos. Strip de alertas (kill switch / quota limit / overdue).
2. **Rede** — top 5 arenas + counts (organizadores, empresas) + atalhos.
3. **Monetização** — receita total/liquidado/a receber (canonical balance) + últimas 5 transações + atalhos.
4. **Operações** — KPIs (torneios ativos, ocorrências, overdue) + lista de `arena_operational_events` recentes.
5. **IA / Autonomia** — `UsageMeter` x3 (calls/suggestions/auto) + políticas ativas + status kill switch.

## Reused queries (zero new)

- `tenants` via `useTenant()`
- `arenas` filtered by `tenant_id`
- `tenant_memberships` filtered by `tenant_id`
- `companies` count by `tenant_id`
- `v_organizer_balances_canonical` for owner revenue
- `transaction_splits` (top 5 of owner)
- `arena_operational_events` last 8 (network)
- `tournaments` count by arena name (legacy string match — pendência 11.6)
- `arena_occurrences` open count
- `arena_billing_cycles` overdue count
- `fetchTenantTier()` + `fetchUsageSummary()` from `@/lib/autonomyTier`
- `autonomy_policies` enabled count + `autonomy_kill_switches` active

## Routing

- `/tenant` → redirect to `/tenant/dashboard` (was `/tenant/overview`)
- `/tenant/dashboard` → new TenantDashboard
- `/tenant/overview` → kept for back-compat (renders `OrganizerSettings`)
- All other `/tenant/*` routes untouched

## Sidebar (6 groups, executive hierarchy)

Control Tower · Rede · Monetização · Operações · IA / Autonomia · Configurações

Renames: "Membros" → "Organizadores", "Pagamento" → "Conta de pagamento", "Identidade" → "Configurações", "Tenant" header → "Rede white-label".
