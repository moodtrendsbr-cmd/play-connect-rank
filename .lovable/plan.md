# Sprint P0.5 — MoodPlay

Foco: fechar vazamentos de UX/navegação para liberar beta fechado pago. Sem features novas, sem IA, sem dashboards novos.

## 1. Links mortos (sidebars)

**Organizer** (`OrganizerSidebar`): `dashboard/eventos`, `dashboard/inscricoes`, `dashboard/jogos` não existem em `App.tsx`.
- Ação: criar **stubs honestos** em `src/pages/organizer/` (`OrganizerEvents`, `OrganizerEnrollments`, `OrganizerGames`) e registrar rotas filhas dentro de `<Route path="/organizer/dashboard">`.
- Cada stub usa o mesmo padrão (seção 2).

**Company** (`CompanySidebar`): `/company/mensagens-wa` não existe.
- Ação: criar rota `mensagens-wa` dentro de `<Route path="/company">` reusando `ScopedMessages` com escopo `company` (já existe em `src/pages/conversational/ScopedMessages.tsx`). Se reuso não for trivial, usar stub.

**Tenant** (`TenantSidebar`): item `/tenant/empresas` aparece no sidebar mas não há rota.
- Ação: criar stub `TenantCompanies` em `src/pages/tenant/` e rota filha `empresas`.

Regra: nenhum item de sidebar pode levar a 404 ou tela branca após esta sprint.

## 2. Stub honesto padrão

Criar componente reutilizável `src/components/common/ComingSoonPage.tsx`:
- Props: `title`, `description`, `backTo` (default = dashboard do role via `dashboardPathFor`), `ctaLabel?`, `ctaTo?`
- Layout: ícone, título, descrição clara, badge "Em preparação", botão "Voltar".
- Sem loading, sem placeholder fake, sem componente vazio.

Cada stub criado na seção 1 é uma página de 6-10 linhas que renderiza `<ComingSoonPage ... />`.

## 3. Guard CompanyShell

`CompanyShell` hoje cai em fallback "MoodPlay" se não houver company.
- Adicionar: após `resolved && !companyId && !isSuperAdmin` → `<Navigate to="/onboarding/company" replace />`.
- Admin sem company permanece (ou volta para `/admin`), espelhando padrão de `TenantShell`.

## 4. Guard OrganizerShell

`OrganizerShell` hoje só checa role. Sem onboarding feito, dashboard fica vazio.
- Adicionar consulta ao `tenants`/`organizers` por `owner_user_id` (ou flag de `organizer_onboarded` em `profiles`).
- Sem entidade + não-admin → `<Navigate to="/organizer/onboarding" replace />`.

## 5. Onboarding real (substituir `OnboardingPending`)

Remover comportamento "voltar para `/register`". Criar formulários mínimos:

- `src/pages/onboarding/ArenaOnboarding.tsx` — campos: nome, slug (auto), telefone WhatsApp. Insere em `arenas` com `owner_user_id = user.id`. Após sucesso → `/arena/dashboard`.
- `src/pages/onboarding/CompanyOnboarding.tsx` — campos: nome, categoria. Insere em `companies` com `owner_user_id = user.id`. Após sucesso → `/company/dashboard`.
- Organizer: já existe `OrganizerOnboarding` — manter; apenas garantir guard usa `/organizer/onboarding`.
- Tenant: já existe — manter.

Atualizar `App.tsx`:
- `/onboarding/arena` → `<ArenaOnboarding />`
- `/onboarding/company` → `<CompanyOnboarding />`
- Manter `/onboarding/:kind` como fallback genérico (ou deletar).

`resolveLandingPath` já aponta para esses paths — alinhado.

## 6. Index redirect

`src/pages/Index.tsx` linha 100: `navigate("/feed", ...)`.
- Trocar por `resolveLandingPath(user.id)` (importar de `@/lib/loginDispatch`).
- Manter o early-return enquanto resolve.

## 7. Athlete unificado

Hoje `/feed`, `/profile`, `/ranking`, `/messages`, `/tournaments` usam `AppLayout` (com `FeedBottomNav`), enquanto `/athlete/*` usa `AthleteShell` (com `AthleteBottomNav`). Dois chromes diferentes.

- Decisão: **AthleteShell é o canônico** (já memorizado).
- Para usuários com role `athlete` autenticados, redirecionar legado:
  - Adicionar guard simples em `AppLayout` (ou wrappers nas rotas) que, se `userRole === "athlete"`, redireciona `/feed`→`/athlete/feed`, `/profile`→`/athlete/perfil`, `/ranking`→`/athlete/ranking`, `/messages`→`/athlete/mensagens`, `/tournaments`→`/athlete/torneios`.
- Não-atletas (admin/organizador navegando feed público) continuam acessando rotas legadas — não mexer.

## 8. Landing — métricas

`src/pages/Index.tsx` array `socialProof` tem números falsos.
- Substituir seção inteira por linguagem qualitativa (sem números) ou marcar "Em beta — junte-se aos primeiros". Manter visual.

## 9. Admin `/admin/tenants`

`App.tsx` linha 330 mapeia `tenants` → `<AdminArenas />` (errado).
- Criar stub `AdminTenants` em `src/pages/admin/` usando `ComingSoonPage` ou listar tenants reais via query simples a `tenants`. P0.5 = stub honesto.

## 10. QA manual

Após implementação, rodar fluxo por role:
- ADMIN, TENANT, ARENA, ORGANIZER, COMPANY, ATHLETE
- Para cada: login → redirect correto → sidebar sem links mortos → onboarding (se sem entidade) → voltar/logout → mobile.

Verificar build TS sem erros.

## Detalhes técnicos

**Arquivos criados:**
- `src/components/common/ComingSoonPage.tsx`
- `src/pages/organizer/OrganizerEvents.tsx`, `OrganizerEnrollments.tsx`, `OrganizerGames.tsx`
- `src/pages/tenant/TenantCompanies.tsx`
- `src/pages/admin/AdminTenants.tsx`
- `src/pages/onboarding/ArenaOnboarding.tsx`
- `src/pages/onboarding/CompanyOnboarding.tsx`

**Arquivos editados:**
- `src/App.tsx` — adicionar rotas de stubs, onboarding real, mensagens-wa company, corrigir `/admin/tenants`.
- `src/layouts/CompanyShell.tsx` — guard sem company.
- `src/layouts/OrganizerShell.tsx` — guard sem entidade.
- `src/layouts/AthleteShell.tsx` ou `src/components/layout/AppLayout.tsx` — redirect athlete para `/athlete/*`.
- `src/pages/Index.tsx` — `resolveLandingPath` + remover métricas falsas.
- `src/pages/onboarding/OnboardingPending.tsx` — opcional manter como fallback ou deletar.

**Sem mexer em:** edge functions, migrations, RLS, IA/ORKYM, Admin shell legado.

## Critério de sucesso

- Zero 404 ao clicar em qualquer item de sidebar nos 6 roles.
- Login sempre cai no destino correto.
- CompanyShell/OrganizerShell nunca abrem vazios.
- Onboarding real cria entidade e leva ao dashboard.
- Athlete tem uma única navegação.
- Landing sem números fake.
- Build TS limpo.

## Status alvo após sprint

- Beta fechado pago: ✅
- Piloto pago controlado: ✅
- Venda pública: ainda não (depende de conteúdo real e métricas reais)
