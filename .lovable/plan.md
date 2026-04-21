

# Fase 6 — Marketplace + Ads + Social Graph

Camada de **crescimento e descoberta** sobre Fases 1-5.5. Reusa massivamente o que já existe. Zero IA local, zero duplicação, zero quebra de segurança. Tudo público vai por **view** com `security_invoker`.

---

## 0. Auditoria — reuso obrigatório

| Já existe | Decisão Fase 6 |
|---|---|
| `profiles` + `profiles_public` (view) | Base do "atleta" — não criar `athlete_profiles`. Adicionar view `athletes_public` derivada com stats agregados. |
| `match_results`, `enrollments`, `arena_attendance`, `modality_matches`, `posts`, `clips` | Fontes de atividade — alimentam `athlete_activities` via triggers. |
| `products` + `marketplace_orders` + `companies_public` | Marketplace já existe e já passa por `finance_record_payment` via trigger. **Não recriar.** Apenas estender produtos para suportar serviço + criar view pública. |
| `tournament_sponsorships`, `sponsored_posts`, `tournament_sponsor_plans` | Patrocínio de torneio já existe. Generalizar para **campanhas globais** sem rebuild. |
| `follows`, `posts`, `clips`, `hashtags`, `likes`, `comments` | Social interactions já cobertos. Feed atual lê direto. |
| `arena_operational_events` | Reusar para eventos de discovery (impressions/clicks) + ganchos ORKYM. |

**Não criar:** novo perfil de atleta, novo marketplace, nova engine de pagamento, novo sistema de feed social.

---

## BLOCO A — Social Graph (athlete activities + ranking)

### A.1 Tabela nova: `athlete_activities` (única tabela do bloco)
Append-only. Trilha unificada do que cada atleta faz.
```
id uuid PK, athlete_id uuid NOT NULL (= profiles.user_id),
tenant_id uuid, arena_id uuid (nullable),
activity_type text CHECK IN (
  'tournament.enrolled','tournament.checked_in','tournament.match_won','tournament.match_lost','tournament.placed',
  'class.attended','class.enrolled',
  'social.posted','social.clip_posted'
),
reference_type text, reference_id uuid,
metadata jsonb DEFAULT '{}',
created_at timestamptz DEFAULT now()
```
INDEX `(athlete_id, created_at DESC)`, `(activity_type, created_at DESC)`, `(tenant_id, created_at DESC)`.
RLS: SELECT público via view (não direto). INSERT só via SECURITY DEFINER triggers.

### A.2 Triggers leves (4) — populam `athlete_activities` automaticamente
- `enrollments` AFTER INSERT/UPDATE → `tournament.enrolled` quando criado, `tournament.checked_in` quando `checked_in_at` muda.
- `modality_matches` AFTER UPDATE quando `winner_entry_id` muda → resolve atleta(s) via `modality_entries` → emite `tournament.match_won`/`match_lost` para cada participante.
- `arena_attendance` AFTER INSERT quando `status='present'` → resolve `profile_user_id` via `arena_students` → `class.attended`.
- `posts` AFTER INSERT → `social.posted` (e `clips` AFTER INSERT → `social.clip_posted`).

### A.3 View pública: `athletes_public`
```sql
CREATE VIEW athletes_public WITH (security_invoker=on) AS
SELECT p.user_id, p.full_name, p.avatar_url, p.bio, p.city, p.state, p.team, p.titles,
       COALESCE(s.wins, 0) AS wins,
       COALESCE(s.participations, 0) AS participations,
       COALESCE(s.attendances, 0) AS attendances,
       COALESCE(s.last_activity_at, p.created_at) AS last_activity_at,
       p.created_at
FROM profiles_public p
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE activity_type='tournament.match_won') AS wins,
    count(*) FILTER (WHERE activity_type='tournament.enrolled') AS participations,
    count(*) FILTER (WHERE activity_type='class.attended') AS attendances,
    max(created_at) AS last_activity_at
  FROM athlete_activities WHERE athlete_id = p.user_id
) s ON true;
```
GRANT SELECT TO anon, authenticated.

### A.4 View pública: `athlete_activities_public`
Filtro: somente activities com `reference_type` cuja entidade-fonte é pública (torneios públicos, posts públicos). Restringe metadata sensível.

### A.5 Backfill one-shot
UPDATE: popular `athlete_activities` a partir de `match_results`/`enrollments`/`arena_attendance` históricos (DO block na migration, idempotente via `ON CONFLICT DO NOTHING` em `(athlete_id, activity_type, reference_id)` UNIQUE parcial).

---

## BLOCO B — Marketplace (extensão mínima)

### B.1 Extensão `products` (ALTER ADD COLUMN IF NOT EXISTS)
- `kind text DEFAULT 'physical' CHECK IN ('physical','service','class_pass','event_ticket')`
- `service_arena_id uuid` (quando `kind='service'`, vincula à arena)
- `service_duration_minutes int`

### B.2 View pública: `marketplace_public`
```sql
CREATE VIEW marketplace_public WITH (security_invoker=on) AS
SELECT p.id, p.name, p.description, p.price, p.image_urls, p.kind, p.featured,
       p.company_id, c.name AS company_name, c.logo_url AS company_logo, c.city, c.state,
       p.service_arena_id, p.created_at
FROM products p
JOIN companies c ON c.id = p.company_id
WHERE p.status = 'approved' AND c.status = 'approved';
```

### B.3 Integração financeira — **já existe**
`trg_marketplace_record_payment` já chama `finance_record_payment('marketplace_order', ...)`. Sem mudanças.

---

## BLOCO C — Ads / Patrocínio interno (generalização)

### C.1 Tabelas novas (3)

**`ad_campaigns`** — campanhas globais (não só torneio)
```
id uuid PK, tenant_id uuid NOT NULL, company_id uuid NOT NULL (FK companies),
name text, kind text CHECK IN ('feed_highlight','tournament_highlight','arena_highlight','marketplace_highlight'),
target_type text NULL, target_id uuid NULL,           -- ex: arena_id ou tournament_id quando aplicável
title text, image_url text, link text, cta_label text,
budget numeric(10,2) DEFAULT 0, status text CHECK IN ('pending','active','paused','ended','rejected') DEFAULT 'pending',
starts_at timestamptz, ends_at timestamptz,
priority int DEFAULT 0,
created_at, updated_at
```

**`ad_slots`** — slots fixos da plataforma (catálogo)
```
id uuid PK, code text UNIQUE,                          -- ex: 'home.hero','feed.inline','arena.banner'
name text, description text, max_active int DEFAULT 1,
created_at
```
Seed inicial: `home.hero`, `feed.inline`, `tournaments.list_top`, `arena.banner`, `marketplace.featured`.

**`ad_placements`** — vínculo campanha ↔ slot
```
id uuid PK, campaign_id FK, slot_id FK, weight int DEFAULT 1,
UNIQUE(campaign_id, slot_id)
```

**`ad_events`** (opcional leve, append-only) — impressões/clicks agregados
```
id uuid PK, campaign_id FK, slot_id FK, event_type text CHECK IN ('impression','click'),
viewer_id uuid NULL, occurred_at timestamptz DEFAULT now(),
metadata jsonb
```
Particionamento? Não nessa fase — apenas índice em `(campaign_id, occurred_at DESC)`.

### C.2 RLS
- `ad_campaigns`: SELECT para admin + `is_company_owner`. UPDATE/INSERT mesmo. Aprovação (`status`) só admin.
- `ad_slots`: SELECT público via view; ALL só admin.
- `ad_placements`: idem campaigns.
- `ad_events`: INSERT público (RPC `ad_record_event`), SELECT só admin/dono da campanha.

### C.3 View pública: `ads_public`
```sql
CREATE VIEW ads_public WITH (security_invoker=on) AS
SELECT ac.id, ac.kind, ac.target_type, ac.target_id, ac.title, ac.image_url, ac.link, ac.cta_label,
       ac.priority, asl.code AS slot_code, c.name AS company_name, c.logo_url AS company_logo
FROM ad_campaigns ac
JOIN ad_placements ap ON ap.campaign_id = ac.id
JOIN ad_slots asl ON asl.id = ap.slot_id
JOIN companies c ON c.id = ac.company_id
WHERE ac.status='active' AND now() BETWEEN ac.starts_at AND ac.ends_at AND c.status='approved';
```

### C.4 RPC `ad_record_event(_campaign_id, _slot_id, _event_type)`
SECURITY DEFINER. Insere em `ad_events` + opcional `arena_operational_events` se `target_type='arena'`. Sem rate-limit pesado nesta fase (nota em pendências).

### C.5 Integração financeira
Quando campanha é paga (futuro): `finance_record_payment('ad_campaign', campaign_id, ...)`. **Estrutura pronta** — só precisa adicionar `'ad_campaign'` ao CHECK de `financial_transactions.source_type` e seed em `split_rules`. Hoje, campanhas criadas em modo manual/free.

---

## BLOCO D — Discovery / Feed global

### D.1 View `social_feed_public` (não tabela — view materializada lógica via UNION)
```sql
CREATE VIEW social_feed_public WITH (security_invoker=on) AS
-- Posts públicos
SELECT 'post'::text AS item_type, p.id AS item_id, p.author_id AS actor_id,
       NULL::uuid AS arena_id, p.tenant_id, p.created_at,
       jsonb_build_object('content', p.content, 'type', p.type) AS payload
FROM posts p
UNION ALL
-- Atividades de atleta (vitórias, presenças, conquistas)
SELECT 'activity', aa.id, aa.athlete_id, aa.arena_id, aa.tenant_id, aa.created_at,
       jsonb_build_object('activity_type', aa.activity_type, 'metadata', aa.metadata)
FROM athlete_activities aa
WHERE aa.activity_type IN ('tournament.match_won','tournament.placed','tournament.checked_in')
UNION ALL
-- Anúncios ativos
SELECT 'ad', ac.id, NULL, NULL, ac.tenant_id, ac.created_at,
       jsonb_build_object('title', ac.title, 'image_url', ac.image_url, 'link', ac.link, 'kind', ac.kind)
FROM ad_campaigns ac
WHERE ac.status='active' AND now() BETWEEN ac.starts_at AND ac.ends_at
UNION ALL
-- Torneios novos publicados
SELECT 'tournament', t.id, t.organizer_id, NULL, t.tenant_id, t.created_at,
       jsonb_build_object('name', t.name, 'start_date', t.start_date)
FROM tournaments t
WHERE t.is_published = true;
```
GRANT SELECT TO anon, authenticated. ORDER BY na consulta cliente (`order by created_at desc limit ...`).

### D.2 Busca unificada — RPC `search_global(_term text)`
SECURITY DEFINER, `STABLE`. Retorna jsonb com 4 buckets: athletes, arenas, tournaments, products. Cada bucket: top 5 por ILIKE no nome. Lê só de views públicas. Sem full-text nesta fase (nota em pendências).

---

## Frontend — telas e edits

| Rota | Arquivo | Função |
|---|---|---|
| `/explore` (nova) | `Explore.tsx` | Hub de descoberta: busca global + 4 sessões (atletas em alta, torneios, produtos em destaque, arenas) |
| `/athletes` (nova) | `AthletesList.tsx` | Lista paginada de `athletes_public` ordenada por wins/last_activity. Filtro por cidade/estado. |
| `/athletes/:userId` | reusa `UserProfile.tsx` | Adicionar seção "Atividades recentes" lendo `athlete_activities_public`. |
| `/marketplace` | `Marketplace.tsx` (edit) | Migrar leitura para `marketplace_public`. Filtro por `kind`. |
| `/feed` | `Feed.tsx` (edit) | Aba "Global" extra que lê `social_feed_public` (mantém aba "Seguindo" atual). |
| `/admin/ads` (estende) | `AdminAds.tsx` (existe?) ou novo | CRUD de `ad_campaigns` + aprovação. |
| Tab nova em `MyCompany.tsx` | "Anúncios" | Empresa cria campanhas próprias (status `pending` até admin aprovar). |

Componente novo: `AdSlot.tsx` — recebe `slotCode`, busca `ads_public WHERE slot_code=X`, renderiza com tracking de impression/click via `ad_record_event`.

Inserir `<AdSlot code="home.hero" />` em `Index.tsx`, `<AdSlot code="feed.inline" />` no Feed, `<AdSlot code="marketplace.featured" />` no Marketplace.

---

## Migração — arquivo único idempotente

`supabase/migrations/<ts>_phase6_social_marketplace_ads.sql`:

1. CREATE TABLE `athlete_activities` + indexes + RLS (SELECT via view only).
2. CREATE 4 triggers de population (enrollments, modality_matches, arena_attendance, posts/clips).
3. Backfill DO block (one-shot).
4. CREATE VIEW `athletes_public`, `athlete_activities_public` + grants.
5. ALTER `products` ADD `kind`, `service_arena_id`, `service_duration_minutes` IF NOT EXISTS.
6. CREATE VIEW `marketplace_public` + grants.
7. CREATE TABLE `ad_campaigns`, `ad_slots`, `ad_placements`, `ad_events` + RLS + indexes.
8. SEED `ad_slots` (5 codes).
9. CREATE VIEW `ads_public` + grants.
10. CREATE FUNCTION `ad_record_event` (SECURITY DEFINER).
11. CREATE VIEW `social_feed_public` + grants.
12. CREATE FUNCTION `search_global` (SECURITY DEFINER, STABLE).
13. ALTER `financial_transactions` — relax CHECK de `source_type` para incluir `'ad_campaign'` (futuro).

---

## Segurança — checklist

- ✅ Toda leitura pública passa por **view** com `security_invoker=on`.
- ✅ `athlete_activities` base: SELECT bloqueado para `anon`/`authenticated`; público só via view.
- ✅ `ad_campaigns`/`ad_events`: nunca expostos diretamente — apenas `ads_public` mostra campos seguros.
- ✅ `social_feed_public`: filtra `tournaments WHERE is_published=true`, posts já têm RLS própria via tabela base (view com invoker herda).
- ✅ Tenant isolation: views carregam `tenant_id` mas não expõem `owner_user_id`/`payment_*`.
- ✅ Backfill não duplica (UNIQUE parcial em `(athlete_id, activity_type, reference_id)` quando `reference_id IS NOT NULL`).

---

## Hooks ORKYM (sem IA local)

- Eventos `social.activity_created`, `ads.impression_recorded` adicionados a `arena_operational_events` quando `arena_id` está presente. ORKYM consome via fronteira `orkym-invoke` no futuro.
- Sem ranking inteligente, sem recomendação, sem feed personalizado nesta fase.

---

## Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase6_social_marketplace_ads.sql` |
| Frontend novo | `Explore.tsx`, `AthletesList.tsx`, `AdSlot.tsx`, `AdminAdsPro.tsx` (se não existir editor de campanhas), `MyCompanyAds.tsx` (tab) |
| Frontend edit | `Feed.tsx` (+aba Global), `Marketplace.tsx` (view + kind filter), `UserProfile.tsx` (+atividades), `Index.tsx` (+AdSlot hero), `App.tsx` (+rotas), `AdminLayout.tsx` (+nav Ads) |
| Memory | `mem/features/social-graph.md` (novo), `mem/features/marketplace.md` (update kind), `mem/features/advertising-and-sponsorship.md` (update generalização) |

**Total:** 1 migration + 4-5 telas + 6 edits triviais. Brackets, finance triggers, webhooks MP intocados.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Tabelas criadas | 5 (`athlete_activities`, `ad_campaigns`, `ad_slots`, `ad_placements`, `ad_events`) |
| Views públicas criadas | 4 (`athletes_public`, `athlete_activities_public`, `marketplace_public`, `ads_public`, `social_feed_public`) |
| Tabelas estendidas | 1 (`products`: kind/service) |
| Reaproveitado | `profiles`/`profiles_public`, `posts`/`clips`, `match_results`, `enrollments`, `arena_attendance`, `modality_matches`, `products`, `marketplace_orders`, `companies_public`, `arenas_public`, `tournament_sponsorships` |
| Integração financeira | Marketplace já integrado via trigger Fase 5; ads modelados para integração futura |
| Frente de descoberta | `/explore`, `/athletes`, AdSlot embeds, busca unificada via RPC |
| Segurança | Tudo público via view com `security_invoker`; tabelas base intocadas |

---

## ENTREGA C — Riscos / Pendências

**Pendente Fase 7+:**
- Pagamento real de campanhas (precisa CHECK `'ad_campaign'` + UI de checkout — modelagem pronta).
- Full-text search (hoje ILIKE simples).
- Rate-limit de `ad_record_event` (hoje aberto a authenticated).
- Particionamento de `ad_events` quando volume crescer.
- Recomendação personalizada via ORKYM (hooks prontos).
- Moderação de campanhas (hoje admin aprova manual).
- View materializada para `athletes_public` se ranking ficar lento (hoje LATERAL real-time).

**Compatibilidade mantida:**
- `tournament_sponsorships`/`sponsored_posts` permanecem (legado funcional). Não migrados para `ad_campaigns` — convivem.
- Feed atual (`Feed.tsx` lendo `posts` direto) mantido. Aba "Global" é adição.
- `Ranking.tsx` continua lendo `match_results` direto. Pode migrar para `athletes_public` em fase futura.

**Critérios de sucesso:**
- ✅ Atletas têm perfil público com stats reais (wins/participations/attendances)
- ✅ Histórico de participação visível por atleta
- ✅ Ranking simples computável via view
- ✅ Marketplace lendo de view pública + suporta serviço
- ✅ Empresa cria campanha; admin aprova; campanha aparece em slots
- ✅ Feed global mostra mix de posts/atividades/torneios/ads
- ✅ Busca unificada cobre 4 entidades
- ✅ Zero IA local, zero quebra, tudo via view com `security_invoker`

