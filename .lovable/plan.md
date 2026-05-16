# Social Runtime Fix Sprint — Plan

## Findings da exploração (corrigem premissas da auditoria)

Inspecionei `pg_trigger` e `pg_proc` direto no banco. Situação real:

**Triggers JÁ conectados (auditoria estava errada nesse ponto):**
- `trg_social_from_level_up` AFTER UPDATE OF level ON `athlete_xp` ✓
- `trg_social_from_streak` AFTER UPDATE OF current_streak ON `athlete_streaks` ✓
- `trg_social_from_badge` AFTER INSERT ON `athlete_badges` ✓
- `trg_social_from_placement` AFTER INSERT ON `modality_placements` ✓

**Por que então `social_events` não tem `level_up`/`streak_milestone`/`badge_earned`/`tournament_podium`/`tournament_won`?**
Porque os dados existentes foram inseridos *antes* dos triggers/mapeamentos atuais. Inventário:

| tabela | linhas | eventos correspondentes |
|---|---|---|
| athlete_xp | 4 | 0 level_up |
| athlete_streaks | 4 | 0 streak_milestone |
| athlete_badges | 12 | 0 badge_earned |
| modality_placements | 22 | 0 tournament_podium |
| athlete_activities `tournament.won` | 4 | 0 tournament_won |
| athlete_activities `tournament.match_won` | 21 | 21 match_win, 0 tournament_advance |
| arena_checkins / arena_attendance / bookings.paid | 0 / 0 / 0 | — (sem matéria-prima) |

**Privacidade — gaps reais:**
- `trg_social_from_activity` respeita `hide_activity` + `hide_checkins` ✓
- `trg_social_from_level_up`, `_streak`, `_badge`, `_placement` respeitam `hide_activity` ✓
- `trg_social_from_booking` **NÃO checa nada** (sempre `'public'`) 🔴
- `trg_social_from_payment` precisa ser auditado igual

**Realtime:** `SocialActivityFeed.tsx` faz `load()` global a cada INSERT em `social_events` — refetch completo, candidato a merge incremental.

Diagnóstico: nenhum trigger novo precisa ser criado. O sprint é **backfill + gate de privacidade nos 2 triggers descobertos + merge incremental + seed mínimo + evidência**.

---

## Escopo

### 1. Backfill histórico (migração idempotente)
Usa `_social_insert_event` que já tem `ON CONFLICT DO NOTHING`. Para cada caso, insere apenas se `social_event_should_emit` ou `NOT EXISTS` equivalente:

- **tournament_won** — para cada `athlete_activities` com `activity_type='tournament.won'`, resolver identity/profile, montar payload com `tournament_id`/`tournament_name`, respeitar `hide_activity`.
- **tournament_advance** — derivar dos `modality_matches` finalizados não-finais por participante (mesma lógica do trigger atual `trg_activity_from_match`, mas só insere se faltar).
- **tournament_podium** — varrer `modality_placements` com `position IN (2,3)`, replicar lógica de `trg_social_from_placement`.
- **badge_earned** — varrer `athlete_badges`, lookup em `badges_catalog`.
- **level_up** — varrer `athlete_xp` com `level > 1`, emite 1 evento por atleta (best effort, sem histórico de níveis).
- **streak_milestone** — varrer `athlete_streaks` com `current_streak >= 7 AND current_streak % 7 = 0`.

Tudo dentro de blocos `BEGIN/EXCEPTION WHEN OTHERS THEN ... END` para não quebrar a migração.

### 2. Gate de privacidade em `trg_social_from_booking` e `trg_social_from_payment`
- `trg_social_from_booking`: ler `hide_checkins` E `hide_activity`; se qualquer um `true`, visibility = `'private'` (booking é evento físico, hide_checkins faz sentido).
- `trg_social_from_payment`: ler `hide_activity`; se `true`, visibility = `'private'`.
- Nenhuma alteração de schema, só `CREATE OR REPLACE FUNCTION`.

### 3. Realtime incremental (`SocialActivityFeed.tsx`)
Substituir refetch global por:
- INSERT recebido → buscar **somente** o registro novo via `.eq('event_id', payload.new.id)` na view `social_feed_public_v2` e fazer `setItems(prev => [novo, ...prev].slice(0, limit))` com dedup por `event_id`.
- Manter cleanup de canal e early-return se filtros não casarem (`tenantId/arenaId/tournamentId/profileId`).
- Sem novos componentes, só edição do hook interno do componente existente.

### 4. Seed mínimo controlado (via insert tool, dados reais de teste)
- 1 `bookings` com `status='paid'` para um atleta de teste já existente.
- 1 `arena_checkins` em arena de teste.
- 1 `arena_attendance` com `status='present'`.
Objetivo: validar `booking`, `checkin`, `class_attendance` no feed em runtime.

### 5. Evidência obrigatória (após backfill + seed)
Rodar e reportar:
```sql
SELECT event_type, count(*) FROM social_events GROUP BY 1 ORDER BY 2 DESC;
SELECT * FROM social_feed_public_v2 ORDER BY occurred_at DESC LIMIT 30;
```
E classificar (🟢/🟡/🔴): champion, podium, XP, streak, badge, check-in, booking, aula, realtime, privacy.

---

## Fora de escopo (não fazer)
- Não criar componentes novos.
- Não criar tabelas novas.
- Não criar triggers novos — todos os necessários já existem.
- Não alterar `social_feed_public_v2` schema.
- Não mexer no Explore (será apenas re-validado via queries; UI já está pronta).

## Entregáveis
1. Migração 1: backfill (6 blocos idempotentes).
2. Migração 2: `CREATE OR REPLACE` dos 2 triggers com gate de privacidade.
3. Edição do `SocialActivityFeed.tsx` (merge incremental).
4. Inserts de seed (booking, checkin, attendance).
5. Relatório final com queries de evidência e classificação 🟢/🟡/🔴 + veredito sobre piloto.

Aprovar para implementar?
