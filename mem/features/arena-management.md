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
