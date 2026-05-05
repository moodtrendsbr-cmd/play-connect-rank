---
name: tournament-enrollment-fix
description: Inscrição em torneio exige modality_id; RPC, smoke-test e CreateTournament corrigidos; backfill admin com 3 buckets
type: feature
---

Fluxo único validado end-to-end (smoke-test 8/8):
payment → enrollment(paid, modality_id) → trigger trg_enrollments_create_entry → modality_entries → modality_entry_members → enrollment.entry_id.

Regras:
- `enrollments.modality_id` é OBRIGATÓRIO em qualquer fluxo de inscrição quando o torneio tem ≥1 `tournament_modalities`.
- `Payment.tsx` valida e bloqueia checkout sem categoria.
- `CreateTournament.tsx`: bloqueia submit com `slotConfig` vazio; rollback do tournament se INSERT em `tournament_modalities` falhar.
- RPC `enroll_athlete_in_tournament`: persiste `_modality_id`. Auto-seleciona se 1 categoria. UNIQUE em `(tournament_id,user_id,modality_id)`.
- `moodplay-execute-action` `enroll_in_tournament`: resolve modality_id antes da RPC.
- Trigger extra `trg_enrollments_create_entry_modality` AFTER UPDATE OF modality_id — permite backfill criar entry.

**Backfill (corrigido)** — RPC admin-only `backfill_orphan_enrollments()` retorna 3 buckets + items:
- `auto_linked` (1 modality) → vincula
- `needs_category_review` (≥2 modalities) → marca review
- `unrecoverable_no_category` (0 modalities) → marca `orphan_reason='unrecoverable_no_category'`
NÃO filtra por needs_category_review (não esconde marcados anteriormente).
RPC admin-only `archive_test_orphans()` arquiva (`archived_at=now()`) órfãos irrecuperáveis com nome `[SMOKE]%|%seed%|%test%`.

**Colunas novas em `enrollments`**: `orphan_reason text`, `archived_at timestamptz`, `needs_category_review boolean`.

**Localização das ferramentas internas (admin only)**: `/admin/internal-tools` — smoke-test, seed piloto, backfill+relatório, arquivamento. Control Tower (`/admin/control-tower`) NÃO contém mais botões técnicos — só saúde/alertas/receita.
