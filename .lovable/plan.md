

# Fase 11.3 — Tenant Control Tower (UX-only)

> **Princípio**: zero banco, zero edge, zero RLS, zero ORKYM. Apenas reorganização de `/tenant/*` em uma central executiva da rede, reusando queries e componentes já existentes. Toda rota legacy (`/organizer/*`) permanece intacta.

---

## 1. Os 5 blocos do Tenant Dashboard

Nova página `src/pages/tenant/TenantDashboard.tsx` (única tela nova — wrapper de leitura, sem lógica de negócio):

```text
┌───────────────────────────────────────────────────────────────┐
│ HEADER — "Control Tower da Rede" + nome tenant + tier + ↻     │
├───────────────────────────────────────────────────────────────┤
│ BLOCO 1 — CONTROL TOWER (DOMINANTE)                           │
│ ├─ KPI grid: Arenas total · Arenas ativas · Receita 30d ·     │
│ │   Chamadas ORKYM 30d · Auto-actions 30d · Alertas abertos   │
│ └─ Strip de alertas (kill switch / limite quota / overdue)    │
├───────────────────────────────────────────────────────────────┤
│ BLOCO 2 — REDE                                                │
│ ├─ Lista resumida de arenas (top 5 por atividade) [reuso]     │
│ ├─ Mini-stats: organizadores · empresas vinculadas            │
│ └─ Atalhos: Ver arenas · Membros · Empresas                   │
├───────────────────────────────────────────────────────────────┤
│ BLOCO 3 — MONETIZAÇÃO                                         │
│ ├─ Receita total · Liquidado · A receber (canonical balance)  │
│ ├─ Últimas 5 transações [reuso de OrganizerFinance queries]   │
│ └─ Atalhos: Financeiro · Pagamento                            │
├───────────────────────────────────────────────────────────────┤
│ BLOCO 4 — OPERAÇÕES                                           │
│ ├─ Eventos operacionais recentes (arena_operational_events)   │
│ ├─ Torneios ativos da rede                                    │
│ └─ Ocorrências abertas (agregadas)                            │
├───────────────────────────────────────────────────────────────┤
│ BLOCO 5 — AUTONOMIA / IA                                      │
│ ├─ UsageMeter (calls/suggestions/auto) [reuso]                │
│ ├─ Status kill switch · policies ativas (count)               │
│ └─ Atalho: IA / Autonomia                                     │
└───────────────────────────────────────────────────────────────┘
```

**Queries (todas já existentes)**:
- `tenants` (já no contexto via `useTenant()`)
- `arenas` filtrado por `tenant_id`
- `tenant_memberships` filtrado por `tenant_id`
- `companies` (count)
- `v_organizer_balances_canonical` para receita do owner
- `transaction_splits` (top 5)
- `arena_operational_events` últimos 10 (filtro `tenant_id`)
- `tournaments` ativos por arena_id da rede
- `arena_occurrences` open
- `fetchTenantTier(tenantId)` + `fetchUsageSummary(tenantId)` de `@/lib/autonomyTier`
- `autonomy_policies` count + `tenants.kill_switch_active`

Nenhuma query nova; tudo já é chamado em `OrganizerFinance`, `ArenaControlTower`, `AdminControlTower` ou `ArenaDashboard`.

**Helpers locais ao arquivo** (não exportados, ~10 linhas cada): `SectionHeader`, `KpiCard`, `ShortcutLink` — mesmo padrão da Arena Control Tower (Fase 11.2) para coerência visual.

---

## 2. Rota nova (aditiva)

Em `src/App.tsx`, dentro do bloco `<Route path="/tenant">`:

```text
+ <Route path="dashboard" element={<TenantDashboard />} />
  <Route index element={<Navigate to="/tenant/dashboard" replace />} />  ← muda destino do index
  <Route path="overview" element={<OrganizerSettings />} />              ← mantém para back-compat
  ... (todas as outras rotas /tenant/* permanecem)
```

`/tenant/overview` segue funcionando (back-compat). `/tenant` agora abre o dashboard executivo.

---

## 3. Sidebar reorganizada (`src/layouts/sidebars/TenantSidebar.tsx`)

Reordenar grupos para refletir a hierarquia executiva:

| Grupo | Itens |
|---|---|
| **Control Tower** | Dashboard (`/tenant/dashboard`) |
| **Rede** | Arenas · Organizadores (membros) · Empresas |
| **Monetização** | Financeiro · Splits (alias → `/admin/split-rules` se admin, senão oculto) · Pagamento |
| **Operações** | Eventos (link para `/tenant/dashboard#operacoes` âncora) — sem rota nova |
| **IA / Autonomia** | Autonomia |
| **Configurações** | Branding · Domínios |

> Itens "Splits" e "Operações" hoje não têm página dedicada — viram **âncoras dentro do dashboard** (scroll para o bloco) ou redirecionam para tela existente quando houver. Sem rota nova, sem tela nova. Itens cujo destino não existe ficam listados mas levam ao dashboard com âncora.

**Renomes (apenas labels)**:
- "Membros" → "Organizadores"
- "Pagamento" → "Conta de pagamento"
- "Autonomia" → "IA / Autonomia"
- "Identidade" (grupo) → "Configurações"

---

## 4. Header do TenantShell

Pequeno polimento em `src/layouts/TenantShell.tsx` (sem mudar guard nem layout):
- Trocar legenda "Tenant" por "Rede white-label"
- Adicionar badge tier (lido via `fetchTenantTier`) ao lado do nome — **opcional**, só se trivial; senão fica no dashboard apenas.

---

## 5. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/pages/tenant/TenantDashboard.tsx` (~280 linhas, wrapper de leitura) |
| Edit | `src/App.tsx` — adicionar rota `dashboard` + redirecionar index |
| Edit | `src/layouts/sidebars/TenantSidebar.tsx` — reorganizar grupos + relabel + adicionar Dashboard |
| Edit | `src/layouts/TenantShell.tsx` — relabel header (1 string) |
| Memory | `mem://features/tenant-control-tower` (novo) — registra estrutura dos 5 blocos |

**Total**: 1 arquivo novo, 3 edits mínimos, 1 memory.

---

## 6. Garantias de não-regressão

- Todas as rotas `/tenant/*` antigas continuam (`overview`, `arenas`, `membros`, `financeiro`, `branding`, `dominios`, `pagamento`, `autonomia`).
- Todas as rotas `/organizer/*` legacy intocadas.
- Nenhuma migration, nenhuma mudança de RLS, nenhum import novo de tipos.
- Componentes reusados sem alteração: `Card`, `Badge`, `Button`, `UsageMeter`, `UpgradeCTA`, `Alert`.
- Build TS limpo (mesmo padrão de cast `as any` para views já em uso no projeto).

---

## 7. ENTREGA B — Relatório (resumo final)

| Item | Resultado |
|---|---|
| Reaproveitado | `useTenant`, `fetchTenantTier`, `fetchUsageSummary`, `UsageMeter`, queries de OrganizerFinance/ArenaControlTower, padrão visual da Fase 11.2 |
| Reorganizado | sidebar do TenantShell em 6 grupos executivos; index do `/tenant` aponta para dashboard |
| Renomeado | "Tenant" → "Rede white-label"; "Membros" → "Organizadores"; "Identidade" → "Configurações" |
| Melhor agrupado | KPIs da rede no topo dominante; monetização e IA visíveis sem clique; operações agregadas |
| Para subfases | Dashboard executivo é leitura — edição continua nas telas atuais |

## 8. ENTREGA C — Pendências para próximas subfases

- **11.4**: Hub Company unificado (marketplace + sponsor + plano)
- **11.5**: Hub Athlete (`/athlete/dashboard` com agenda + notificações)
- **11.6**: módulo `/admin/tenants` (admin gere todos os tenants)
- **11.7**: rota dedicada `/tenant/operacoes` com timeline real
- **11.8**: WhatsApp para tenant (briefing semanal da rede + alertas de overdue agregado)
- **11.9**: gráfico de evolução 30d/90d da rede (depende de view agregada nova — fase futura com migration)

## 9. Critério de sucesso

- ✅ `/tenant/dashboard` mostra os 5 blocos executivos
- ✅ Tenant entende rapidamente: tamanho da rede, receita, IA, operações
- ✅ ORKYM/Autonomia visíveis no dashboard
- ✅ Sidebar com hierarquia executiva (Control Tower no topo)
- ✅ Todas rotas antigas funcionam
- ✅ Zero migration, zero edge, zero RLS, zero ORKYM bridge alterado

