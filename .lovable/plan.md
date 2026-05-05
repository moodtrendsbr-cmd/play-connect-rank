## Problema

Após a migration estrutural, marcar uma `enrollment` como `paid` falha no banco. Dois triggers têm bugs de coluna:

1. **`trg_enrollments_create_entry`** (novo, da correção): referencia `profiles.nickname` e `profiles.id = NEW.user_id`. Coluna `nickname` não existe; e `profiles.id ≠ user_id` (FK real é `profiles.user_id`).
2. **`trg_xp_from_enrollment`** (pré-existente): referencia `NEW.athlete_id`, mas `enrollments` só tem `user_id`. Esse trigger é `AFTER INSERT`, ou seja, hoje qualquer `INSERT` em `enrollments` já estoura — explica por que existem 28 enrollments seed mas nada novo entra.

Confirmado por queries reais (não suposição):
- `information_schema.columns` em `public.profiles` → não tem `nickname`.
- `information_schema.columns` em `public.enrollments` → não tem `athlete_id`.
- `SELECT count(*) FILTER (WHERE id = user_id) FROM profiles` → 0 de 7.

## Correção (uma migration nova, só recria as 2 funções)

### 1. `trg_enrollments_create_entry()`

Trocar bloco de nome para:

```sql
v_entry_name := COALESCE(
  NULLIF(NEW.athlete_name, ''),
  (SELECT NULLIF(full_name, '') FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1),
  'Atleta'
);
```

- Remove referência a `profiles.nickname`.
- Corrige join para `profiles.user_id = NEW.user_id`.
- Mantém o `EXCEPTION WHEN OTHERS` para nunca bloquear pagamento.

### 2. `trg_xp_from_enrollment()`

Trocar `NEW.athlete_id` por `NEW.user_id` nas 3 chamadas (`award_xp`, `update_streak`, `evaluate_badges`) e envolver em `EXCEPTION WHEN OTHERS RETURN NEW` para nunca derrubar inserts futuros.

```sql
BEGIN
  PERFORM public.award_xp(NEW.user_id, 'enrollment', NEW.id, 20, 'Tournament enrollment');
  PERFORM public.update_streak(NEW.user_id, CURRENT_DATE);
  PERFORM public.evaluate_badges(NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_xp_from_enrollment failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
```

## Verificação após aplicar

1. Rodar `smoke-test-payment` (já existe como edge function admin) — deve retornar `ok: true` com `enrollment_id` virando `entry_id` populado.
2. Query: `SELECT count(*) FROM enrollments WHERE entry_id IS NOT NULL` deve passar de 0 após o smoke.
3. Query: `SELECT count(*) FROM modality_entry_members` deve passar de 0.

## Fora de escopo (não mexer agora)

- Backfill das 28 enrollments antigas e das 78 entries seed sem members. Pode ficar para próximo passo após confirmar smoke verde.
- Double-elimination losers bracket — segue placeholder.
- Unificar `tournaments.slot_config` vs `tournament_modalities` — refactor maior.
