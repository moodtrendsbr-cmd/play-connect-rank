

# Fase 11.1 — Reestruturação Segura: Layouts e Rotas por Perfil

> **Princípio inegociável**: nenhuma rota antiga sai do ar, nenhuma tela é apagada, nenhuma lógica core é alterada. Esta subfase é **100% UX/estrutura** — adiciona uma nova camada limpa por cima do que existe e usa **alias/redirects** para convergir navegação futura.

---

## 0. Estratégia "shell-only, zero-risk"

| Princípio | Como aplicamos |
|---|---|
| Não apagar nada | Toda rota antiga continua válida e funcional |
| Não duplicar lógica | Novos layouts apenas **renderizam Outlet** + sidebar; reusam páginas existentes |
| Convergência por alias | Rotas novas (`/athlete`, `/company`, `/tenant`) resolvem para componentes já usados via `<Route>` adicional ou `<Navigate>` |
| Sidebar isolada | Cada layout novo importa só ícones/itens do seu perfil |
| Resolver duplicação herdada | Remover bloco duplicado `/organizer` (linhas 192-200 de `App.tsx`) — único toque em código existente, sem mudança de comportamento |

---

## 1. Novos layouts (6 arquivos novos)

Todos seguem o mesmo template: `<SidebarProvider>` + `<AppSidebar>` próprio + `<Outlet/>`. Cada um faz seu próprio guard de role e não vaza menus de outros perfis.

| Arquivo (novo) | Role guard | Sidebar (grupos) |
|---|---|---|
| `src/layouts/AdminShell.tsx` | `userRole === 'admin'` | **Visão Global** (Dashboard, Analytics, Users, Tenants*), **Operação** (Tournaments, Enrollments, Arenas), **Marketplace** (Companies, Products, Sponsors, Sponsorships, Plans, Gifts, Ads, Ad-campaigns), **Financeiro** (Finances, Split-rules, Adjustments, Monetization), **ORKYM & Autonomia** (Monitor, Actions, Autonomy, Control Tower) |
| `src/layouts/TenantShell.tsx` | `useIsTenantAdmin()` | **Overview**, **Arenas**, **Organizadores/Membros**, **Empresas vinculadas**, **Financeiro**, **Branding & Domínios**, **Autonomia** |
| `src/layouts/ArenaShell.tsx` | `arenas.owner_user_id = user.id` (já feito em `ArenaLayout`) | **Control Tower** (Dashboard, Control-tower, Actions IA, Autonomia), **Operação** (Quadras, Horários, Reservas, Aulas, Matrículas, Ocorrências, Check-in), **Pessoas** (Alunos, Professores), **Financeiro** (Financeiro, Transações, Planos, Assinaturas, Cobranças), **Growth** (Torneios, Patrocínios) |
| `src/layouts/OrganizerShell.tsx` | `userRole === 'organizer'` | **Eventos** (Meus Torneios, Criar Torneio), **Inscrições**, **Jogos/Brackets**, **Financeiro** |
| `src/layouts/AthleteShell.tsx` | autenticado | **Meu Perfil**, **Torneios**, **Ranking**, **Mensagens** |
| `src/layouts/CompanyShell.tsx` | `companies.owner_user_id = user.id` | **Marketplace** (Minha Empresa, Produtos, Pedidos), **Campanhas** (Sponsor Dashboard, Sponsor Tournaments, Ad-campaigns vinculadas), **Performance** (métricas) |

`*Tenants` no Admin é só link futuro; não cria página agora.

> Localização: pasta `src/layouts/` nova. **Layouts antigos (`AdminLayout`, `OrganizerLayout`, `ArenaLayout`, `SponsorLayout`, `AppLayout`) permanecem intactos e continuam respondendo às rotas atuais.**

---

## 2. Nova estrutura de rotas (aditiva)

Adicionar **em paralelo** às rotas atuais, sem remover nenhuma. Cada nova rota aponta para a mesma página existente:

```text
/admin/*       → mantém AdminLayout atual + adiciona /admin/tenants (placeholder navega p/ /organizer/arenas)
/tenant/*      → NOVO; TenantShell renderiza páginas /organizer/* já existentes (settings, members, arenas, domains, finance, payment)
/arena/*       → /arena/dashboard mantém; /arena/* (sem /dashboard) ganha alias que redireciona p/ /arena/dashboard
/organizer/*   → mantém OrganizerLayout; bloco duplicado linhas 192-200 removido
/athlete/*     → NOVO; AthleteShell com sub-rotas que apontam para Profile, Tournaments, Ranking, Messages existentes
/company/*     → NOVO; CompanyShell com sub-rotas apontando para MyCompany, SponsorDashboard, SponsorTournaments existentes
```

### Tabela de rotas novas → páginas reusadas (zero código novo de página)

| Nova rota | Renderiza |
|---|---|
| `/athlete` | `<Navigate to="/athlete/perfil" />` |
| `/athlete/perfil` | `<Profile />` |
| `/athlete/torneios` | `<Tournaments />` |
| `/athlete/ranking` | `<Ranking />` |
| `/athlete/mensagens` | `<Messages />` |
| `/company` | `<Navigate to="/company/marketplace" />` |
| `/company/marketplace` | `<MyCompany />` |
| `/company/produtos` | `<MyCompany />` (mesma tela; ancora futura) |
| `/company/campanhas` | `<SponsorDashboard />` |
| `/company/torneios-patrocinados` | `<SponsorTournaments />` |
| `/tenant` | `<Navigate to="/tenant/overview" />` |
| `/tenant/overview` | `<OrganizerSettings />` (até ter dashboard próprio) |
| `/tenant/arenas` | `<OrganizerArenas />` |
| `/tenant/membros` | `<OrganizerMembers />` |
| `/tenant/financeiro` | `<OrganizerFinance />` |
| `/tenant/branding` | `<OrganizerSettings />` |
| `/tenant/dominios` | `<OrganizerDomains />` |
| `/tenant/pagamento` | `<OrganizerPayment />` |
| `/admin/tenants` | placeholder simples listando tenants via `<OrganizerArenas />` em modo read-only — opcional, só linka |

**Rotas antigas (`/profile`, `/marketplace/my-company`, `/sponsor/dashboard`, `/organizer/settings`, etc.) continuam ativas exatamente como hoje.**

---

## 3. ProfileSwitcher: convergência opcional

Mudar **um único atalho** em `ProfileSwitcher.tsx` (linha 267):
- `organizer` → de `/dashboard` para `/organizer` (já não tem efeito quebrador, hoje o legacy responde)
- `admin` → mantém `/admin`
- `arena` → mantém `/arena/dashboard`

`/dashboard` continua existindo (atletas comuns que caem nele veem MEUS TORNEIOS legacy — sem mudança).

---

## 4. Limpeza mínima permitida

Único toque em código existente:
- **`src/App.tsx` linhas 192-200**: remover bloco duplicado `/organizer`. O bloco 183-191 cobre 100% dos paths; remover o segundo é seguro (React Router pega o primeiro mesmo, mas é code smell óbvio).

Nenhuma outra alteração em arquivos existentes.

---

## 5. Arquivos tocados (resumo)

| Tipo | Arquivo |
|---|---|
| Novo | `src/layouts/AdminShell.tsx`, `TenantShell.tsx`, `ArenaShell.tsx`, `OrganizerShell.tsx`, `AthleteShell.tsx`, `CompanyShell.tsx` |
| Novo | `src/layouts/sidebars/` (6 arquivos `<Role>Sidebar.tsx`) |
| Edit | `src/App.tsx` — adicionar 6 blocos `<Route>` novos + remover bloco duplicado |
| Edit | `src/components/feed/ProfileSwitcher.tsx` — 1 linha (atalho organizer) |
| Memory | `mem/architecture/route-shells.md` (novo) — registra a estratégia "shell-only" |

**Total**: 13 arquivos novos, 2 arquivos minimamente editados.

---

## 6. Garantias de não-regressão

| Risco | Mitigação |
|---|---|
| Quebrar deep-link existente | Nenhuma rota antiga é removida ou renomeada |
| Confundir guard de role | Cada Shell faz seu próprio guard isolado, sem mexer nos guards atuais |
| Loop de redirect | Aliases novos (`/athlete`, `/company`, `/tenant`) só redirecionam para sub-rota dentro do próprio prefixo, nunca para rota antiga |
| Lógica de negócio afetada | Páginas reusadas como-são (`<Profile />`, `<MyCompany />` etc.) — zero diff comportamental |
| Layout antigo conflitar | Layouts antigos só respondem aos paths antigos; layouts novos só aos paths novos |

---

## 7. Critério de sucesso

- ✅ Todas as URLs antigas continuam funcionando idênticas (testar: `/dashboard`, `/profile`, `/admin`, `/arena/dashboard`, `/organizer/settings`, `/marketplace/my-company`, `/sponsor/dashboard`)
- ✅ 6 novas URLs raiz respondem (`/admin`, `/tenant`, `/arena`, `/organizer`, `/athlete`, `/company`)
- ✅ Cada Shell mostra apenas os menus do seu perfil
- ✅ Bloco duplicado de `/organizer` em `App.tsx` removido
- ✅ Zero edge function tocada, zero migration, zero RLS, zero ORKYM/policy/quota alterado
- ✅ Build passa, sem warnings novos

---

## 8. Fora desta subfase (próximas 11.x)

- **11.2**: criar `TenantDashboard` real (KPIs consolidados)
- **11.3**: hub Company unificado (substituir reuso de `MyCompany`+`SponsorDashboard` por hub novo)
- **11.4**: hub Athlete (`AthleteDashboard` com agenda + notificações)
- **11.5**: deprecar `/dashboard` legacy + `/sponsor/*` + `/marketplace/my-company` com redirects 301-like
- **11.6**: módulo `/admin/tenants` real
- **11.7**: agrupamento de nav da Arena (já com Shell, é mover itens)
- **11.8**: camada conversacional WhatsApp (transversal)

