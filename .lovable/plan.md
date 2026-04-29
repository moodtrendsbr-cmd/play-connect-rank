
# Auditoria — Gamificação & Monetização Social no MoodPlay

> **Modo diagnóstico.** Nenhuma tabela, rota, view, RPC ou edge function será alterada nesta fase. Este documento serve como **mapa de decisão arquitetural** antes de qualquer evolução.

---

## 1. Resumo executivo

O MoodPlay já tem **75% da fundação social/financeira** pronta — identidade phone-first, feed de eventos automático via triggers, ads, sponsorships, splits, attribution ORKYM. O que falta é **a camada explícita de gamificação** (níveis, badges, streaks, ranking persistente) e **monetização social self-service** (empresa/arena/organizador criando destaques sem passar pelo admin).

Veredicto direto:
- **Identidade & feed social**: pronto e funcionando (Fase Social-1 cobriu isso).
- **Histórico esportivo**: existe via `athlete_activities` + `modality_matches`, mas é cru — não vira "perfil de atleta com stats".
- **Ranking**: existe parcialmente, mas inconsistente — três fontes diferentes (`Ranking.tsx` calcula no client a partir de `match_results`, RPC `get_athlete_ranking` lê uma tabela `athlete_rankings` que **não existe**, view `athletes_public` agrega wins).
- **Gamificação (níveis/badges/streaks/conquistas)**: **inexistente**. Zero schema, zero UI, zero menção.
- **Monetização social**: estrutura existe (ads, sponsorships, sponsored_posts, marketplace, splits, attribution), mas **operada quase 100% por admin**. Tabelas vazias em produção (`ad_campaigns=0`, `sponsored_posts=0`, `tournament_sponsorships=0`).
- **ORKYM**: já recebe sinais via `social_events` e `orkym_revenue_attribution`, mas **não há triggers de gamificação** ("você está perto do nível 5", "sua streak vai quebrar").

---

## 2. Estruturas existentes — inventário

### 2.1 Identidade e perfil social

| Recurso | Existe? | Em uso? | Onde | Observação |
|---|---|---|---|---|
| `profiles` (base) | Sim | Sim | toda app | FK em auth.users |
| `profiles_public` (view) | Sim | Sim | feed, perfis | Colunas seguras |
| `social_identities` (phone-first) | Sim | Sim (6 rows) | wa-bridge | Unifica WA + auth + guest |
| `social_profiles` | Sim | Sim (6 rows) | `/u/:username`, feed | username, visibility, bio |
| `social_profiles_public` (view) | Sim | Sim | feed v2 | Filtra visibility |
| `social_event_description` (RPC) | Sim | Sim | view | Templates determinísticos |
| `social_identity_upsert` (RPC) | Sim | Sim | wa-bridge | Phone → identity |
| `social_identity_for_user` (RPC) | Sim | Sim | SocialPrivacyToggle | |
| `social_profile_set_visibility` (RPC) | Sim | Sim | privacy toggle | |

### 2.2 Histórico esportivo / atividades

| Recurso | Existe? | Em uso? | Alimentado por |
|---|---|---|---|
| `athlete_activities` (49 rows) | Sim | Sim | 4 triggers (enrollments, modality_matches, arena_attendance, posts/clips) |
| `athlete_activities_public` (view) | Sim | Sim | UserProfile / SocialProfile |
| `athletes_public` (view, agrega wins/participations/attendances) | Sim | Sim | Explore, Ranking secundário, search_global |
| `social_events` (28 rows) | Sim | Sim | 4 triggers (`trg_social_from_*`) |
| `social_feed_public_v2` (view) | Sim | Sim | Feed.tsx, SocialActivityFeed, SocialProfile |
| `modality_matches` (69 rows) | Sim | Sim | brackets, alimenta activities |
| `match_results` | Sim | Sim | Ranking.tsx (client-side) |
| `arena_attendance` (0 rows) | Sim | Estrutura | aulas (Phase 3) |
| `enrollments` (28 rows) | Sim | Sim | torneios |

> **Duplicação detectada**: `athlete_activities` e `social_events` registram **eventos quase idênticos** (`tournament.match_won` vs `match_win`, `tournament.checked_in` vs `checkin`). Os triggers de `social_events` na verdade leem de `athlete_activities`, então não é duplicação destrutiva — é uma **camada de projeção**. Mas significa que adicionar evento novo exige tocar dois lugares.

### 2.3 Ranking

| Fonte | Status |
|---|---|
| `Ranking.tsx` calcula client-side a partir de `match_results` | **Funciona, mas frágil** — sem paginação, sem categoria, sem modalidade |
| RPC `get_athlete_ranking` lê `athlete_rankings` | ⚠️ **Tabela `athlete_rankings` NÃO existe** — RPC retorna sempre `[]` com note `rankings_table_unavailable` |
| `athletes_public` agrega wins | Funciona, é a base real |
| `get_tournament_standings` lê `enrollments` | Funciona mas não calcula colocação real |

### 2.4 Monetização — ads, sponsorships, marketplace, finance

| Tabela | Rows | Em uso real? | Quem opera |
|---|---|---|---|
| `ad_campaigns` | 0 | UI existe (AdSlot, AdminAdCampaigns) | **Só admin** |
| `ad_slots` | 5 | Sim | Admin |
| `ad_events` | 0 | Sim (`ad_record_event`) | Auto |
| `ads_public` (view) | — | Sim (AdSlot) | — |
| `sponsored_posts` | 0 | UI existe (SponsoredPostCard) | **Só admin/cron** (`generate-sponsored-posts`) |
| `tournament_sponsorships` | 0 | UI existe (SponsorTournamentDialog) | Empresa **pode** comprar (sponsor flow funciona) |
| `tournament_sponsor_plans` | — | Sim | Organizer cria plano |
| `athlete_sponsors` | — | Existe | Não auditado UI |
| `sponsorship_giveaways` | — | Existe | Admin |
| `products` | 6 | Sim | Empresa/admin |
| `marketplace_orders` | 5 | Sim | MP webhook |
| `marketplace_public` (view) | — | Sim | Marketplace |
| `financial_transactions` | 4 | Sim | MP webhook |
| `transaction_splits` | 8 | Sim | `finance_record_payment` |
| `split_rules` | — | Sim | Admin |
| `orkym_revenue_attribution` | 4 | Sim | Trigger `tg_orkym_attribute_revenue` em `financial_transactions` paid |

### 2.5 ORKYM — engajamento e proatividade

| Recurso | Existe? | Pode receber sinal de gamificação? |
|---|---|---|
| `orkym_triggers_queue` | Sim | Sim, é o canal correto |
| `orkym_proactive_eligibility` | Sim | Cooldown e opt-in |
| `orkym_revenue_attribution` | Sim | proactive/assisted/reactive |
| `orkym_trigger_feedback` | Sim | Loop de aprendizado |
| Triggers existentes | Reativação, upsell genérico | **Nenhum trigger de "streak", "level-up", "near-badge"** |

---

## 3. Maturidade — classificação brutal

### Gamificação

| Item | Status | Observação |
|---|---|---|
| Histórico de partidas | 🟢 pronto | `modality_matches` + `athlete_activities` |
| Ranking por wins (global) | 🟡 parcial | Funciona client-side, sem categoria/modalidade |
| Ranking por torneio | 🟡 parcial | `get_tournament_standings` retorna lista, não classificação real |
| Ranking por arena | 🔴 inexistente | Nenhum agregado |
| Pontuação | 🟡 parcial | `wins * 10` hardcoded em Ranking.tsx |
| **Nível do atleta** | 🔴 inexistente | Sem schema, sem UI |
| **Badges/conquistas** | 🔴 inexistente | Zero |
| **Streak (presença/jogos)** | 🔴 inexistente | Zero |
| **Frequência** | 🔴 inexistente | Há `arena_attendance` mas sem agregação |
| Estatísticas no perfil | 🟡 parcial | `athletes_public` tem wins/participations/attendances; `get_athlete_performance` calcula winrate em `matches` (tabela diferente de `modality_matches` ⚠️) |
| Perfil social | 🟢 pronto | `/u/:username` |
| Feed de atividades | 🟢 pronto | Feed.tsx + SocialActivityFeed |

### Monetização social

| Item | Status | Observação |
|---|---|---|
| Ads (campanhas/slots/events) | 🟢 schema pronto, 🔴 **sem auto-serviço** | Só admin cria campanha |
| Slot público no feed | 🟢 pronto | `AdSlot code="feed.inline"` |
| Empresa patrocinadora (sponsorships) | 🟢 pronto | Empresa compra plano de torneio |
| Produtos destacados | 🟡 parcial | Existe `products`, sem flag "boost"/"featured" pago |
| Eventos destacados (torneios) | 🔴 inexistente | Sem mecânica de "boost" pago para tornar torneio destaque |
| Marketplace público | 🟢 pronto | `marketplace_public` |
| Feed patrocinado | 🟢 schema, 🟡 operação | `sponsored_posts` existe mas alimentado por cron, não por empresa |
| Revenue attribution ORKYM | 🟢 pronto | `orkym_revenue_attribution` |
| Split financeiro | 🟢 pronto | `transaction_splits` |
| **Self-service de destaque (empresa)** | 🔴 inexistente | Nenhuma página "destacar meu produto/evento" |
| **Tenant vendendo destaque** | 🔴 inexistente | TenantDashboard mostra receita, mas não vende slots |
| **Arena vendendo patrocínio** | 🔴 inexistente | Sem fluxo |
| Relatório de campanha p/ empresa | 🟡 parcial | CompanyDashboard mostra cliques/impressões mas dados zerados |

---

## 4. Dashboards — o que aparece hoje

| Shell | Tem | Falta |
|---|---|---|
| Athlete | atividades, próximas partidas, performance básica | nível, badges, streak, progresso, próxima conquista |
| Arena | finance, alunos, classes | ranking de alunos, alunos mais ativos, oportunidade de patrocínio |
| Organizer | finance, torneios, members | engajamento de torneio, ranking do evento, destaque |
| Company | sponsor bridge, dashboard básico | métricas reais de campanha (dados zerados), CTA "destacar produto" |
| Tenant | revenue, control tower | venda de destaques, empresas ativas no tenant |
| Admin | ads, monetização, sponsorships, control tower | painel unificado de "saúde social" |

---

## 5. Privacidade — checklist

| Verificação | Status |
|---|---|
| Dados públicos vêm de views `security_invoker=on` | ✅ Sim (todas `*_public`) |
| Atleta pode ficar privado | ✅ `social_profile_set_visibility` |
| Empresa controla visibilidade | 🟡 só via approved/active |
| Feed evita spam | ⚠️ **não há dedup explícito** entre `social_events` repetidos (ex: múltiplos checkins no mesmo dia) |
| Eventos repetidos agrupados | 🔴 não |
| Dados sensíveis não vazam | ✅ payments excluídos do feed v2 |
| Patrocinado é identificado | ✅ `SponsoredPostCard` e `AdSlot` mostram badge "Patrocinado" |

---

## 6. Riscos e gaps

### Riscos

1. **`athlete_rankings` referenciada por RPC mas não existe** → `get_athlete_ranking` é dead code silencioso. Qualquer caller pensa que está pegando ranking real.
2. **Duas fontes de "matches"**: `matches` (usada em `get_athlete_performance`) e `modality_matches` (real, usada em brackets). Performance retornada para ORKYM provavelmente é zerada.
3. **Duplicação `athlete_activities` ↔ `social_events`**: cada evento novo precisa ser projetado em dois lugares. Risco de drift.
4. **Spam de feed**: sem dedup, um atleta que faz 5 checkins seguidos polui o feed global.
5. **Ranking client-side**: Ranking.tsx puxa todos os `match_results` para o cliente. Não escala.

### Gaps de gamificação

- Sem `athlete_levels`, `athlete_badges`, `athlete_streaks`, `achievement_definitions`.
- Sem fórmula de XP unificada.
- Sem trigger ORKYM "near level-up", "streak prestes a quebrar", "primeiro badge".
- Sem ranking persistente (matview ou tabela).

### Gaps de monetização social

- Empresa não tem fluxo self-service para criar campanha de ad ou destaque de produto.
- Organizer não tem fluxo para "boost de torneio" pago.
- Arena não tem fluxo para vender patrocínio local (slot na arena, destaque entre alunos).
- Tenant não tem painel de "marketplace de destaques" próprio.
- Sem `featured_until` em `products` / `tournaments` para destaque pago temporário.

---

## 7. Reaproveitamento — o que NÃO precisa ser refeito

- **Identidade phone-first** (`social_identities`): base sólida para qualquer nova feature social.
- **`social_events` + view v2**: pipeline pronto para receber novos `event_type` (level_up, badge_earned, streak_milestone) sem nova arquitetura.
- **`orkym_triggers_queue` + `orkym_revenue_attribution`**: canal para todo trigger de gamificação e attribution de upsell.
- **`ad_campaigns` + `ad_slots` + `ad_record_event`**: schema completo, só faltam **fluxos self-service** em cima.
- **`transaction_splits` + `split_rules`**: qualquer destaque pago entra direto no split engine.
- **`tournament_sponsorships` + `tournament_sponsor_plans`**: padrão a replicar para arena_sponsorships e product_features.

---

## 8. Recomendação de arquitetura (sem implementar)

Princípio: **não criar mundo paralelo de gamificação** — usar `social_events` como espinha dorsal e adicionar 3 tabelas finas + 1 RPC de cálculo determinístico.

```text
                    ┌─────────────────────────┐
                    │   social_events         │ (já existe)
                    │   (event_type +payload) │
                    └─────────┬───────────────┘
                              │ projeção via trigger
              ┌───────────────┼───────────────────────┐
              ▼               ▼                       ▼
      athlete_xp_ledger   athlete_streaks      athlete_badges
      (append-only)       (current+best)       (earned_at)
              │               │                       │
              └───────────────┴───────────┬───────────┘
                                          ▼
                                athlete_stats (matview)
                                          │
                                          ▼
                                  ORKYM triggers
                                  (near-level, streak-risk)
```

Para monetização: **um padrão único de "boost"** (`featured_listings`) que cobre torneio em destaque, produto em destaque, post patrocinado por empresa, com `featured_until`, `paid_via_transaction_id`, e split automático.

---

## 9. Próximas fases sugeridas (ordem de impacto vs custo)

| Fase | Escopo | Por quê primeiro |
|---|---|---|
| **G-0 Cleanup** | Remover/corrigir `get_athlete_ranking` + `get_athlete_performance` (apontar p/ `modality_matches`); add dedup em `social_events` | Tira riscos silenciosos antes de empilhar |
| **G-1 Stats canônicas** | matview `athlete_stats` (wins, losses, winrate, attendances, last_active, total_xp); RPC `get_athlete_card`; integrar em UserProfile/SocialProfile/ORKYM | Fundação única para todo resto |
| **G-2 XP & Níveis** | `athlete_xp_ledger` + trigger projetando de `social_events` com tabela determinística de XP (win=50, checkin=10, etc.); `level = floor(sqrt(total_xp/100))` | Pequeno, deterministico, alto impacto visual |
| **G-3 Badges & Streaks** | `achievement_definitions` (seed), `athlete_badges`, `athlete_streaks`; trigger projetando; emit `social_events` `badge_earned`/`streak_milestone` | Reusa pipeline social existente |
| **G-4 Ranking persistente** | matview por modalidade/categoria/cidade; refresh agendado; substitui Ranking.tsx client-side | Resolve dívida + escala |
| **M-1 Featured listings unificado** | tabela `featured_listings` + checkout via MP + split + `featured_until` | Self-service para empresa/organizer/arena |
| **M-2 Self-service de ads** | Páginas Company/Organizer para criar `ad_campaigns` direto, com aprovação leve do admin | Liga schema existente ao usuário final |
| **M-3 Tenant marketplace de destaques** | TenantShell com painel "vender slots no meu tenant" | Multi-tenant revenue |
| **O-1 ORKYM gamification triggers** | novos triggers: near-level, streak-risk, first-badge, ranking-climb | Loop de retenção |
| **O-2 ORKYM revenue triggers** | sugerir featured/sponsorship com base em performance do atleta/torneio | Loop de monetização |

---

## 10. Decisões pendentes (precisam de você antes de codar)

1. **Fórmula de XP** deve ser fixa (hardcoded em SQL) ou configurável por tenant?
2. **Badges**: catálogo global único ou pode ter badges custom por arena/torneio?
3. **Streak**: por presença em aula, por jogo disputado, ou ambos contam pra mesma streak?
4. **Featured listings**: empresa precisa de aprovação admin antes de ir ao ar, ou aprovação automática com kill-switch?
5. **Ranking**: global único ou um por modalidade × categoria × cidade?

---

## 11. Conclusão

O MoodPlay está **muito mais perto** de ter gamificação e monetização social do que parece — a fundação social, financeira e ORKYM já está madura. O trabalho real não é "construir do zero", é:

1. **Limpar dívidas silenciosas** (RPCs apontando para tabelas inexistentes, duplicação de pipeline).
2. **Criar 3 tabelas finas** (XP ledger, badges, streaks) que projetam de `social_events`.
3. **Padronizar "boost pago"** numa única tabela `featured_listings` reutilizada por todos os atores.
4. **Conectar ORKYM** aos sinais que já existem mas ninguém escuta (near-level, streak-risk, ranking-climb).

Não há necessidade de IA local, nem de novo mundo paralelo. A arquitetura atual sustenta tudo isso.

**Aguardando suas respostas para as 5 decisões pendentes** antes de propor o plano executável da Fase G-0/G-1.
