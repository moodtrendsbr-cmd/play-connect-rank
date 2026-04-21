---
name: Route Shells (Phase 11.1)
description: Estratégia "shell-only, zero-risk" — 6 novos layouts por perfil em src/layouts/ e prefixos /admin /tenant /arena /organizer /athlete /company que reusam páginas existentes via alias, sem remover rotas antigas
type: feature
---

A Fase 11.1 introduziu uma camada paralela de layouts e rotas por perfil **sem remover nada do que já existia**.

**Layouts novos** (em `src/layouts/`):
- `AdminShell` — guard `userRole === 'admin'`
- `TenantShell` — guard `useIsTenantAdmin()` + tenant resolvido
- `ArenaShell` — guard autenticado (paridade com `ArenaLayout`)
- `OrganizerShell` — guard `userRole IN ('organizer','admin')`
- `AthleteShell` — guard autenticado
- `CompanyShell` — guard autenticado

Cada Shell usa `SidebarProvider` + `<RoleSidebar/>` em `src/layouts/sidebars/` e contém apenas itens do próprio perfil — sem vazar menus.

**Rotas novas** (aditivas em `App.tsx`):
- `/admin/*` reusa AdminShell em paralelo ao AdminLayout antigo (ainda ativo)
- `/tenant/*` mapeia para páginas `/organizer/*` existentes (`OrganizerSettings`, `OrganizerArenas`, etc.)
- `/arena/*` (sem `/dashboard`) → `<Navigate to="/arena/dashboard" />`
- `/athlete/*` → reusa `Profile`, `Tournaments`, `Ranking`, `Messages`, `Feed`
- `/company/*` → reusa `MyCompany`, `SponsorDashboard`, `SponsorTournaments`

**Princípios**:
- Nenhuma rota antiga removida (`/dashboard`, `/profile`, `/marketplace/my-company`, `/sponsor/*`, `/admin`, `/arena/dashboard`, `/organizer/*` continuam idênticas)
- Bloco duplicado `/organizer` em `App.tsx` (linhas 192-200) foi removido — code smell sem efeito comportamental
- Zero alteração em edge functions, migrations, RLS, ORKYM, policies ou quotas
- Páginas reusadas como-são; lógica de negócio inalterada

**Próximas subfases (11.x)** criarão dashboards reais por perfil e deprecarão progressivamente as rotas legadas com redirects.
