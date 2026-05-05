---
name: tournament-enrollment-fix
description: Inscrição em torneio exige modality_id; RPC, smoke-test e CreateTournament corrigidos; backfill admin
type: feature
---

Fluxo único validado end-to-end (smoke-test verde, 8/8 checks):
payment → enrollment(paid, modality_id) → trigger trg_enrollments_create_entry → modality_entries → modality_entry_members → enrollment.entry_id.

Regras:
- `enrollments.modality_id` é OBRIGATÓRIO em qualquer fluxo de inscrição quando o torneio tem ≥1 `tournament_modalities`.
- `Payment.tsx` já valida e bloqueia checkout sem categoria; redireciona para `/tournament/:id` quando torneio não tem modalities.
- `CreateTournament.tsx`: bloqueia submit com `slotConfig` vazio; se INSERT em `tournament_modalities` falhar, faz rollback do tournament (delete) — torneio não pode existir sem categoria.
- RPC `enroll_athlete_in_tournament(_tournament_id, _modality_id)`: persiste `_modality_id`; retorna `tournament_has_no_categories` / `modality_required` / `invalid_modality_for_tournament` / `already_enrolled`. Auto-seleciona se torneio só tem 1 categoria. UNIQUE check passou para `(tournament_id,user_id,modality_id)` — permite mesma pessoa em categorias diferentes.
- `moodplay-execute-action` `enroll_in_tournament`: resolve modality_id antes da RPC (0→erro, 1→auto, ≥2→`status='needs_input'` com `available_modalities` para ORKYM perguntar).
- Trigger extra `trg_enrollments_create_entry_modality` AFTER UPDATE OF modality_id — permite o backfill criar entry sem mexer em status.
- RPC admin-only `backfill_orphan_enrollments()`: para enrollments paid com modality_id NULL, vincula automaticamente quando torneio tem 1 modality, marca `needs_category_review=true` quando ≥2, ignora torneios sem modality. Botão no AdminControlTower.
- Smoke-test reescrito: cria tournament + modality + enrollment com modality_id, força paid, retorna `ok` apenas se entry/member/ftx/attribution existirem. Sem falso positivo.

Coluna nova: `enrollments.needs_category_review boolean default false`.
