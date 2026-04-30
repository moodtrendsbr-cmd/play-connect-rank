
# Reestruturação dos Dashboards MoodPlay

Foco: simplificar navegação, renomear termos técnicos, esconder ORKYM/IA da UI, consolidar rotas duplicadas. **Nenhuma página é deletada** — apenas removida do menu, renomeada ou redirecionada. Backend, edge functions e DB intocados.

## Princípios

- ORKYM, "IA", "Autonomia", "Comandos", "Control Tower", "Bindings", "Split rules", "(legado)" — fora da UI.
- Renomeações globais: `Control Tower → Visão geral`, `Comandos → Conversas`, `Split rules → Divisão de valores`, `Bindings → Conexão de número`, `Roteamento WhatsApp → Para onde vão as mensagens`, `Ações ORKYM → Sugestões` (ou removido).
- Rotas antigas continuam acessíveis (não quebra deep links existentes), mas somem do menu.

---

## Fase 1 — Athlete (bottom nav mobile-first)

**Arquivo:** `src/layouts/AthleteShell.tsx`, `src/layouts/sidebars/AthleteSidebar.tsx`

- Em viewport `< md`: substituir `AthleteSidebar` por uma `AthleteBottomNav` fixa (5 itens): Feed, Torneios, Ranking, Mensagens, Perfil.
- Em `≥ md`: manter `AthleteSidebar` mas reduzida aos mesmos 5 itens.
- Remover do menu: `Comandos`, `Dashboard` (atleta entra direto em Feed), `Descobrir` (fundido em Feed via aba/tab interna do `Feed.tsx` se já existir; senão apenas remove o item — rota `/athlete/descobrir` continua viva).
- Default redirect: `/athlete` → `/athlete/feed` (em vez de `/athlete/dashboard`).

## Fase 2 — Arena

**Arquivo:** `src/layouts/sidebars/ArenaSidebar.tsx`

Nova estrutura de grupos:

- **Visão geral** → `/arena/dashboard` (renomeia "Control Tower"; remove "Visão geral" duplicada, "Ações ORKYM", "Autonomia", "Comandos" do menu).
- **Hoje** → `/arena/checkin` (Check-in) + `/arena/dashboard/reservas` (Reservas de hoje).
- **Operação** → Quadras, Horários, Aulas, Matrículas, Alunos, Professores, Ocorrências.
- **Torneios** → `/arena/dashboard/torneios`.
- **Receita** → único item "Receita" → `/arena/dashboard/financeiro`. A página `ArenaFinance.tsx` ganha **abas internas** (Resumo · Transações · Planos · Assinaturas · Cobranças) consumindo os componentes já existentes (`ArenaTransactions`, `ArenaPlans`, `ArenaSubscriptions`, `ArenaBilling`). Rotas antigas continuam respondendo.
- **Crescimento** → Patrocínios.
- **Conversas** → `/arena/dashboard/mensagens-wa` (renomeada de "Comandos/Mensagens").

Footer da sidebar: remover `WhatsAppCTA` "Falar com a ORKYM".

## Fase 3 — Organizer

**Arquivo:** `src/layouts/sidebars/OrganizerSidebar.tsx` + `src/App.tsx`

- Sidebar: Visão geral, Eventos, Inscritos, Jogos, Financeiro, Conversas.
- Hoje `eventos`, `inscricoes`, `jogos`, `performance` apontam todos para `OrganizerDashboard` (stub). Plano: manter rotas vivas mas **mostrar apenas "Eventos"** no menu até que páginas reais existam (não criar páginas — só remover stubs do menu).
- Remover do menu: `Comandos`, `Conexão WhatsApp` (move para um link discreto no header da Visão geral via badge já existente), "Criar evento" (vira botão de ação dentro de Eventos).
- "Conversas" → `/organizer/dashboard/mensagens-wa`.

## Fase 4 — Company

**Arquivo:** `src/layouts/sidebars/CompanySidebar.tsx` + `src/App.tsx`

- Sidebar: Visão geral, Produtos, Pedidos, Campanhas, Patrocínios, Onde apareço, Conversas.
- Atualmente `/company/produtos`, `/company/pedidos` renderizam `MyCompany`; `/company/campanhas` e `/company/visibilidade` renderizam `CompanyDashboard`. Plano: manter rotas, mas **mapear cada item do menu para a rota mais específica existente** (sem stubs duplicados visíveis):
  - Produtos → `/company/produtos` (MyCompany já tem aba)
  - Pedidos → `/company/pedidos`
  - Campanhas → `/company/sponsor/torneios` (página real)
  - Patrocínios → `/company/sponsor/resumo` (página real, SponsorDashboard)
  - Onde apareço → `/company/visibilidade` (mantém CompanyDashboard com foco em métricas de impressão; sem mudar o componente)
- Remover do menu: `Comandos`, `Explore`, `Feed MoodPlay` (links externos podem ficar como atalhos no header, não no menu principal).

## Fase 5 — Tenant

**Arquivo:** `src/layouts/sidebars/TenantSidebar.tsx`

- Sidebar: Visão geral, Arenas, Eventos, Empresas, Receita, Configurações, Conversas.
- Remover do menu: `Comandos`, `Autonomia`, `Roteamento WhatsApp` (rotas continuam vivas).
- Renomear: `Financeiro → Receita`. `Conta de pagamento` movida para dentro de Configurações (sub-link no header da página) — no menu fica só "Configurações" → `/tenant/dominios` com abas (Domínios · Pagamento) reaproveitando `OrganizerDomains` e `OrganizerPayment` via tabs no shell. Sem backend.
- Empresas: aponta para `/tenant/empresas` (já existe rota).
- Conversas → `/tenant/mensagens-wa`.

## Fase 6 — Admin

**Arquivo:** `src/pages/admin/AdminLayout.tsx`

Novos grupos enxutos:

- **Visão geral**: Dashboard, Analytics.
- **Usuários**: Usuários, Tenants.
- **Operação**: Torneios, Inscrições, Arenas.
- **Marketplace**: Empresas, Produtos, Patrocínios — Atletas, Patrocínios — Torneios, Brindes, Planos, Destaques pagos.
- **Campanhas**: Campanhas (Ad Campaigns).
- **Financeiro**: Financeiro, Divisão de valores (split-rules), Ajustes, Monetização.
- **Aprovações**: Featured listings em fila (reaproveita `AdminFeaturedListings` filtrada).
- **Sistema** (recolhido por padrão): Monitor ORKYM, Ações ORKYM, Autonomia, Control Tower, WhatsApp Instâncias, Mensagens, Bindings, Leads, Comandos.

Itens removidos do menu (rotas vivas): `Campanhas (legado)`, duplicatas.

## Fase 7 — Limpeza global

- Remover footer `WhatsAppCTA "Falar com a ORKYM"` de **todas** as sidebars (Athlete, Arena, Organizer, Company, Tenant, Admin).
- `WhatsAppStatusBadge` no header de cada shell: trocar texto interno (se houver "ORKYM"/"IA") para "WhatsApp" puro — verificar `src/components/conversational/WhatsAppStatusBadge.tsx`.
- `OperationModeBanner`: esconder no athlete/company; manter apenas em arena/organizer/tenant **sem** mencionar "modo auto/manual" — texto neutro tipo "Conexão ativa".

## Fase 8 — Sem alterações em rotas (compatibilidade)

`src/App.tsx` permanece praticamente intocado. Único ajuste opcional: redirect default `/athlete` → `/athlete/feed`. Todas as rotas antigas (`/arena/dashboard/comandos`, `/admin/orkym`, etc.) continuam funcionando — apenas saem do menu visível.

---

## Arquivos a editar

1. `src/layouts/sidebars/AthleteSidebar.tsx` — reduzir a 5 itens, remover footer ORKYM.
2. `src/layouts/AthleteShell.tsx` — adicionar bottom nav mobile.
3. **Novo**: `src/components/layout/AthleteBottomNav.tsx`.
4. `src/layouts/sidebars/ArenaSidebar.tsx` — reagrupar, remover IA/Comandos/Autonomia/Ações.
5. `src/pages/arena-dashboard/ArenaFinance.tsx` — adicionar abas internas (Resumo, Transações, Planos, Assinaturas, Cobranças).
6. `src/layouts/sidebars/OrganizerSidebar.tsx` — reduzir.
7. `src/layouts/sidebars/CompanySidebar.tsx` — apontar para rotas específicas, remover externos.
8. `src/layouts/sidebars/TenantSidebar.tsx` — remover Autonomia/Routing/Comandos, renomear Financeiro.
9. `src/pages/admin/AdminLayout.tsx` — novos grupos, "Sistema" recolhido.
10. `src/components/conversational/WhatsAppStatusBadge.tsx` — texto neutro (se necessário).
11. `src/components/conversational/OperationModeBanner.tsx` — texto neutro/esconder em alguns shells.

## Critérios de aceite

- Nenhum item de menu contém: ORKYM, IA, Autonomia, Comandos, Control Tower, Bindings, Split rules, "(legado)".
- Athlete em mobile usa bottom nav (5 ícones).
- Arena Receita é uma página com abas, não 5 itens de menu.
- Admin "Sistema" agrupa tudo técnico, recolhido por padrão.
- Todas as rotas antigas continuam respondendo (zero 404 em deep links existentes).
- Build limpo, sem imports removidos quebrando compilação.
