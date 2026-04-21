

# Fase 11.6 — Company / Sponsor / Marketplace Profile (UX-only)

> **Princípio**: zero banco, zero edge, zero RLS, zero ORKYM. Reorganizar `/company/*` em um perfil comercial e promocional unificado. Toda rota legacy (`/sponsor/*`, `/marketplace/my-company`, `/admin/ad-campaigns`) permanece intacta.

---

## Diagnóstico atual

- `CompanyShell` montado em `/company` (Fase 11.1) mas é um redirector pobre: `marketplace`/`produtos`/`pedidos` apontam todos para o **mesmo** `MyCompany` (page única monolítica de 342 linhas), e `campanhas`/`performance` reutilizam `SponsorDashboard` (que depende de `useOutletContext` do `SponsorLayout` — **vai quebrar** quando renderizado dentro de `CompanyShell` sem provider de contexto).
- Sidebar atual tem 3 grupos genéricos com nomes técnicos misturados ("Sponsor Dashboard").
- Não existe página `CompanyDashboard` própria.
- Lógica já espalhada: `MyCompany` (loja+produtos+pedidos+plano), `SponsorDashboard` (patrocínios métricas), `SponsorTournaments` (browse torneios), `AdminAdCampaigns` (ad_campaigns/ad_slots — admin-only hoje).

---

## 1. Os 5 blocos do Company Dashboard

Nova página `src/pages/company/CompanyDashboard.tsx` (única tela nova — wrapper de leitura, fetch próprio de `companies` por `owner_user_id`):

```text
┌─────────────────────────────────────────────────────────────┐
│ HEADER — "Company Control Tower" + nome + plano + status ↻  │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 1 — COMPANY CONTROL TOWER (DOMINANTE)                 │
│ ├─ KPIs: Produtos ativos · Pedidos 30d · Campanhas ativas · │
│ │   Patrocínios · Views totais · Cliques totais             │
│ └─ Strip alertas (sem produtos · plano vencendo · pendentes)│
├─────────────────────────────────────────────────────────────┤
│ BLOCO 2 — MARKETPLACE                                       │
│ ├─ Top 5 produtos · status · estoque                        │
│ ├─ Últimos 5 pedidos (status, valor)                        │
│ └─ Atalhos: Gerenciar produtos · Pedidos · Ver loja pública │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 3 — CAMPANHAS / ADS                                   │
│ ├─ Campanhas ativas (ad_campaigns filtradas por company_id) │
│ ├─ Patrocínios ativos (tournament_sponsorships)             │
│ └─ Atalhos: Ver patrocínios · Patrocinar torneio            │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 4 — PERFORMANCE                                       │
│ ├─ Receita 30d (sum marketplace_orders) · Ticket médio      │
│ ├─ Views/clicks agregados (sponsorships + ad_campaigns)     │
│ └─ Top produto · Top patrocínio                             │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 5 — VISIBILIDADE / DISCOVERY                          │
│ ├─ Link público da loja · presença no marketplace_public    │
│ └─ Atalhos: Ver no Explore · Ver no Marketplace · Feed      │
└─────────────────────────────────────────────────────────────┘
```

**Queries (todas já existem)**:
- `companies` (owner_user_id) + `company_plans`
- `products` (company_id)
- `marketplace_orders` (filtro por seller via products)
- `ad_campaigns` (company_id) — query já em `AdminAdCampaigns`
- `tournament_sponsorships` (company_id) — query já em `SponsorDashboard`

**Helpers locais** (não exportados): `SectionHeader`, `KpiCard`, `ShortcutLink` — coerência com Fases 11.2/11.3/11.4/11.5.

---

## 2. Rotas (aditivas) em `App.tsx`

Reorganizar bloco `/company` corrigindo o uso quebrado de `SponsorDashboard`:

```text
<Route path="/company" element={<CompanyShell />}>
+ <Route index element={<Navigate to="/company/dashboard" replace />} />
+ <Route path="dashboard" element={<CompanyDashboard />} />
  <Route path="marketplace" element={<MyCompany />} />        /* mantém */
  <Route path="produtos" element={<MyCompany />} />           /* mantém */
  <Route path="pedidos" element={<MyCompany />} />            /* mantém */
+ <Route path="campanhas" element={<CompanyDashboard />} />   /* âncora #campanhas */
+ <Route path="performance" element={<CompanyDashboard />} /> /* âncora #performance */
+ <Route path="visibilidade" element={<CompanyDashboard />} />/* âncora #visibilidade */
  <Route path="torneios-patrocinados" element={<SponsorTournaments />} /> /* será removido, ver §3 */
</Route>
```

**Correção crítica**: `campanhas` e `performance` hoje montam `SponsorDashboard`/`SponsorTournaments` que usam `useOutletContext` do `SponsorLayout` → erro silencioso. Substituir por âncoras no `CompanyDashboard`.

`torneios-patrocinados` é mantido mas precisa **wrapper que injete `company`** — ver §3.

---

## 3. Wrapper para reuso seguro de telas Sponsor

Para evitar quebra do `useOutletContext`, criar **um único wrapper local** dentro de `CompanyDashboard.tsx` (ou inline na rota) que busca `companies` por `owner_user_id` e re-renderiza `SponsorTournaments`/`SponsorDashboard` injetando `company` via Outlet context.

Alternativa mais simples (escolhida): criar `src/pages/company/CompanySponsorBridge.tsx` (~30 linhas) que carrega `company` e usa `<Outlet context={{ company }} />` apenas quando o usuário acessa `/company/torneios-patrocinados`. Rotas:

```text
+ <Route path="/company/sponsor" element={<CompanySponsorBridge />}>
+   <Route path="torneios" element={<SponsorTournaments />} />
+   <Route path="resumo" element={<SponsorDashboard />} />
+ </Route>
```

Sidebar passa a apontar para `/company/sponsor/torneios`. Rota antiga `/company/torneios-patrocinados` é **mantida** mas internamente também passa pelo bridge.

---

## 4. Nova `CompanySidebar` (5 grupos comerciais)

Reescrever `src/layouts/sidebars/CompanySidebar.tsx`:

| Grupo | Itens | Destino |
|---|---|---|
| **Control Tower** | Dashboard | `/company/dashboard` |
| **Marketplace** | Minha empresa · Produtos · Pedidos · Ver loja pública | `/company/marketplace` · `produtos` · `pedidos` · `/marketplace` |
| **Campanhas** | Visão geral · Patrocinar torneio · Meus patrocínios | `/company/campanhas` · `/company/sponsor/torneios` · `/company/sponsor/resumo` |
| **Performance** | Resultados | `/company/performance` |
| **Visibilidade** | Como apareço · Explore · Feed | `/company/visibilidade` · `/explore` · `/feed` |

Ícones: `LayoutDashboard`, `Store`, `Package`, `ShoppingBag`, `ExternalLink`, `Megaphone`, `Trophy`, `LineChart`, `Eye`, `Compass`, `Rss`.

---

## 5. Polimento `CompanyShell`

`src/layouts/CompanyShell.tsx` — trocar legenda "Empresa" por "Empresa · Mood Play" + buscar nome da empresa para exibir no header (1 query simples, mesmo padrão de `SponsorLayout`). Guard intacto.

---

## 6. Convergência opcional `ProfileSwitcher`

Atalho `company`/`empresa` aponta para `/company/dashboard` (1 linha).

---

## 7. Naming

| Antes | Depois |
|---|---|
| Header "Empresa" | "Empresa · Mood Play" |
| "Minha Empresa" | "Minha empresa" |
| "Sponsor Dashboard" | "Visão de patrocínios" |
| "Métricas" | "Resultados" |
| "Torneios Patrocinados" | "Patrocinar torneio" |
| (não existia) | "Como apareço" |

---

## 8. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/pages/company/CompanyDashboard.tsx` (~300 linhas, leitura) |
| Novo | `src/pages/company/CompanySponsorBridge.tsx` (~30 linhas, Outlet context bridge) |
| Edit | `src/App.tsx` — reorganizar bloco `/company` + adicionar `/company/sponsor/*` |
| Edit | `src/layouts/sidebars/CompanySidebar.tsx` — reescrever em 5 grupos |
| Edit | `src/layouts/CompanyShell.tsx` — relabel header + nome da empresa |
| Edit | `src/components/feed/ProfileSwitcher.tsx` — 1 linha (atalho company) |
| Memory | `mem/features/company-commercial-profile.md` (novo) |

**Total**: 2 arquivos novos, 4 edits mínimos, 1 memory.

---

## 9. Garantias de não-regressão

- `/marketplace/my-company`, `/marketplace`, `/marketplace/cart`, `/marketplace/checkout` — intocados.
- `/sponsor/*` (legacy SponsorLayout) — intocado.
- `/admin/ad-campaigns` — intocado.
- `/company/marketplace`, `/company/produtos`, `/company/pedidos`, `/company/torneios-patrocinados` — continuam respondendo.
- **Bug fix bônus**: rotas `/company/campanhas` e `/company/performance` que hoje quebram silenciosamente (faltando outlet context) passam a funcionar.
- Nenhuma migration, RLS, edge ou tipo Supabase novo.

---

## 10. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Reaproveitado | `MyCompany`, `SponsorDashboard`, `SponsorTournaments`, queries de `companies`/`products`/`marketplace_orders`/`ad_campaigns`/`tournament_sponsorships`, padrão visual das Fases 11.2–11.5 |
| Reorganizado | Sidebar de 3 grupos genéricos → 5 grupos comerciais; index do `/company` aponta para dashboard; bridge para reuso seguro de telas sponsor |
| Renomeado | "Sponsor Dashboard" → "Visão de patrocínios"; "Métricas" → "Resultados"; novos labels: "Como apareço", "Patrocinar torneio" |
| Deixou de parecer genérico | Control Tower no topo com KPIs reais de receita/pedidos/campanhas; separação clara entre marketplace/campanhas/visibilidade |
| Bug fix | Corrigido reuso quebrado de `SponsorDashboard` em `/company/campanhas` (faltava outlet context) |

## 11. ENTREGA C — Pendências

- **11.7**: rota dedicada `/company/produtos` separada de `MyCompany` (split do componente monolítico)
- **11.8**: rota dedicada `/company/pedidos` com tabela completa + filtros
- **11.9**: criação de campanhas direto pela empresa (hoje só admin via `AdminAdCampaigns`)
- **11.10**: WhatsApp para empresa (alerta de pedido novo, campanha pausada, plano vencendo)
- **11.11**: gráficos de performance 30d/90d (depende de view agregada nova)
- **11.12**: deprecar `/sponsor/*` legacy via redirect 301 → `/company/sponsor/*`
- **11.13**: deprecar `/marketplace/my-company` legacy via redirect → `/company/marketplace`

## 12. Critério de sucesso

- ✅ `/company/dashboard` mostra os 5 blocos (Control Tower dominante)
- ✅ Empresa entende rapidamente: vendas, campanhas, performance, visibilidade
- ✅ Sidebar reflete missão "perfil comercial e promocional"
- ✅ Reuso de `SponsorDashboard`/`SponsorTournaments` funciona (bug do outlet context corrigido)
- ✅ Todas as rotas legacy continuam funcionando
- ✅ Zero migration, zero edge, zero RLS, zero ORKYM bridge alterado

