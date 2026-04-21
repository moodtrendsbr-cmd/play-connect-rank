

# Auditoria Completa — Perfis e Dashboards do MoodPlay

> **Read-only**. Não há alterações propostas. Apenas mapeamento exaustivo do estado atual.

---

## 1. Inventário de perfis (enum `app_role` + papéis derivados)

| Papel | Origem | Resolução |
|---|---|---|
| **Athlete** | enum `app_role.athlete` | default no signup |
| **Organizer** | enum `app_role.organizer` | escolhido no /register |
| **Arena** | enum `app_role.arena` | escolhido no /register, gera linha em `arenas` |
| **Company** | enum `app_role.company` | escolhido no /register, gera linha em `companies` |
| **Admin (Super)** | enum `app_role.admin` | atribuído manualmente em `user_roles` |
| **Tenant Admin / Owner** | `tenant_memberships.role IN ('owner','admin')` | criado por `create_organizer_tenant` no `OrganizerOnboarding` |
| **Sponsor** | NÃO é um role separado — é uma `company` com `status='approved'` que entra em `/sponsor/*` | derivação implícita |

**Observação crítica**: "Tenant Admin" e "Organizer" se sobrepõem. Quem cria um tenant via `/organizer/onboarding` automaticamente vira `tenant_memberships.role='owner'`, mas nada exige que o usuário tenha `app_role='organizer'` no `user_roles`. São dois sistemas paralelos de autorização.

---

## 2. ATHLETE 🟡 Parcial

**Rotas**: `/feed`, `/profile`, `/profile/:userId`, `/ranking`, `/tournaments`, `/tournaments/:id`, `/tournaments/:id/match*`, `/messages`, `/marketplace*`, `/explore`, `/athletes`, `/arenas`, `/arenas/:slug`, `/arenas/:slug/reservar`, `/payment/:id`.

**Telas**: `Feed.tsx` (clips, posts, sponsored, ads), `Profile.tsx` (auto), `UserProfile.tsx` (terceiro), `Ranking.tsx`, `Tournaments.tsx`, `TournamentDetail.tsx`, `Messages.tsx`+`ChatView.tsx`, módulo MATCH (`TournamentMatch`, `MatchRequests`, `MatchPair`, `MatchChat`), `ArenaPublic.tsx`, `ArenaBooking.tsx`, `Marketplace*`, `Cart.tsx`. Layout: `AppLayout` + `FeedBottomNav` (Feed / Torneios↔Ranking / Criar / Arenas / Loja).

**Dados**: `posts`, `post_media`, `clips`, `likes`, `comments`, `post_saves`, `follows`, `messages`, `enrollments`, `tournaments`, `match_*`, `bookings`, `marketplace_orders`, `cart`, `profiles`, `profiles_public`, `athletes_public`, `athlete_activities`, `arenas_public`. Edge: `create-payment`, `create-booking-payment`, `create-marketplace-payment`.

**Ações**: postar/clipar, curtir/comentar/salvar/seguir/mencionar, criar DM, inscrever em torneio, sacar saldo (se também organizer), pagar, reservar arena, comprar marketplace, entrar/sair de pool MATCH, editar perfil.

**ORKYM**: ❌ Nenhuma integração. Não recebe sugestões, não vê tasks, não tem feed personalizado pela ORKYM.

**Conversacional (WhatsApp)**: ❌ Nada. Tudo via app. Notificações de inscrição/pagamento/MATCH/mensagens deveriam ser conversacionais — não são.

**Problemas**:
- `Profile.tsx` mistura UI de atleta + UI de organizador (saldo, MP collector, withdrawals) — perfil único faz dupla função.
- `/dashboard` ainda existe e é renderizada para atleta como "MEUS TORNEIOS" — concorre com `/profile` e com `/feed`.
- Notificações (Bell em `FeedTopBar`) não funcional.

**Gaps**: sem central de notificações, sem agenda pessoal (próximas inscrições/jogos), sem histórico consolidado de conquistas (existe `athlete_activities` mas só aparece em telas de terceiros), sem conversacional.

---

## 3. ORGANIZER 🔴 Desorganizado

**Rotas**: `/dashboard` (tela legacy), `/tournaments/create`, `/tournaments/:id/manage`, `/tournaments/:id/brackets`, `/tournaments/:id/results`, `/organizer/onboarding`, `/organizer/settings`, `/organizer/members`, `/organizer/arenas`, `/organizer/domains`, `/organizer/payment`, `/organizer/finance`. **Note**: bloco `/organizer` está duplicado em `App.tsx` (linhas 182-200).

**Telas**: `Dashboard.tsx` (legacy organizer view), `CreateTournament.tsx`, `ManageTournament.tsx`, `Brackets.tsx`, `Results.tsx`, layout `OrganizerLayout` com 6 itens (Settings, Members, Arenas, Domains, Payment, Finance).

**Dados**: `tournaments`, `tournament_modalities`, `enrollments`, `match_results`, `modality_*`, `tenants`, `tenant_settings`, `tenant_memberships`, `tenant_domains`, `split_rules`, `transaction_splits`, `financial_transactions`, `v_organizer_balances_canonical`, `withdrawal_requests`. RPCs: `create_organizer_tenant`. Edge: `request-withdrawal`.

**Ações**: criar/editar torneios, gerar chaveamento, lançar resultados, configurar branding tenant, convidar membros, vincular arenas ao tenant, configurar domínio próprio, vincular MP, ver financeiro, sacar saldo.

**ORKYM**: ❌ Nenhuma. Briefing/sugestões só na ArenaDashboard, não para organizer.

**Conversacional**: ❌ Nada.

**Problemas**:
- **Dois "homes" do organizer**: `/dashboard` (legacy, mostra torneios+inscrições+saldo) e `/organizer/settings` (white-label). Sem hub único.
- Saldo/saque do organizer aparece **dentro de `Profile.tsx`**, não no `OrganizerLayout`. O `OrganizerFinance.tsx` mostra splits canônicos, mas sem botão de saque.
- Bloco de rotas `/organizer` está **duplicado** em `App.tsx` (192-200 repete 183-191) — funciona por sobreposição, mas é code smell evidente.
- Criação de torneio (`/tournaments/create`) está **fora** do `OrganizerLayout`.
- Gerenciar torneio (`/tournaments/:id/manage`) também fora do layout.
- Arenas vinculadas ao tenant (`OrganizerArenas`) não dão entrada no `ArenaLayout` — separação confusa.
- `ProfileSwitcher` envia organizer para `/dashboard` (legacy), não para `/organizer/settings`.

**Gaps**: hub `/organizer/dashboard` (KPIs do tenant: torneios ativos, inscritos, receita, alertas); Caixa de entrada de pendências do organizer; integração ORKYM (briefing diário do tenant: torneios sub-inscritos, atrasos, oportunidades); central de saque dentro do `OrganizerLayout`; visão de torneios concentrada (hoje espalhada entre `/dashboard`, `/tournaments`, `ArenaTournaments`).

---

## 4. ARENA 🟢 Estruturado (mais completo do sistema)

**Rotas**: `/arena/checkin` (público QR), `/arena/dashboard` + 18 sub-rotas (`torneios`, `financeiro`, `transacoes`, `alunos`, `professores`, `aulas`, `matriculas`, `quadras`, `horarios`, `reservas`, `patrocinios`, `planos`, `assinaturas`, `cobrancas`, `ocorrencias`, `acoes-ia`, `autonomia`, `control-tower`).

**Telas**: 21 páginas em `arena-dashboard/` + `ArenaPublic`, `ArenaBooking`, `ArenasList`, `ArenaCheckin`. Layout próprio (top bar com nav horizontal scrollable de 18+ itens).

**Dados**: `arenas`, `courts`, `bookings`, `arena_students`, `arena_instructors`, `arena_classes`, `arena_class_enrollments`, `arena_attendance`, `arena_membership_plans`, `arena_student_subscriptions`, `arena_billing_cycles`, `arena_occurrences`, `arena_operational_tasks`, `arena_operational_events`, `arena_checkin_tokens`, `payment_accounts`, `financial_transactions`, `transaction_splits`, `orkym_action_proposals`, `autonomy_policies`, `orkym_usage`, `v_orkym_usage_summary`. RPCs: `arena_generate_billing_cycle`, `arena_mark_cycle_paid`, `arena_mark_overdue_cycles`, `arena_checkin_validate`, `arena_archive_old_events`, `autonomy_resolve_policy`, `orkym_check_quota`, `orkym_increment_usage`. Edge: `orkym-invoke`, `orkym-execute-action`, `orkym-cron-tick`, `booking-webhook`.

**Ações**: CRUD completo de quadras/horários/reservas/aulas/alunos/professores/planos/assinaturas; gerar/marcar pago ciclo de cobrança; gerar QR check-in e validar; criar ocorrências; aprovar/rejeitar/executar action proposals da ORKYM; configurar policies de autonomia (escopo arena, somente low-risk auto); ativar kill switch local; visualizar Control Tower (uso vs limite, tempo economizado, upgrade CTA).

**ORKYM**: ✅ Profundamente integrada. `ArenaDashboard` chama `daily_briefing` no mount; `ArenaActions` lista propostas; `ArenaAutonomy` gere policies; `ArenaControlTower` mostra consumo; `OrkymInsightsCard` + `OrkymActionsCard` em vários lugares.

**Conversacional**: ❌ Nada. Check-in é QR no app; cobranças não disparam WhatsApp; ocorrências não notificam dono via WhatsApp.

**Problemas**:
- **Navegação inviável**: 18+ abas em barra horizontal scrollable. Sem agrupamento (Operação / Pessoas / Financeiro / IA).
- **3 telas de IA** sequenciais ("Ações IA", "Autonomia", "Control Tower") — overlap conceitual: actions vs policies vs uso.
- "Torneios" da arena (`ArenaTournaments`) usa `tournaments.arena = arena.name` (string match) — frágil e desconectado do sistema multi-tenant real.
- Sub-rotas em português (`alunos`, `quadras`) enquanto admin está em inglês (`users`, `tournaments`) — inconsistência de naming.
- `/arena/checkin` está fora do `ArenaLayout` mas referenciado no admin/arena.

**Gaps**: agrupamento da nav; visão "minha agenda do dia" (próximas reservas + aulas + ocorrências em uma timeline); WhatsApp para confirmar reserva, lembrar aluno, alertar inadimplência; sem "Caixa de entrada conversacional"; sem relatório semanal automático.

---

## 5. COMPANY (Empresa / Marketplace) 🟡 Parcial

**Rotas**: `/marketplace/register`, `/marketplace/my-company`, `/marketplace/company/:id`, `/marketplace/product/:id`, `/marketplace/cart`, `/marketplace/checkout`, `/marketplace/tournaments`, **e indiretamente** `/sponsor/*` quando a company é patrocinador.

**Telas**: `MarketplaceRegister.tsx`, `MyCompany.tsx` (hub principal — produtos, pedidos, plano), `MarketplaceCompany.tsx` (vitrine pública), `MarketplaceProduct.tsx`, `Marketplace.tsx` (lista). Sem layout dedicado — usam `AppLayout` (compartilhado com atleta).

**Dados**: `companies`, `company_plans`, `subscriptions`, `products`, `marketplace_orders`, `tournament_sponsorships`, `tournament_sponsor_plans`, `ad_campaigns` (futuro), `sponsored_posts`. Edge: `create-marketplace-payment`, `marketplace-webhook`.

**Ações**: criar empresa, escolher plano, adicionar/editar produtos (com até 10 imagens + vídeo), ver pedidos, atualizar marca/logo. Como sponsor: patrocinar torneios, ver métricas (views/clicks).

**ORKYM**: ❌ Nenhuma. Não recebe sugestões de produto, sem actions sobre estoque, sem briefing.

**Conversacional**: ❌ Nada. Pedidos não geram WhatsApp; sponsor não recebe relatórios via mensagem.

**Problemas**:
- **`MyCompany.tsx` é monolítica** — produtos + pedidos + plano numa tela só.
- **Dois mundos paralelos da mesma empresa**: `/marketplace/my-company` (gestão de produtos) e `/sponsor/dashboard` (gestão de patrocínios) — mesma `companies.id`, layouts diferentes, sem ponte entre eles.
- Pedidos (`marketplace_orders`) consultados sem filtro por empresa em `MyCompany.tsx` (linha 51 — `select("*")` sem `eq`) — bug de visibilidade potencial (depende de RLS).
- `SponsorLayout` só tem 2 itens (Dashboard, Torneios) — menu raso comparado aos outros perfis.

**Gaps**: hub único da empresa (vendas + patrocínios + plano + financeiro); ORKYM para sugerir promoções, recuperar carrinho, sugerir torneios para patrocinar baseado em ICP; financeiro (recebíveis marketplace + métricas sponsor) num lugar só; conversacional (pedido novo via WhatsApp ao dono).

---

## 6. SUPER ADMIN (MoodPlay) 🟡 Parcial

**Rotas**: `/admin` + 22 sub-rotas (Dashboard, Analytics, Users, Tournaments, Enrollments, Finances, Split-rules, Adjustments, Arenas, Orkym monitor, Orkym-actions, Autonomy, Control-tower, Companies, Products, Ads, Ad-campaigns, Sponsors, Sponsorships, Plans, Gifts, Monetization).

**Telas**: 23 páginas em `admin/`. Layout: `AdminLayout` com 3 grupos sidebar — "Navegação" (13), "Marketplace" (9), "Navegar como Usuário" (5).

**Dados**: visão global de praticamente todas as tabelas. Métricas no dashboard via `profiles`, `user_roles`, `tournaments`, `enrollments`, `organizer_balances`, `withdrawal_requests`, `companies`, `products`, `marketplace_orders`, `subscriptions`, `financial_ledger`, `financial_transactions`. Sem visão por tenant.

**Ações**: aprovar empresa, gerenciar split rules globais, registrar ajustes financeiros, ver/aprovar saques, gerir planos (incl. tier de autonomia), gerir todos torneios/inscrições, monitorar ORKYM, gerir policies globais e tenant, ativar kill switch global, ver Control Tower agregado, gerir campanhas de ads, sponsors, gifts.

**ORKYM**: ✅ Total visibilidade (`AdminOrkymMonitor`, `AdminOrkymActions`, `AdminAutonomy`, `AdminControlTower`).

**Conversacional**: ❌ Nada.

**Problemas**:
- **22 itens na sidebar** sem hierarquia clara. "Publicidade (legado)" + "Campanhas Ads" coexistem (2 sistemas de ads no menu).
- **Sem dimensão tenant**: dashboards admin somam tudo sem distinguir tenant; não há `/admin/tenants` para listar/gerir tenants brancos.
- "Sponsors" (atleta) e "Sponsorships" (torneio) são dois conceitos com nomes parecidos.
- "Ações ORKYM" + "Autonomia" + "Control Tower" + "Monitor ORKYM" = 4 telas relacionadas, sem hub.
- `Profile.tsx` ainda mostra controles de organizer mesmo para admin.
- `Dashboard.tsx` redireciona admin para `/admin`, mas `ProfileSwitcher` envia admin para `/dashboard` primeiro (linha 267) — pequena inconsistência.

**Gaps**: módulo `/admin/tenants` (lista, ativar/desativar, override de tier, ver consumo); visão "saúde da plataforma" (uptime ORKYM, % degraded, adoção); fila de aprovação consolidada (empresas + saques + ajustes + ações high-risk); conversacional para alertas críticos (kill switch ativado, payout grande, etc).

---

## 7. TENANT ADMIN (Organizador-Owner) 🔴 Desorganizado

**Não tem layout próprio distinto**. Reusa `OrganizerLayout`. Identidade derivada de `tenant_memberships.role IN ('owner','admin')` via `useIsTenantAdmin()`.

**Rotas/Telas/Ações**: idênticas ao Organizer — mas com poderes adicionais via RLS de tenant (gerir membros, domínios, branding, regras de split somente leitura).

**ORKYM**: ❌ Nenhuma sugestão de tenant (briefing por organizador completo, alertas de adoção das arenas filhas, etc).

**Problemas**:
- Não existe distinção UX entre Organizer (papel app) e Tenant Owner (papel multi-tenant). Confusão conceitual.
- Tenant Admin não tem visão consolidada das arenas que pertencem ao seu tenant — `OrganizerArenas` lista mas não dá KPIs.
- Não há "switch de tenant" UI (apesar de `TenantContext.switchTenant` existir).

**Gaps**: dashboard tenant (todas as arenas + todos torneios + financeiro consolidado); seletor de tenant; ORKYM por tenant; permissões granulares (admin vs staff vs member já existem no schema mas não na UI).

---

## 8. SPONSOR (Company com aprovação) 🟡 Parcial

**Rotas**: `/sponsor/dashboard`, `/sponsor/tournaments`, `/sponsor/sponsorships/:id`. Layout: `SponsorLayout` (só 2 itens nav).

**Telas**: `SponsorDashboard.tsx` (cards de patrocínios + métricas views/clicks), `SponsorTournaments.tsx` (torneios disponíveis), `SponsorshipDetail.tsx`.

**Dados**: `tournament_sponsorships`, `tournament_sponsor_plans`, `tournaments`, `companies`, `gifts`.

**Ações**: comprar patrocínio, ver métricas, atualizar marca (link para `/marketplace/my-company` — sai do contexto sponsor).

**ORKYM**: ❌ Nada.

**Conversacional**: ❌ Nada.

**Problemas**:
- **Mesma entidade `companies` opera em 2 layouts** (`AppLayout` para marketplace + `SponsorLayout` para patrocínios) — usuário precisa "saltar" entre eles.
- Métricas básicas (views/clicks) sem ROI calculado.
- Botão "Atualizar marca" leva para fora do `SponsorLayout`.

**Gaps**: hub único da empresa; ORKYM (sugerir torneios alvo); insights de público alcançado; conversacional para relatórios.

---

## 9. ANÁLISE GLOBAL

### O QUE ESTÁ BOM ✅
- **Arena**: módulo mais completo, com ORKYM ponta-a-ponta (briefing → action proposal → policy → execution → audit → control tower).
- **Multi-tenant + branding**: arquitetura sólida (`tenants`, `tenant_settings`, `tenant_domains`, `resolve_tenant_by_host`, `set_current_tenant`).
- **Financeiro canônico**: `financial_transactions` + `transaction_splits` + `split_rules` + adjustments + settlement readiness.
- **ORKYM bridge**: contrato bem definido, fail-safe (sempre 200, dedup, rate-limit, retry, audit).
- **Autonomy stack** (Fases 8–10): policies + guardrails + kill switch + tier + quota + UI completa para arena/admin.
- **Roles via tabela separada** (`user_roles`) + `has_role` SECURITY DEFINER — modelo seguro.

### O QUE ESTÁ DUPLICADO ⚠️
- Bloco de rotas `/organizer` repetido em `App.tsx` (192-200 = 183-191).
- "Publicidade (legado)" + "Campanhas Ads" no AdminLayout.
- "Patrocínios Atleta" + "Patrocínios Torneio" sem hierarquia.
- 4 telas relacionadas a ORKYM no admin (Monitor, Actions, Autonomy, Control Tower) sem hub.
- `Dashboard.tsx` (legacy organizer) vs `OrganizerLayout` — duas portas para o mesmo papel.
- Saldo/saque do organizer aparece em `Profile.tsx` E em `OrganizerFinance.tsx` (parcialmente).
- `MyCompany` (marketplace) + `SponsorDashboard` (patrocínios) = mesma empresa, dois layouts.

### O QUE ESTÁ CONFUSO 🌀
- "Organizer" (app role) vs "Tenant Owner" (multi-tenant) — sem UX que diferencie.
- 18 itens na nav horizontal da arena, 22 na sidebar admin, sem agrupamento.
- Arena vinculada a tenant via `OrganizerArenas` mas o `ArenaLayout` resolve por `arenas.owner_user_id` — duas formas de associação convivem.
- `/dashboard` é home para organizer mas redireciona admin e atleta — múltiplas finalidades.
- `tournaments.arena` é string (não FK) — `ArenaTournaments` filtra por `eq("arena", arena.name)`.
- Naming PT vs EN inconsistente entre arena (`alunos`, `quadras`) e admin (`users`, `tournaments`).
- ProfileSwitcher manda admin para `/dashboard` antes de `/admin`.

### O QUE ESTÁ FALTANDO 🚧
- **Hub central por perfil** para Athlete (sem dashboard pessoal), Organizer (sem `/organizer/dashboard`), Tenant Admin (sem visão consolidada de arenas), Company (sem hub unificado), Sponsor (mais que cards básicos).
- **Camada conversacional** ZERO: nenhum perfil opera por WhatsApp. Notificações, confirmações, lembretes, relatórios — tudo só no app.
- **Central de notificações** (Bell em `FeedTopBar` é estático).
- **ORKYM fora da Arena**: Athlete/Organizer/Tenant/Company/Sponsor não recebem briefing/sugestões/actions.
- **Módulo `/admin/tenants`** para gerir os tenants brancos.
- **Agenda unificada** por perfil (próximos compromissos: jogos, aulas, reservas, vencimentos).
- **Inbox consolidada** de tarefas pendentes por perfil.
- **Webhook de alerta** quando guardrail bloqueia auto N vezes ou quando kill switch é ativado.
- **Roles mais granulares** na UI (staff, member já existem em DB).

### O QUE DEVERIA SER CENTRALIZADO 🎯
- **Identidade Empresa**: `companies` com um único hub que aglutina marketplace + patrocínios + plano + financeiro + ORKYM.
- **Identidade Atleta**: tudo de athlete (perfil + agenda + conquistas + inscrições + saldos se também organizer) num único `/me` ou expandido em `/profile`.
- **Hub Organizer/Tenant**: `/organizer` deveria ter `dashboard` (KPIs) como índice, `tournaments`, `arenas`, `finance`, `members`, `settings`, `domains`, `payment` como sub-rotas — eliminando `/dashboard` legacy e `/tournaments/create|manage` órfãos.
- **Centro ORKYM Admin**: hub único agregando Monitor + Actions + Autonomy + Control Tower em abas.
- **Financeiro do Organizer**: saldo/saque hoje em `Profile.tsx` deveria estar 100% em `OrganizerFinance`.

### O QUE DEVERIA IR PARA WHATSAPP 💬
**Athlete**: lembrete de jogo, confirmação de inscrição, recibo de pagamento, alerta de match encontrado, mensagem direta de outro usuário, resultado de partida.

**Organizer**: nova inscrição paga, torneio sub-inscrito, atleta cancelou, saque processado, ORKYM briefing semanal.

**Arena**: confirmação de reserva, lembrete de aluno em aula, inadimplência detectada, ocorrência aberta, action ORKYM proposta para aprovar via reply, check-in (em vez de QR), relatório diário.

**Company/Sponsor**: novo pedido marketplace, estoque baixo, métricas semanais de patrocínio, sugestão ORKYM de novo torneio para patrocinar.

**Admin**: alerta crítico (kill switch ativado, ORKYM degraded > X min, payout > limite, fraude suspeita).

---

## 10. CLASSIFICAÇÃO FINAL

| Perfil | Status | Justificativa curta |
|---|---|---|
| **Athlete** | 🟡 Parcial | Social + tournaments funcionais, mas sem hub pessoal, sem ORKYM, sem conversacional, perfil polui-se com infos de organizer |
| **Organizer** | 🔴 Desorganizado | Dashboard legacy + OrganizerLayout sobrepostos, rotas duplicadas em App.tsx, financeiro dividido, sem hub, sem ORKYM |
| **Arena** | 🟢 Estruturado | ORKYM ponta-a-ponta, 18 sub-rotas funcionais — só sofre de excesso de nav sem agrupamento e 3 telas IA sem hub |
| **Company** | 🟡 Parcial | Marketplace e Sponsor são dois mundos para a mesma entidade; hub monolítico; sem ORKYM; pedidos sem filtro evidente |
| **Sponsor** | 🟡 Parcial | Layout enxuto, métricas básicas, métrica de ROI ausente, sai do contexto para editar marca |
| **Super Admin** | 🟡 Parcial | Cobertura ampla mas sem hierarquia; falta `/admin/tenants`; 4 telas ORKYM sem hub; "publicidade legado" coexiste com nova |
| **Tenant Admin** | 🔴 Desorganizado | Sem identidade UX própria; reusa OrganizerLayout; sem dashboard consolidado; sem switch tenant na UI; ORKYM ausente |

---

## 11. Próximos passos sugeridos (apenas direção, sem implementação)

1. **Resolver duplicação imediata em `App.tsx`** (rotas `/organizer` repetidas).
2. **Definir IA = um único hub por perfil** (Arena, Admin) com tabs internas.
3. **Decidir conceitualmente**: Organizer = Tenant Owner? Se sim, fundir telas. Se não, separar UX.
4. **Definir Company como entidade única** com layout próprio aglutinando marketplace + sponsor.
5. **Criar `/admin/tenants`** antes de continuar evolução multi-tenant.
6. **Estabelecer camada conversacional** (WhatsApp) como princípio transversal — começar por Arena (perfil mais maduro) e Athlete (volume).
7. **Padronizar naming** (PT em todo lado ou EN em todo lado).
8. **Consolidar financeiro do organizer** numa única tela (remover saldo/saque de `Profile.tsx`).

