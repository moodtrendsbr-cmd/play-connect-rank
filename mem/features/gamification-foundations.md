---
name: gamification-foundations
description: Phase G-0 + G-1 — RPCs ranking/performance, dedup helper, XP ledger, badges, streaks unificadas
type: feature
---

## G-0 (cleanup) — entregue

**RPCs corrigidas (SECURITY DEFINER, search_path=public):**
- `get_athlete_ranking(_athlete_id, _modality?)` — calcula via `modality_matches` + `modality_entry_members`. Wins×10. Position por (modality, category) ORDER BY wins DESC, played DESC.
- `get_athlete_performance(_athlete_id, _period_days=30)` — total_matches/wins/losses/win_rate via `modality_entry_members → modality_matches`. Filtro `COALESCE(scheduled_at, created_at)`.

**Dedup feed social:**
- Índice `idx_social_events_dedup (profile_id, event_type, entity_id, created_at DESC)`.
- RPC `social_event_should_emit(_profile, _type, _entity, _window=6h)` — true se NÃO há duplicata.

## G-1 (XP, Badges, Streaks) — entregue

**Tabelas:**
- `athlete_xp(athlete_id PK, current_xp, lifetime_xp, level, updated_at)` — level = floor(sqrt(lifetime/100))+1.
- `xp_events(id, athlete_id, source, source_id, delta, reason, created_at)` UNIQUE(athlete_id, source, source_id) — idempotência.
- `badges_catalog(code PK, name, description, icon, category, criteria jsonb, xp_reward, active)` — global, RLS public read where active.
- `athlete_badges(id, athlete_id, badge_code FK, earned_at)` UNIQUE(athlete_id, badge_code) — RLS public read.
- `athlete_streaks(athlete_id PK, current_streak, longest_streak, last_activity_date, updated_at)` — unificada (qualquer atividade conta).

**Fórmulas XP fixas globais:**
- match_win=50, match_played=10, attendance=10, enrollment=20, post=5.

**Funções SECURITY DEFINER (EXECUTE: authenticated + service_role):**
- `award_xp(_athlete, _source, _source_id, _delta, _reason)` — INSERT idempotente em xp_events + upsert em athlete_xp + recalcula level.
- `update_streak(_athlete, _date)` — janela diária; gap >1 reseta para 1.
- `evaluate_badges(_athlete)` — agrega wins/matches/attendances/posts/enrollments/streak; concede badges elegíveis (criteria keys: min_wins, min_matches, min_attendances, min_posts, min_enrollments, min_streak); concede xp_reward via award_xp (source='badge').

**Triggers AFTER INSERT/UPDATE (chamam award_xp + update_streak + evaluate_badges):**
- `trg_xp_from_match` em modality_matches (status→completed) — XP por participante (winner=50, others=10).
- `trg_xp_from_attendance` em arena_attendance (status→present).
- `trg_xp_from_enrollment` em enrollments.
- `trg_xp_from_post` em posts.

**Catálogo seed (8 badges):**
first_win, veteran_10_matches, champion_10_wins, dedicated_athlete, marathoner, social_butterfly, tournament_rookie, streak_7_days.

## Pendências (G-2+)
- UI: barra de XP/level no perfil, grade de badges, contador de streak.
- Aplicar `social_event_should_emit` nos triggers `trg_social_from_*` existentes.
- Substituir `Ranking.tsx` client-side por chamada paginada à RPC.
- Matview `athlete_stats` canônica (volume alto).
- Featured listings (auto-aprovação + kill-switch admin).
