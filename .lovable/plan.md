# Plano — Feed & Social Activation

Transformar o Feed em timeline esportiva viva, alimentada por eventos reais (check-ins, torneios, vitórias, XP, pódio), sem depender de posts manuais. Reutilizar 100% da infraestrutura existente (`social_events`, `athlete_activities`, `xp_events`, `athlete_xp`, `athlete_streaks`, `social_feed_public_v2`, `feed_unified_v`). Sem nova rede social, sem stories, sem reels.

## Escopo (o que mudar)

### 1. Fontes de eventos (preencher lacunas — só triggers)
Migração única adicionando emissão de `social_events` + `athlete_activities` para tipos que hoje não chegam ao feed:

- `arena_attendance` → `class_attendance` (social_events já existe via athlete_activities; garantir trigger `social_from_activity` cobre)
- `bookings` paid → `booking`
- `modality_matches` final concluída (winner do final) → `tournament_won` (hoje só placement gera)
- `modality_matches` por rodada (SF, Final) → novo evento `tournament_advance` (payload: `phase`, `tournament_name`)
- `modality_placements` insert → `tournament_podium` (posições 2/3)
- `xp_events` quando `lifetime_xp` cruza limiar de nível → `level_up`
- `athlete_streaks` quando `current_streak` % 7 == 0 → `streak_milestone`
- `athlete_badges` insert → `badge_earned`

Estender `social_event_description` com os novos `event_type` (frases curtas, esportivas, PT-BR).

Nada de tabelas novas. Tudo reaproveita `social_events` + `social_feed_public_v2`.

### 2. Cards visuais premium (frontend)
Criar `src/components/social/cards/`:

- `CheckinCard.tsx`
- `MatchWinCard.tsx`
- `ChampionCard.tsx` (destaque verde #2BFF88, troféu grande)
- `PodiumCard.tsx`
- `LevelUpCard.tsx`
- `StreakCard.tsx`
- `BadgeCard.tsx`
- `TournamentLifecycleCard.tsx` (created/advance/final)
- `BookingCard.tsx`

`SocialEventCard.tsx` vira **dispatcher** que escolhe o card por `event_type`. Mantém o atual como fallback. Cada card: avatar, nome, modalidade, arena, horário relativo, CTA contextual (Ver torneio / Ver arena / Ver perfil).

### 3. Feed global (`/feed`)
Em `src/pages/Feed.tsx` adicionar aba/toggle no topo:
- **Atividade** (novo, default para usuários sem follows) — usa `social_feed_public_v2`
- **Seguindo** (atual, posts) — mantém comportamento

Sem stories, sem reels. Manter injeção de boosts via `feed_unified_v` (cap já existente).

### 4. Feed da Arena
Nova rota pública `/arenas/:slug` (ou aba dentro de `ArenaPublic.tsx`) com:
- Live: "X pessoas com check-in nas últimas 2h" (count de `arena_attendance`)
- Timeline de `social_feed_public_v2` filtrada por `arena_id`
- Próximos torneios da arena

### 5. Feed do Torneio
Em `ManageTournament` / `TournamentDetail` adicionar aba **Atividade** consumindo `social_feed_public_v2` filtrada via `payload->>'tournament_id'` (adicionar `tournament_id` ao payload nos triggers acima).

### 6. Perfil esportivo vivo
Refinar `SocialProfile.tsx` / `UserProfile.tsx`:
- Topo: avatar + nome + ranking global (de `ranking_global`) + nível (de `athlete_xp`) + streak
- Strip de esportes praticados (derivar de `enrollments.modality.sport`)
- Arenas frequentes (top 3 por `arena_attendance` count)
- `GamificationPanel` já existente (XP/Streak/Badges/Rank)
- Timeline pessoal: `SocialActivityFeed` com `profileId`

### 7. Explore — descoberta esportiva
Refinar `Explore.tsx`:
- Seção "Acontecendo agora" — torneios com matches `in_progress` ou check-ins recentes
- "Arenas movimentadas" — top arenas por check-ins últimas 24h
- "Próximos torneios" — `tournaments` com `start_date >= now()` ordenado
- "Atletas em destaque" — top `ranking_global` semanal
- Manter busca atual (`search_global`)

### 8. Social proof badges
Componente `<LiveBadge />` reutilizável:
- "🟢 X jogando agora" (count matches in_progress)
- "🔥 Arena movimentada" (>10 check-ins/24h)
- "⚡ Torneio começando" (start_date < 2h)

Aplicar em cards de arena, torneio e no Explore.

### 9. Privacidade
`SocialPrivacyToggle` já existe (público/privado global). Adicionar em `/profile/settings`:
- Toggle "Ocultar meus check-ins"
- Toggle "Ocultar minha posição no ranking"
- Toggle "Ocultar minha atividade do feed"

Implementar via novas colunas em `social_profiles` (`hide_checkins`, `hide_ranking`, `hide_activity`) + filtros nos triggers de emissão (`social_events.visibility = 'private'` quando flag ligada).

### 10. Mobile-first
- Cards full-width, padding 12px, radius 16px
- Lazy load via Intersection Observer (já existe padrão no Feed)
- Skeleton no `SocialActivityFeed` (já existe)
- Realtime: subscription em `social_events` no `/feed` aba Atividade (insert → prepend)

## Detalhes técnicos

**Migração (única):**
```sql
-- Estender social_event_description com novos tipos
-- Trigger trg_social_event_from_xp (level_up)
-- Trigger trg_social_event_from_streak (streak milestone)
-- Trigger trg_social_event_from_badge
-- Trigger trg_social_event_from_placement (podium 2/3)
-- Trigger trg_social_event_from_match_phase (SF/F advance + champion)
-- Trigger trg_social_event_from_booking
-- ALTER TABLE social_profiles ADD hide_checkins/hide_ranking/hide_activity bool default false
-- Atualizar trg_social_from_activity para respeitar flags
```

**Arquivos frontend novos:**
- `src/components/social/cards/*` (9 cards + index)
- `src/components/social/LiveBadge.tsx`
- `src/hooks/useArenaFeed.ts`
- `src/hooks/useTournamentFeed.ts`
- `src/hooks/useLiveCounts.ts` (X jogando agora etc.)

**Arquivos editados:**
- `src/components/social/SocialEventCard.tsx` (dispatcher)
- `src/pages/Feed.tsx` (toggle Atividade/Seguindo + realtime)
- `src/pages/Explore.tsx` (seções acontecendo agora / movimentadas / próximos)
- `src/pages/arenas/ArenaPublic.tsx` (aba Atividade + LiveBadge)
- `src/pages/TournamentDetail.tsx` / `ManageTournament.tsx` (aba Atividade)
- `src/pages/SocialProfile.tsx` / `UserProfile.tsx` (perfil esportivo)
- `src/pages/Profile.tsx` (toggles de privacidade granulares)

## Fora de escopo (não fazer)
Stories, reels, chat novo, influencer/creator economy, posts longos, feed manual, novo engine, IA local, refator de bracket/auth, novos endpoints ORKYM.

## Critério de sucesso
1. Feed mostra eventos reais mesmo com 0 posts manuais.
2. Cada `event_type` (10+) tem card visual próprio.
3. Arena e torneio têm timeline própria.
4. Explore prioriza "acontecendo agora".
5. Perfil mostra XP/streak/ranking/arenas/esportes/conquistas.
6. Privacidade granular respeitada nos triggers.
7. Realtime no `/feed` (novos eventos aparecem sem refresh).
8. Mobile fluido, sem regressão de build.

## Relatório final entregará
- Lista de event_types ativos + contagem
- Cards criados (screenshots)
- Antes/depois de Explore e Perfil
- Verificação de XP/streak/badge emitindo eventos
- Smoke: criar check-in → ver no feed em <2s