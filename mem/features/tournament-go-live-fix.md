---
name: tournament-go-live-fix
description: P0 fixes for tournament flow — triggers ativos, attribution automática, notificações ao atleta, smoke-test admin
type: feature
---

P0 #1: triggers `trg_enrollments_activity`, `trg_enrollments_memory`, `trg_enrollments_record_payment`, `trg_modality_matches_activity` agora attached.

P0 #3: `orkym_attribute_revenue()` + trigger em `financial_transactions` (status→paid). Procura janela 24h: outbound trigger ORKYM → proactive(0.85), inbound command → assisted(0.65), nada → reactive(0.30). Nunca bloqueia ftx (EXCEPTION ignora).

P0 #5: `orkym_enqueue_athlete_notification()` enfileira em `orkym_triggers_queue` com `dedup_key` único:
- enrollment_created (insert) — dedup `enroll_created:<id>`
- enrollment_paid (update→paid, priority high) — dedup `enroll_paid:<id>`
- match_result (winner set, ambos atletas) — dedup `match_result:<match>:<user>`
Categorias adicionadas em `orkym-proactive-process` (TRIGGER_TO_CATEGORY) → operations.

P0 #2: `smoke-test-payment` edge fn (admin only). Cria torneio R$1, enrollment pending→paid, espera 500ms, retorna evidências de activities/ftx/attribution/queue. Botão no AdminControlTower mostra ✓/✗ por sistema.

P0 #4: já resolvido (botão "Criar piloto" + `seed-pilot-arena`).

UNIQUE INDEX `orkym_triggers_queue_dedup_key_uq` garante ON CONFLICT funcionar.
