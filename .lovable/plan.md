

# Auditoria Arquitetural MoodPlay — Visão White-Label Multi-Tenant

> Análise estratégica sem código. Baseada na leitura completa de 55 tabelas, 50 rotas, 10 edge functions e da hierarquia atual de papéis.

---

## ENTREGA 1 — AUDITORIA ESTRUTURAL

### 1.1 O que já existe e atende (parcial ou totalmente) à visão

| Camada futura | Existe hoje | Cobertura |
|---|---|---|
| Multi-papel (athlete/organizer/arena/company/admin) | `user_roles` + `app_role` + `has_role()` | 70% — falta tenant_id |
| Arenas com domínio público | `arenas.slug` + `/arenas/:slug` | 60% — slug funciona como subpath, não subdomain |
| Gestão de quadras | `courts`, `court_availability`, `court_blocks` | 90% pronto |
| Locação de quadras + checkout | `bookings` + `create-booking-payment` (MP split via `mp_collector_id`) | 85% pronto |
| Eventos/Torneios completos | `tournaments` + `tournament_modalities` + `modality_*` (entries, groups, matches, placements, prizes) | 90% pronto |
| Inscrições + checkout | `enrollments` + `create-payment` + split MP | 85% pronto |
| Marketplace + comissão | `companies`, `products`, `marketplace_orders`, `company_plans` | 80% pronto |
| Ads/Patrocínios | `tournament_sponsorships`, `sponsored_posts`, `arena_partners` | 75% pronto |
| Rede social | `posts`, `clips`, `comments`, `likes`, `follows`, `messages`, `mentions`, `hashtags` | 95% pronto |
| Financeiro/Split | `organizer_balances`, `withdrawal_requests`, `financial_ledger`, `mp_collector_id` em `arenas` e `profiles` | 70% — falta camada de tenant |
| Planos SaaS | `company_plans`, `subscriptions`, `tournament_sponsor_plans` | 60% — só p/ empresas, não p/ arenas/organizadores |

**Conclusão:** ~75% da visão já existe em forma de operação single-tenant. Não é necessário recriar nada — é necessário **encapsular** o que existe em uma dimensão tenant.

### 1.2 O que existe mas precisa ser refatorado

| Item | Problema | Refator necessário |
|---|---|---|
| Roles única por user | `user_roles (user_id, role)` é global. Um mesmo user pode ser arena em Org A e atleta em Org B | Adicionar `tenant_id` (nullable p/ global) |
| `arenas` ↔ organizador | Não existe FK. Hoje arena é "do dono", não "da rede do organizador" | Adicionar `organizer_id` em `arenas` |
| Pagamentos MP | `mp_collector_id` está em `profiles` (organizer pessoa) e `arenas` (arena). Sem hierarquia | Mover p/ tabela `payment_accounts` polimórfica (tenant/organizer/arena) |
| `companies` | Mistura "marca de marketplace" com "patrocinador". Hoje funciona, mas escala mal multi-tenant | Manter, adicionar `tenant_id` |
| `enrollments` / `bookings` | Sem `tenant_id`. Tudo é visível globalmente via RLS pública | Adicionar `tenant_id` derivado de tournament/arena |
| Brackets module (recém-refinado) | OK — mas categorias são strings livres em `tournament_modalities` | Adicionar tabela `sports` + `sport_categories` (catálogo) |
| Auth | Login global Supabase. Não há "login dentro do tenant X" | Manter global, adicionar `tenant_memberships` |

### 1.3 Duplicação ou risco de duplicação

| Risco | Onde | Recomendação |
|---|---|---|
| Match results legacy | `match_results` (tabela antiga) vs `modality_matches` (novo) | Marcar `match_results` como deprecated, migrar dados |
| 3 sistemas de "patrocínio" | `tournament_sponsorships`, `arena_partners`, `athlete_sponsors` | Manter — domínios distintos. Documentar fronteira |
| 2 sistemas de chat | `messages` (DM) vs `match_messages` (chat de dupla) | Manter — UX diferente, mas considerar unificar tabela base |
| Planos | `company_plans` + `tournament_sponsor_plans` + (futuro) plano arena/organizador | Unificar em `subscription_plans` polimórfico (`scope: company|sponsorship|arena|organizer`) |
| Saldo | `organizer_balances` (torneios) vs futuro saldo de arena/marketplace | Generalizar para `account_balances` (account_type, account_id) |
| Gateways MP | Lógica espalhada em 4 edge functions (`create-payment`, `create-booking-payment`, `create-marketplace-payment`, `mercadopago-webhook`) | Extrair `_shared/mp.ts` (não duplicar handlers) |

### 1.4 O que falta e precisa ser estruturado

1. **Tenancy (tabela `tenants` / `organizers`)** — não existe. Tudo é flat.
2. **Subdomínio/domínio próprio por organizador** — `arenas.slug` é subpath, não há `tenants.custom_domain`.
3. **Branding por tenant** — sem `tenant_theme` (cores, logo, font_override).
4. **Membership multi-tenant** — usuário pode pertencer a múltiplos tenants com papéis diferentes.
5. **Camada Arena Management interna** (alunos/aulas/professores/matrículas/bar) — **0% existe**. Esta é a maior lacuna.
6. **Catálogo de esportes + categorias canônicas** (Vôlei Praia, Beach Tennis, Futevôlei) — hoje texto livre.
7. **Campos customizados de categoria** — não existe (`custom_fields jsonb` por modalidade).
8. **Tenant context no frontend** — sem `TenantProvider`, sem detecção de subdomínio.
9. **Split em 3 vias** (Mood + Organizador + Arena) — hoje é 2 vias (Mood + collector).
10. **Cobrança recorrente de arena pelo organizador** — não existe pipeline.
11. **QR / Check-in** — 0% existe.
12. **Bridge ORKYM** — sem edge function `orkym-invoke` que centralize chamadas de inteligência.

### 1.5 O que NÃO deve ser criado (já existe equivalente)

- ❌ Nova tabela de "evento" → use `tournaments` (renomear conceitualmente, não fisicamente)
- ❌ Nova tabela de "categoria" → estenda `tournament_modalities`
- ❌ Nova tabela de "partida" → use `modality_matches`
- ❌ Novo sistema de chaveamento → `modality_groups`/`modality_matches`/`modality_placements` cobrem
- ❌ Novo sistema de pagamento → estenda edge functions MP existentes
- ❌ Novo sistema social → `posts`/`clips`/`follows` cobrem
- ❌ Nova tabela de "pedido" → use `marketplace_orders` (com `kind: shop|bar|enrollment`)
- ❌ Novo sistema de auth → Supabase Auth + `user_roles` cobrem (basta adicionar tenant)

---

## ENTREGA 2 — ARQUITETURA ALVO

### 2.1 Modelo Hierárquico Oficial

```
PLATAFORMA (MoodPlay Global)
   └── TENANT (Organizador White-Label)            ← NOVO
        ├── domínio próprio
        ├── branding próprio
        ├── plano SaaS próprio
        ├── gateway MP próprio
        └── ARENAS (N por tenant)                  ← refator: arenas.organizer_id
             ├── gestão operacional
             ├── gateway MP próprio (opcional)
             └── recursos:
                  ├── courts + bookings (existe)
                  ├── tournaments + enrollments (existe)
                  ├── students/classes/teachers   ← NOVO MÓDULO
                  ├── shop/bar orders             ← extensão de marketplace_orders
                  └── access (QR/check-in)        ← NOVO MÓDULO
```

### 2.2 Divisão Core / Módulos / Extensões

**CORE PLATFORM (não pertence a domínio específico)**
- `tenants` (NOVO) + `tenant_memberships` (NOVO)
- Auth (Supabase) + `user_roles` (refatorada com tenant_id)
- `subscription_plans` (unificada) + `subscriptions`
- `payment_accounts` (NOVO, polimórfica) — substitui `mp_collector_id` espalhados
- `account_balances` (generalização de `organizer_balances`)
- `financial_ledger` (já existe — adicionar tenant_id)
- Bridge ORKYM (edge function `orkym-invoke`)

**MÓDULOS POR DOMÍNIO**
- **Arenas:** `arenas`, `courts`, `court_availability`, `court_blocks`, `bookings`, `arena_links`, `arena_partners`, `arena_physical_inventory`
- **Eventos/Torneios:** `tournaments`, `tournament_modalities`, `modality_*`, `enrollments`, `tournament_sponsorships`, `tournament_partners`, `match_*`, `tournament_match_pool`
- **Marketplace:** `companies`, `company_plans`, `products`, `marketplace_orders`
- **Social:** `posts`, `post_media`, `clips`, `comments`, `likes`, `follows`, `messages`, `mentions`, `hashtags`, `sponsored_posts`, `profile_highlights`, `post_saves`
- **Arena Internal (NOVO MÓDULO):** `students`, `student_enrollments` (matrículas em planos), `teachers`, `classes`, `class_attendances`, `arena_orders` (bar/lojinha — pode ser kind em `marketplace_orders`), `access_tokens` (QR)

**EXTENSÕES (não duplicar — só adicionar colunas/tabelas filhas)**
- `tournament_modalities` + `sport_id` + `category_id` + `custom_fields jsonb`
- `arenas` + `organizer_id (tenant)` + `mp_account_id (FK payment_accounts)`
- `tournaments` + `tenant_id` (denormalizado p/ RLS rápida)
- `bookings/enrollments/orders` + `tenant_id` (denormalizado)

### 2.3 Fronteira MoodPlay × ORKYM

| MoodPlay (operação) | ORKYM (inteligência) |
|---|---|
| Renderizar bracket | Sortear bracket otimizado |
| Listar slots livres | Sugerir melhor slot p/ aluno |
| Cadastrar aluno | Prever churn / engajamento |
| Mostrar ranking | **Calcular** ranking ponderado |
| Exibir matchpool | **Recomendar** parceiros |
| Listar produtos | **Recomendar** produtos |
| Mostrar feed | **Ordenar** feed |
| Lançar pagamento | **Anti-fraude** / análise de risco |
| CRUD eventos | Sugerir formato/horário ideal |
| Mostrar saldo | Forecast / alertas financeiros |
| Receber webhook MP | Categorizar transação semanticamente |

**Bridge único:** todas as chamadas a ORKYM passam por uma edge function `orkym-invoke({domain, action, payload})` — nunca chamadas diretas espalhadas.

---

## ENTREGA 3 — ROADMAP DE EVOLUÇÃO

### Fase 1 — Foundation (multi-tenant base) — risco baixo
1. Criar `tenants` + `tenant_memberships`
2. Adicionar `tenant_id` (nullable) em `arenas`, `tournaments`, `companies`, `products`, `bookings`, `enrollments`, `marketplace_orders`, `posts`, `subscriptions`
3. Criar função `current_tenant()` SECURITY DEFINER + atualizar RLS gradualmente (com fallback p/ NULL = global)
4. Criar `TenantProvider` no frontend (detecta subdomínio → carrega tenant + branding)
5. Migrar dados existentes para um tenant "default-mood"
6. Criar `tenant_themes` (logo, cores, font)

### Fase 2 — Organizer White-Label — risco médio
1. Onboarding de organizador (cria tenant + theme + plano)
2. Custom domain via `tenants.custom_domain` + middleware roteamento
3. Painel `/orgs/:slug/admin` (reaproveita AdminLayout, filtra por tenant_id)
4. Plano SaaS de organizador (estende `subscription_plans` com `scope='organizer'`)

### Fase 3 — Arena Management interno — risco médio
1. Refator `arenas` para ter `organizer_id (tenant)`
2. **Novo módulo**: `students`, `teachers`, `classes`, `class_attendances`, `student_enrollments`
3. Estender `marketplace_orders` com `kind enum (shop|bar|class|booking)` + `arena_id` (em vez de criar `arena_orders` separado)
4. QR check-in: tabela `access_tokens (user_id, scope, scope_id, expires_at, qr_code)`
5. Painel `/arena/dashboard` ganha abas: Alunos, Aulas, Professores, Bar, Acessos

### Fase 4 — Tournaments evolution — risco baixo
1. Criar `sports` (catálogo: Vôlei Praia, Beach Tennis, Futevôlei) + `sport_categories`
2. Adicionar `sport_id`, `category_id`, `custom_fields jsonb` em `tournament_modalities`
3. UI seleciona esporte → sugere categorias canônicas → permite extras
4. (Já feito na última entrega: refino visual Rankup)

### Fase 5 — Payments & Split 3-vias — risco alto
1. Criar `payment_accounts` polimórfica
2. Migrar `mp_collector_id` de `profiles`/`arenas` p/ `payment_accounts`
3. Refatorar edge functions MP para `_shared/mp.ts` com helper `splitThreeWays(mood%, organizer%, arena%)`
4. Generalizar `organizer_balances` → `account_balances`
5. Cobrança automática de arena pelo organizador (cron + `subscriptions`)

### Fase 6 — Growth: Marketplace, Ads, Social globais — risco baixo
1. Decisão: marketplace é global (cross-tenant) ou por tenant? **Recomendação: global**, com filtro opcional por tenant
2. Ads → ORKYM ranqueia, MoodPlay renderiza
3. Social: feed global por padrão; posts marcados com `tenant_id` permitem filtro contextual
4. Auto-criação de perfil social ao se inscrever em torneio (já existe via `handle_new_user` — só estender)

---

## ENTREGA 4 — REGRAS DE NÃO DUPLICAÇÃO

### 4.1 PROIBIDO recriar (existe equivalente)
- Sistema de torneio, modalidade, grupos, partidas, placements
- Sistema de inscrição em torneio
- Sistema de pagamento MP (PIX/cartão/split)
- Sistema de quadras + agenda + bookings
- Sistema social (posts/clips/likes/comments/follows/DMs)
- Sistema de marketplace + ordens
- Sistema de patrocínio (3 dimensões: torneio, arena, atleta)
- Sistema de roles
- Sistema de companies + planos

### 4.2 OBRIGATÓRIO reaproveitar
- `user_roles` + `has_role()` para qualquer permissão
- `is_arena_owner`, `is_tournament_owner`, `is_modality_tournament_owner` para RLS
- `tournaments` para qualquer "evento" (não criar tabela `events`)
- `marketplace_orders` para qualquer "pedido" (bar, loja, aula avulsa)
- `subscriptions` para qualquer recorrência (arena→organizador, organizador→Mood, atleta→arena)
- Edge functions MP (`create-*-payment`, `*-webhook`) — só estender com helpers compartilhados
- Buckets storage existentes (`arena-images`, `tournament-images`, `post-images`, `company-images`, `tournament-files`)

### 4.3 OBRIGATÓRIO delegar para ORKYM
- Sorteio inteligente de chaveamento
- Ranking calculado / pontuação / pesos
- Recomendação de parceiros (matchpool)
- Recomendação de produtos / feed ordering
- Forecast financeiro / alertas / churn
- Anti-fraude pagamentos
- Sugestão de horários ótimos (alunos, aulas, torneios)
- Categorização semântica de posts/transações
- Geração de posts patrocinados (já é IA — `generate-sponsored-posts` deve virar proxy p/ ORKYM)
- Qualquer "decidir / prever / otimizar / recomendar"

---

## INCONSISTÊNCIAS E RISCOS DE ESCALA (sem suavizar)

1. **Ausência total de tenant_id** — toda a base é single-tenant disfarçada. RLS pública (`USING (true)`) em quase toda leitura. Em multi-tenant real isso vaza dados entre organizadores. **Bloqueador.**
2. **Sem foreign keys formais** em quase nenhuma tabela — relacionamentos só lógicos. Em escala, isso gera órfãos e impossibilita CASCADE limpo.
3. **`pending_payment` sem TTL** — slots/inscrições ficam travados. Crítico em arena com alta rotação.
4. **`mp_collector_id` em 2 tabelas diferentes** — quando vier 3ª (organizador), vira caos. Refatorar p/ `payment_accounts` antes.
5. **Webhooks MP sem validação HMAC** — risco de spoofing.
6. **`is_active` da arena não cascateia** — quadras de arena inativa continuam visíveis.
7. **Sem CHECK constraint** em horários (`end_time > start_time`).
8. **`match_results` e `modality_matches` coexistem** — débito técnico.
9. **Planos fragmentados** (`company_plans`, `tournament_sponsor_plans`) — vai virar 5+ tabelas se não unificar agora.
10. **Sem catálogo de esportes** — categorias livres geram dados sujos, impossibilita ranking cruzado entre torneios.

---

## RECOMENDAÇÃO FINAL

**Evoluir incrementalmente, NÃO recriar.** A base atual cobre ~75% da visão. O salto white-label é uma **dimensão transversal (tenant)** — não um sistema novo. Com:

1. 1 tabela `tenants` + 1 `tenant_memberships`
2. 1 coluna `tenant_id` em ~10 tabelas (nullable, default tenant global)
3. 1 função `current_tenant()` + atualização gradual de RLS
4. 1 `TenantProvider` no frontend
5. 1 bridge `orkym-invoke`

…o MoodPlay vira white-label sem quebrar nada. **Único módulo realmente novo:** Arena Management interno (alunos/aulas/professores/QR). Todo o resto é refator + extensão.

**Fronteira ORKYM definida:** MoodPlay nunca pensa, só executa e renderiza. Toda chamada de inteligência passa pelo bridge único.

