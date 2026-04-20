---
name: Arena Management
description: Módulo operacional da arena (Fases 3+4) — alunos, professores, aulas, matrículas, presença, QR check-in, planos, assinaturas, cobranças, ocorrências e hooks ORKYM.
type: feature
---

Módulo `/arena/dashboard` cobre toda a operação contínua da arena.

**Fase 3 — operação base:**
- `arena_students`, `arena_instructors`, `arena_instructor_availability`
- `arena_classes` (única ou semanal, referencia `courts` sem criar booking)
- `arena_class_enrollments` (UNIQUE class_id+student_id)
- `arena_attendance` (UNIQUE class_id+student_id)
- `arena_checkin_tokens` + RPC `arena_checkin_validate(_token)` → `/arena/checkin?t=`

**Fase 4 — recorrência + ORKYM hooks + ocorrências:**
- `arena_membership_plans` (monthly/quarterly/yearly/one_time)
- `arena_student_subscriptions` (active/paused/canceled/past_due, `next_due_at`)
- `arena_billing_cycles` (pending/paid/overdue/canceled)
- `arena_occurrences` (court/class/instructor/booking/student/event/other × low/medium/high/critical)
- `arena_operational_events` (trilha bruta append-only — ORKYM lê)
- `arena_operational_tasks` (inbox open/dismissed/done com `source` manual/orkym/system — ORKYM grava)

**RPCs operacionais (sem inteligência):**
- `arena_generate_billing_cycle(_subscription_id)` — gera próximo ciclo conforme frequência
- `arena_mark_cycle_paid(_cycle_id, _method, _ref)` — pagamento manual
- `arena_mark_overdue_cycles(_arena_id)` — marca pending vencidos como overdue + subs como past_due

**Triggers de eventos automáticos:**
- `arena_billing_cycles UPDATE → arena_operational_events` (`billing.overdue` / `billing.paid`)
- `arena_attendance INSERT absent → arena_operational_events` (`attendance.absent`)

**Integração ORKYM (canal pronto, cérebro fora):**
- ORKYM consulta: `arena_operational_events`, `arena_attendance`, `arena_billing_cycles`, `arena_class_enrollments`
- ORKYM grava: `arena_operational_tasks` com `source='orkym'` (visível na caixa de pendências do dashboard)
- Zero inteligência local — toda decisão delega via `orkym-invoke`

**Não duplica:**
- `enrollments` (torneios) ≠ `arena_class_enrollments` (aulas)
- `bookings` (locação avulsa) permanecem paralelos a `arena_classes`
- `profiles` referenciado via `profile_user_id` (sem duplicar pessoa)
- `payment_accounts` referenciado em `arena_student_subscriptions`

**RLS:** arena owner + tenant admin + admin global em tudo. Aluno vê apenas suas próprias `arena_student_subscriptions` e `arena_billing_cycles` via JOIN com `profile_user_id`.

**Pendências Fase 5+:** cobrança automática Mercado Pago por ciclo; cron real para overdue; notificações ao aluno; view aluno (minhas assinaturas/pagamentos); workflow de ocorrências (assignees, comentários); marketplace interno arena.

**Convenções Fase 4.1 (hardening):**

- Glossário oficial (não confundir):
  - `event` (`arena_operational_events`) = trilha bruta append-only (fato que aconteceu)
  - `task` (`arena_operational_tasks`) = AÇÃO a executar (open/dismissed/done, tem `priority`)
  - `occurrence` (`arena_occurrences`) = PROBLEMA registrado (open/in_progress/resolved/closed, tem `severity`)
  - `tournament` = evento ESPORTIVO público (não tem relação com operação)
- `event_type` segue namespace forçado por CHECK: `dominio.acao` (ex: `attendance.absent`, `billing.overdue`, `billing.paid`, `class.canceled`, `student.inactive`, `task.created`).
- Tasks e Occurrences podem se vincular bidirecionalmente via `arena_operational_tasks.occurrence_id` e `arena_occurrences.task_id` (soft, nullable). UI da arena já oferece "Gerar tarefa" a partir de uma ocorrência.
- Política de retenção de eventos: **archive soft** via RPC `arena_archive_old_events(_arena_id, _older_than_days=180)` — marca `archived_at` apenas em eventos já processados. Hard DELETE proibido em rotina; reservado para limpeza manual.
- Billing split-ready: `arena_billing_cycles` carrega snapshot de `payment_account_id` + `gross_amount/fee_amount/net_amount` + `provider_preference_id`. RPC `arena_generate_billing_cycle` popula no INSERT; RPC `arena_mark_cycle_paid` aceita `_fee_amount` opcional e recalcula `net_amount`. UI mostra "Líquido" só quando `fee > 0`.
- Índices em `arena_operational_events`: `(arena_id, created_at DESC)`, `(arena_id, processed_at) WHERE processed_at IS NULL` (partial p/ ORKYM consumir backlog), `(arena_id, event_type, created_at DESC)`.
