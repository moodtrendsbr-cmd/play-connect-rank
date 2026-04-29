---
name: gamification-foundations
description: Phase G-0/G-1/G-2 — RPCs, XP/badges/streaks backend + UI panel no perfil
type: feature
---

## G-0 (cleanup) — entregue
- `get_athlete_ranking` / `get_athlete_performance` corrigidas (modality_matches/modality_entry_members).
- `social_event_should_emit(_profile, _type, _entity, _window=6h)` + índice `idx_social_events_dedup`.

## G-1 (XP/Badges/Streaks backend) — entregue
**Tabelas:** `athlete_xp`, `xp_events` (UNIQUE source+source_id), `badges_catalog`, `athlete_badges`, `athlete_streaks`.
**Fórmulas fixas:** match_win=50, match_played=10, attendance=10, enrollment=20, post=5. Level = floor(sqrt(lifetime/100))+1.
**Funções DEFINER (auth+service_role):** `award_xp`, `update_streak`, `evaluate_badges`.
**Triggers:** modality_matches→completed, arena_attendance→present, enrollments INSERT, posts INSERT.
**Catálogo seed:** first_win, veteran_10_matches, champion_10_wins, dedicated_athlete, marathoner, social_butterfly, tournament_rookie, streak_7_days.

## G-2 (UI gamificação) — entregue
**Componentes em `src/components/gamification/`:**
- `XpLevelBar` — nível + barra de progresso (XP atual / XP do próximo nível). Lê `athlete_xp`. Inversa da fórmula: xpForLevel(N) = (N-1)²×100.
- `StreakCounter` — current/longest com Flame icon. Lê `athlete_streaks`. Cor laranja #FF8A2B quando ativa.
- `BadgesGrid` — grade 4 cols. Locked = ícone Lock cinza/opaco. Earned = ícone (Trophy/Swords/Crown/etc) verde #2BFF88. Tooltip com descrição + xp_reward.
- `GamificationPanel` — wrapper: 2-col grid (XP+Streak) + BadgesGrid abaixo. Prop `showBadges` controla visibilidade.

**Integrações:**
- `src/pages/Profile.tsx` — seção "Gamificação" antes de "Memórias de torneios".
- `src/pages/UserProfile.tsx` — mesma seção, mostra perfil público de outros atletas.

Ícones do catálogo mapeados via `ICON_MAP` em BadgesGrid; fallback Award.

## Pendências (G-3+)
- Featured listings (auto-aprovação + kill-switch admin) — monetização social.
- Aplicar `social_event_should_emit` nos triggers `trg_social_from_*` existentes.
- Substituir `Ranking.tsx` por chamada paginada à RPC.
- Matview `athlete_stats` canônica (volume alto).
- Toast "Badge desbloqueada!" ao detectar nova badge (realtime ou polling).
