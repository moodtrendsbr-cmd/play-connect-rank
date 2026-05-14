# Productization Sprint P0 — MoodPlay

Sem features novas. Sem IA nova. Sem migrations. Foco em limpeza, blindagem, UX, navegação e onboarding.

---

## Fase 1 — Login dispatcher (P0)
**Arquivo:** `src/pages/Login.tsx`

Substituir `navigate("/dashboard")` por dispatcher:
1. Após `signInWithPassword`, buscar `userRole` (via `user_roles`) e tenant/arena/company ownership.
2. Roteamento:
   - `admin` → `/admin`
   - `tenant_admin` (tem registro em `tenants` como owner) → `/tenant/dashboard`
   - `arena` (tem `arenas.owner_user_id = uid`) → `/arena/dashboard`
   - `organizer` → `/organizer/dashboard`
   - `company` (tem `companies` própria) → `/company/dashboard`
   - `athlete` (default) → `/athlete/feed`
3. Se perfil incompleto (sem `profiles.full_name` ou registro de entidade ausente para o role): mandar para onboarding correspondente da Fase 8.
4. Centralizar lógica em `src/lib/loginDispatch.ts` (pura, testável). `dashboardPathFor` continua sendo o fallback estático.

---

## Fase 2 — Remover fallbacks dev (P0)
**Arquivos:** `src/layouts/ArenaShell.tsx`, `src/layouts/TenantShell.tsx`

ArenaShell:
- Remover passos 2 ("primeira arena do banco") e 3 ("Arena Demo").
- Se `userRole === 'admin'` e não houver arena própria: permitir bypass mas mostrar banner "Modo admin — sem arena vinculada" e NÃO setar `arena` com dados de outra entidade.
- Caso contrário, sem arena → `<Navigate to="/arena/onboarding" replace />`.

TenantShell:
- Remover `displayTenant = tenant ?? { id: "demo", ... }`.
- Sem tenant + não-admin → `/tenant/onboarding` (já redireciona para onboarding do organizer; ajustar para fluxo tenant-específico).
- Admin sem tenant → banner "Modo admin", sem dados fake.

---

## Fase 3 + 5 — Esconder engenharia dos clientes
Remover dos shells/dashboards de Arena, Organizer, Company, Tenant, Athlete:
- `ControlTowerAIPanel`
- `MemoryTransparencyCard`
- `OperationModeBanner`
- `CommandExamplesCard`, `CommandHistoryCard`
- `OrkymActionsCard` (substituir por nada ou por "Ações automáticas recentes" só com label genérico)
- Páginas `*Commands.tsx` (Arena/Organizer/Company/Tenant/Athlete) → remover do menu (sidebars) e tirar rota do `App.tsx`.
- `ArenaControlTower.tsx` e `AdminControlTower` (cliente) → renomear visualmente para "Visão geral" ou esconder atrás de feature flag `VITE_ENABLE_INTERNAL_TOOLS`.

Athlete: remover qualquer item "Comandos" do `AthleteSidebar`/`AthleteBottomNav`.

---

## Fase 4 — Renomeação de copy
Buscar e substituir em componentes/sidebars de cliente (não admin/internal):
- "Control Tower" → "Visão geral"
- "Bindings" → "Conexões WhatsApp"
- "Receita via ORKYM" → "Receita automatizada"
- "Auto-execuções" → "Ações automáticas"
- "Chamadas IA" / "Chamadas ORKYM" → remover card
- "WhatsApp da ORKYM" → "WhatsApp da plataforma"
- "ORKYM enviará..." → "Lembrete enviado por WhatsApp"
- "A ORKYM aprende..." → "O sistema personaliza recomendações"
- Qualquer string `ORKYM` voltada ao cliente → remover.

Centralizar via `src/lib/controlTowerCopy.ts` (já existe) — auditar e ajustar.

---

## Fase 6 — Rotas falsas/duplicadas
**Arquivo:** `src/App.tsx` + sidebars.

Organizer: `/eventos`, `/inscricoes`, `/jogos`, `/performance` que renderizam o mesmo componente → remover do `OrganizerSidebar` e do router. Manter só rotas com página real.

Tenant: `overview`, `branding`, `empresas` que reutilizam `OrganizerSettings` fake → remover do `TenantSidebar`/router.

Resultado: menus só mostram itens com página própria.

---

## Fase 7 — Unificar /dashboard
**Arquivo:** `src/pages/Dashboard.tsx` + `App.tsx`

- Converter `/dashboard` em dispatcher puro: detecta role e `<Navigate>` para o shell correto (mesma lógica da Fase 1).
- Remover qualquer UI legada de `Dashboard.tsx`.

---

## Fase 8 — Onboarding mínimo por perfil
Criar páginas leves (sem novas tabelas, só checklists baseados em dados existentes):
- `src/pages/onboarding/ArenaOnboarding.tsx` — passos: WhatsApp, perfil, QR, primeira quadra.
- `src/pages/onboarding/OrganizerOnboarding.tsx` — perfil + 1º torneio. (Já existe `OrganizerOnboarding.tsx` — reaproveitar e simplificar.)
- `src/pages/onboarding/CompanyOnboarding.tsx` — empresa + 1º produto.
- `src/pages/onboarding/TenantOnboarding.tsx` — domínio + 1ª arena.
- `src/pages/onboarding/AthleteOnboarding.tsx` — perfil + esportes.

Componente compartilhado `OnboardingChecklist` com itens marcáveis (estado derivado de queries existentes). Sem termos técnicos.

Rotas: `/arena/onboarding`, `/organizer/onboarding`, `/company/onboarding`, `/tenant/onboarding`, `/athlete/onboarding`.

---

## Fase 9 — Register
**Arquivo:** `src/pages/Register.tsx`

- `try/catch` em todos os inserts (`profiles`, `user_roles`, entidade do role).
- Se signup OK mas insert falhar: `signOut` + toast claro + permanecer na página.
- Detectar `supabase.auth` setting de email confirmation: se ON → mensagem "Verifique seu email"; se OFF → redirecionar via dispatcher (Fase 1). Verificar via tentativa de `getSession()` pós-signup.
- Após sucesso, redirecionar para onboarding do role (Fase 8).

---

## Fase 10 — Admin
- Manter `/admin/internal-tools` (já existe) com `VITE_ENABLE_INTERNAL_TOOLS` + super_admin.
- Mover quaisquer botões técnicos remanescentes (smoke, seed, debug) de `AdminDashboard`, `AdminControlTower`, etc. para `AdminInternalTools.tsx`.
- `AdminLayout` sidebar: agrupar itens de produto (financeiro, usuários, arenas, campanhas) e separar "Ferramentas internas" no fim, atrás de flag.

---

## Fase 11 — Athlete UX unificado
- Decidir: Athlete sempre usa `AthleteShell` mobile-first com `AthleteBottomNav`.
- Remover uso de `AppLayout` para rotas de Athlete; redirecionar `/feed`, `/profile` etc. para `/athlete/feed`, `/athlete/profile` ou montá-las dentro de `AthleteShell`.
- `App.tsx`: garantir que toda rota athlete passa pelo mesmo shell.

---

## Fase 12 — Landing / copy
**Arquivo:** `src/pages/Index.tsx` + footer/landing components.
- Remover métricas/estatísticas hardcoded fake.
- Termos/Privacidade: se não há páginas, esconder links (não deixar 404).
- Auditar CTAs duplicados; unificar para `Cadastre-se`.

---

## Fase 13 — QA visual
Após implementação, abrir preview e validar manualmente:
- Login → cada role cai no lugar certo.
- Mobile (375x812) e desktop em cada shell.
- Empty states de Arena/Tenant sem dados (sem fallback fake).
- Rotas órfãs retornam 404 ou redirecionam.

---

## Fase 14 — Segurança
- Confirmar que após Fase 2 nenhuma página de Arena/Tenant carrega dados de outra entidade.
- Rodar `supabase--linter` e `security--run_security_scan` para conferir RLS pós-mudanças.
- Conferir que páginas públicas (QR, arena pública) continuam funcionando sem auth.

---

## Fase 15 — Relatório final
Ao fim da sprint, entregar lista com: P0 corrigidos, componentes removidos, termos renomeados, rotas removidas, onboardings criados, vazamentos fechados, status do build TS, pendências.

---

## Detalhes técnicos relevantes
- Sem migrations. Sem mexer em edge functions. Sem mexer em `client.ts`/`types.ts`.
- Toda lógica de role-routing centralizada em `src/lib/loginDispatch.ts` (novo) reutilizado por `Login.tsx`, `Dashboard.tsx` e `Register.tsx`.
- Feature flag `VITE_ENABLE_INTERNAL_TOOLS` já existe — usar em qualquer card técnico que sobrar visível.
- Ordem de execução sugerida: 2 → 1 → 7 → 9 → 3/5 → 4 → 6 → 11 → 8 → 10 → 12 → 13/14 → 15.
- Estimativa: ~15-20 arquivos editados, ~5 arquivos novos (onboardings + dispatch lib), 0 migrations.
