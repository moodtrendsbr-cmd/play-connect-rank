---
name: Arena Management
description: Módulo operacional da arena (Fase 3) — alunos, professores, aulas, matrículas, presença e check-in via QR. Reutiliza arenas/courts/profiles, sem duplicar.
type: feature
---

Módulo `/arena/dashboard` estende o layout da arena com 4 novas abas: Alunos, Professores, Aulas, Matrículas.

**Tabelas (todas com tenant_id + arena_id, RLS por arena owner / tenant admin / admin):**
- `arena_students` — cadastro de alunos (profile_user_id opcional, aluno pode existir sem conta)
- `arena_instructors` — cadastro de professores
- `arena_instructor_availability` — disponibilidade semanal
- `arena_classes` — aulas (única ou recorrente semanal). Referencia `courts` mas NÃO cria booking.
- `arena_class_enrollments` — matrículas (UNIQUE class_id+student_id)
- `arena_attendance` — presença (UNIQUE class_id+student_id)
- `arena_checkin_tokens` — tokens efêmeros para QR (30min)

**Check-in QR:**
- Arena gera token via dialog (página Matrículas), QR aponta para `/arena/checkin?t=TOKEN`
- Aluno autenticado abre URL → RPC `arena_checkin_validate(_token)` valida e insere presença
- Erros: auth_required, invalid_token, expired_token, not_a_student, not_enrolled

**Não duplica:**
- `enrollments` (torneios) ≠ `arena_class_enrollments` (aulas)
- Bookings de locação avulsa permanecem paralelos a `arena_classes`
- profiles é referenciado via `profile_user_id` (sem duplicar pessoa)

**Pendências para Fase 4 (ORKYM):** geração automática de ocorrências recorrentes, sugestão de turma por aluno, otimização de horário, cobrança via payment_accounts.
