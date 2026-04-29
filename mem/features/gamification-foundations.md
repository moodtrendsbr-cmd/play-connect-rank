---
name: gamification-foundations
description: Phase G-0 cleanup — RPCs de ranking/performance corrigidas para modality_matches, dedup helper para social_events
type: feature
---

**Phase G-0 (cleanup) entregue.** Base para futuras fases de XP/badges/streaks.

**RPCs corrigidas (SECURITY DEFINER, search_path=public):**
- `get_athlete_ranking(_athlete_id, _modality?)` — calcula ranking real via `modality_matches` + `modality_entry_members` + `tournament_modalities`. Pontos = wins × 10. Position = ROW_NUMBER por (modality_name, category) ORDER BY wins DESC, played DESC. Não lê mais a tabela inexistente `athlete_rankings`.
- `get_athlete_performance(_athlete_id, _period_days=30)` — calcula total_matches/wins/losses/win_rate via `modality_entry_members` → `modality_matches`. Não lê mais a tabela errada `matches`. Filtro temporal usa `COALESCE(scheduled_at, created_at)`.

Ambas retornam `{success: true, ...}` mesmo em erro (fallback gracioso para ORKYM).

**Dedup de feed social:**
- Índice `idx_social_events_dedup` em `(profile_id, event_type, entity_id, created_at DESC)`.
- RPC `social_event_should_emit(_profile_id, _event_type, _entity_id, _window=6h)` retorna `true` se NÃO há duplicata no janelamento. Triggers de projeção em `social_events` devem chamá-la antes de INSERT para evitar spam (ex: múltiplos check-ins seguidos).

**Pendências G-1:**
- matview `athlete_stats` canônica (substitui agregação atual em `athletes_public` para casos de alto volume).
- Aplicar `social_event_should_emit` nos triggers `trg_social_from_*` existentes (próxima fase).
- Substituir `Ranking.tsx` client-side por chamada à RPC paginada.
