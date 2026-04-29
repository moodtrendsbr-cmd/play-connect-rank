
# Gamification Engine Mínima — Plano

## Diagnóstico

O sistema **já tem** uma base de gamificação implementada (G-1/G-2) que cobre ~80% do pedido com nomes diferentes:

| Pedido            | Já existe                                                                |
|-------------------|--------------------------------------------------------------------------|
| `player_points`   | `athlete_xp` (current_xp / lifetime_xp / level)                          |
| `player_points_log` | `xp_events` (UNIQUE source+source_id, idempotente)                     |
| `calculate_points`  | `award_xp` + triggers fixos (win=50, played=10, attendance=10, enrollment=20) |
| `player_streaks`    | `athlete_streaks` (current_streak / longest_streak / last_activity_date) |
| ranking views     | RPC `get_athlete_ranking` (já corrigida no G-0)                          |

**Decisão:** não duplicar. Reusar as tabelas existentes e fechar apenas as lacunas reais. Os nomes ficam `athlete_xp/xp_events/athlete_streaks` no banco; a UI/feed/ORKYM podem chamar de "pontos" sem problema.

## Lacunas reais a implementar

1. **Bookings não dão pontos hoje** — adicionar trigger.
2. **Falta janela semanal/mensal** — adicionar 2 colunas calculadas em runtime via view, sem nova tabela.
3. **Ranking por arena / por modalidade** — só existe global; criar 2 views.
4. **Eventos `ranking_update` / `streak_update` no feed** — ainda não emitidos.
5. **ORKYM não consulta pontos/ranking/streak** — adicionar handler.
6. **Profile já mostra XP/streak/badges** (G-2) — só validar.

## Escopo

### 1. Bookings → pontos (trigger novo)
Trigger em `bookings` AFTER UPDATE quando `status` muda para `paid`/`confirmed`:
- `award_xp(booker_user_id, 6, 'booking', booking.id)`
- `update_streak(booker_user_id)`

Idempotência garantida pelo UNIQUE (source, source_id) em `xp_events`.

### 2. Janelas semanal/mensal (view, sem tabela nova)
```text
View athlete_points_summary (security_invoker):
  athlete_id
  total_points        ← athlete_xp.lifetime_xp
  weekly_points       ← SUM(xp_events.delta) WHERE created_at >= now() - 7d
  monthly_points      ← SUM(xp_events.delta) WHERE created_at >= now() - 30d
  current_streak      ← athlete_streaks.current_streak
  level               ← athlete_xp.level
```
Cobre o requisito de `weekly_points` / `monthly_points` sem schema novo.

### 3. Ranking views
```text
ranking_global       ← top atletas por lifetime_xp + nome/avatar via profiles_public
ranking_by_arena     ← JOIN xp_events com arena_attendance/bookings filtrando por arena_id
ranking_by_modality  ← JOIN xp_events com modality_matches filtrando por modality
```
Todas `security_invoker=on`, leitura pública. Topo limitado a 100 linhas para evitar payloads grandes.

### 4. Feed: `ranking_update` / `streak_update`
Adicionar `social_event_type` enum + emissão idempotente (já temos `social_event_should_emit` da G-0):
- Ao subir de posição no ranking_global (top 10) → emitir `ranking_update`.
- Ao atingir múltiplos de 5 dias de streak → emitir `streak_update`.
- Trigger único em `athlete_xp` AFTER UPDATE + `athlete_streaks` AFTER UPDATE, com guarda de janela 6h.

### 5. ORKYM lê pontos/ranking/streak
Adicionar 1 handler em `supabase/functions/_shared/orkym-handlers.ts`:
- Action `get_athlete_progress(profile_id)` → retorna `{ total, weekly, monthly, level, streak, rank_global, rank_arena? }` lendo a view `athlete_points_summary` + `ranking_global`.
- Sem IA, sem decisão; apenas leitura. ORKYM decide o copy.

### 6. UI
`GamificationPanel` já existe e está em `Profile.tsx` / `UserProfile.tsx` (G-2). Apenas:
- Ler também `weekly_points` da nova view e mostrar uma linha pequena: "Esta semana: +X pontos".
- Mostrar posição global ("#42 no ranking") quando disponível.

Sem página nova. Reutiliza componentes existentes.

### 7. Testes (vitest)
- `xpEvents.idempotency.test.ts` — 2 inserts mesmo source+source_id → 1 linha.
- `bookingPoints.test.ts` — booking pago dispara +6 e atualiza streak.
- `rankingViews.test.ts` — atleta com mais XP aparece em ranking_global na pos 1.
- `streakReset.test.ts` — gap > 1 dia reseta para 1.

## Detalhes técnicos

**Migrations (1 só):**
- Trigger `trg_award_xp_on_booking_paid` em `bookings`.
- Views `athlete_points_summary`, `ranking_global`, `ranking_by_arena`, `ranking_by_modality` (security_invoker=on).
- Trigger `trg_emit_ranking_update` em `athlete_xp` AFTER UPDATE.
- Trigger `trg_emit_streak_update` em `athlete_streaks` AFTER UPDATE.

**Edge function:**
- `_shared/orkym-handlers.ts` — adicionar action `get_athlete_progress`.

**Frontend:**
- `XpLevelBar` — adicionar pequeno "+X esta semana" lendo a view.
- `GamificationPanel` — adicionar linha "Posição: #N" via ranking_global (top 100 only; senão mostra nada).
- 4 arquivos `.test.tsx` em `src/test/`.

**O que NÃO fazer (reforço do pedido):**
- Não criar `player_points` / `player_points_log` / `player_streaks` (duplicação).
- Não criar tabela de ranking.
- Não mexer em badges existentes.
- Não criar moedas/loja/níveis adicionais.
- Não criar página nova.

## Memória a atualizar
- `mem/features/gamification-foundations.md` — adicionar seção G-4 (este plano).
- Core do index: adicionar regra "Pontos = athlete_xp.lifetime_xp; nunca criar player_points".

## Critérios de sucesso
- Booking pago gera +6 automaticamente.
- `ranking_global` retorna top atletas ordenados.
- Feed recebe `ranking_update`/`streak_update` com dedupe.
- ORKYM lê progresso via `get_athlete_progress`.
- Profile mostra "esta semana" e posição.
- Idempotência preservada (sem pontos duplicados).
