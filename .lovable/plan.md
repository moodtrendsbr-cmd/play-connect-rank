

# Fase 3 — Arena Management (Core Operacional)

Extensão do `ArenaLayout` existente em `/arena/dashboard`. Sem duplicar `arenas`, `courts`, `bookings`, `profiles`. Reutiliza tudo.

---

## 1. Auditoria — o que já existe e será reutilizado

| Existente | Reuso na Fase 3 |
|---|---|
| `arenas` (com tenant_id) | Centro operacional — todas novas tabelas referenciam `arena_id` |
| `courts` (com tenant_id, modalities, price_per_hour) | Aulas referenciam court_id existente |
| `bookings` (locação) | **Não tocar** — locação avulsa continua paralela às aulas |
| `profiles` | Reutilizado para alunos/professores via `profile_user_id` (não duplicar pessoa) |
| `payment_accounts` | Reutilizado para futura cobrança de mensalidade |
| `ArenaLayout` + nav existente | Estendido com 4 novas abas |
| `tenant_id` + RLS pattern Fase 1 | Replicado em todas as 6 tabelas novas |

**Conflito de nome:** já existe `enrollments` (inscrições em torneios). As matrículas em aulas serão **`class_enrollments`** — nome distinto, semântica distinta, zero ambiguidade.

---

## 2. Modelo de dados — 6 tabelas novas

Padrão obrigatório em todas: `id`, `tenant_id` (NOT NULL, FK), `arena_id` (NOT NULL, FK), `created_at`, `updated_at`.

| Tabela | Campos principais | Notas |
|---|---|---|
| **arena_students** | `id, tenant_id, arena_id, profile_user_id (nullable FK auth.users), full_name, email, phone, birth_date, status (active/inactive), notes, joined_at` | `profile_user_id` opcional — aluno pode existir sem conta no app (cadastro feito pela arena). UNIQUE(arena_id, email) parcial. |
| **arena_instructors** | `id, tenant_id, arena_id, profile_user_id (nullable FK auth.users), full_name, email, phone, specialties text[], bio, status, hourly_rate (nullable)` | Mesmo padrão. UNIQUE(arena_id, profile_user_id) parcial. |
| **arena_instructor_availability** | `id, instructor_id, weekday (0-6), start_time, end_time` | Disponibilidade base; sem inteligência. |
| **arena_classes** | `id, tenant_id, arena_id, instructor_id (FK), court_id (nullable FK courts), title, description, modality, level (iniciante/intermediario/avancado/livre), recurrence (none/weekly), weekday (nullable, 0-6), start_at (timestamptz), end_at (timestamptz), capacity (int), status (scheduled/canceled/completed), price (nullable)` | Aula única OU recorrente semanal. Sem geração automática de ocorrências (Fase 4 via ORKYM). |
| **arena_class_enrollments** | `id, tenant_id, arena_id, class_id (FK), student_id (FK arena_students), status (active/canceled/waitlist), payment_status (none/pending/paid), enrolled_at` | UNIQUE(class_id, student_id). |
| **arena_attendance** | `id, tenant_id, arena_id, class_id (FK), student_id (FK), enrollment_id (nullable), status (present/absent/late), checked_in_at (timestamptz), check_in_method (manual/qr), recorded_by (FK auth.users)` | UNIQUE(class_id, student_id). |
| **arena_checkin_tokens** | `id, tenant_id, arena_id, class_id (FK), token (text UNIQUE), expires_at (timestamptz), created_at` | Token efêmero p/ QR. Sem lógica avançada. |

**Triggers `set_*_tenant_default`** (mesmo padrão da Fase 2) para 6 tabelas — herdam `tenant_id` da arena.

---

## 3. RLS — isolamento total por arena/tenant

Padrão único para as 7 novas tabelas:

```sql
-- SELECT: arena owner + tenant admin + admin global + (alunos veem suas próprias matrículas)
CREATE POLICY "arena_owner_view" ON arena_students FOR SELECT
  USING (is_arena_owner(arena_id, auth.uid())
         OR is_tenant_admin(tenant_id, auth.uid())
         OR is_admin(auth.uid()));

-- INSERT/UPDATE/DELETE: arena owner + tenant admin + admin
CREATE POLICY "arena_owner_manage" ON arena_students FOR ALL
  USING (is_arena_owner(arena_id, auth.uid())
         OR is_tenant_admin(tenant_id, auth.uid())
         OR is_admin(auth.uid()));
```

**Exceções:**
- `arena_class_enrollments` SELECT: aluno vê suas próprias (`profile_user_id = auth.uid()` via JOIN com students)
- `arena_attendance` SELECT: idem (transparência ao aluno)
- `arena_checkin_tokens` SELECT: somente arena owner + tenant admin (token é segredo)

**Sem leituras públicas** — toda a fase é privada operacional.

---

## 4. Função de check-in (RPC SECURITY DEFINER)

```sql
CREATE FUNCTION arena_checkin_validate(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

Fluxo:
1. Recebe token + `auth.uid()` do aluno autenticado
2. Valida token não expirado
3. Localiza `class_id` → `arena_id` → student via `profile_user_id`
4. Confere matrícula ativa
5. INSERT em `arena_attendance` (status=present, method=qr)
6. Retorna `{ success, class_title, checked_in_at }`

Sem antifraude avançado, sem geolocalização — apenas fluxo funcional.

---

## 5. Frontend — extensão do ArenaLayout existente

**Não criar layout novo.** Adicionar 4 itens ao `navItems` em `src/pages/arena-dashboard/ArenaLayout.tsx`:

| Rota | Componente | Função |
|---|---|---|
| `/arena/dashboard/alunos` | `ArenaStudents.tsx` | Listar/criar/editar alunos. Busca por nome/email. Vincular a profile existente (autocomplete) ou criar standalone. |
| `/arena/dashboard/professores` | `ArenaInstructors.tsx` | Listar/criar/editar professores + disponibilidade básica. |
| `/arena/dashboard/aulas` | `ArenaClasses.tsx` | Lista de aulas (semanal), criar nova com instructor/court/horário/capacidade. |
| `/arena/dashboard/matriculas` | `ArenaClassEnrollments.tsx` | Por aula: ver matriculados, adicionar/remover aluno, marcar presença manual. Botão "Gerar QR" cria token + abre modal com código (canvas QR). |

**Dashboard existente (`ArenaDashboard.tsx`):** adicionar 2 cards (alunos ativos, aulas hoje) sem reescrever.

**QR display:** usar lib leve `qrcode.react` (já comum em sandbox) renderizando o token. Página pública `/arena/checkin?t=TOKEN` valida via RPC e mostra confirmação. Usuário precisa estar logado (auth via TenantContext + AuthContext).

---

## 6. Integrações sem duplicação

- **Bookings (locação avulsa):** intocados. Aulas usam `court_id` mas não criam booking — `arena_classes` é a fonte.
- **Conflito de horário court x aula:** validação no frontend ao criar aula (query bookings + classes overlapping). Sem trigger SQL nesta fase.
- **Marketplace (consumo interno):** **não criar** nesta fase. Documentado em pendências — Fase 4.
- **Pagamento de mensalidade:** `class_enrollments.payment_status` existe como string. Sem fluxo de cobrança implementado — preparado p/ Fase 5.
- **ORKYM:** zero chamadas. Sugestões de horário, otimização de turmas, recomendação de professor ficam para integração futura via `invokeOrkym()`.

---

## 7. Migração — arquivo único idempotente

`supabase/migrations/<ts>_phase3_arena_management.sql`:

1. CREATE 7 tables com FKs e UNIQUE constraints
2. ALTER TABLE … ENABLE ROW LEVEL SECURITY
3. CREATE 6 triggers `set_*_tenant_default`
4. CREATE policies (SELECT/INSERT/UPDATE/DELETE) por tabela
5. CREATE FUNCTION `arena_checkin_validate(text)` SECURITY DEFINER
6. CREATE INDEX em colunas de busca: `(arena_id, status)`, `(class_id, student_id)`, `(token)`

---

## 8. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase3_arena_management.sql` |
| Frontend novo | `src/pages/arena-dashboard/ArenaStudents.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaInstructors.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaClasses.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaClassEnrollments.tsx` |
| Frontend novo | `src/pages/arena-dashboard/ArenaCheckin.tsx` (página pública /arena/checkin) |
| Frontend edit | `src/pages/arena-dashboard/ArenaLayout.tsx` (+4 navItems) |
| Frontend edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` (+2 cards: alunos ativos, aulas hoje) |
| Frontend edit | `src/App.tsx` (+5 rotas) |
| Dependency | `qrcode.react` (geração QR) |
| Memory novo | `mem://features/arena-management` |

**Total:** 1 migration + 5 telas novas + 3 edits triviais. Zero módulo existente reescrito.

---

## ENTREGA B — Relatório esperado

| Item | Resultado |
|---|---|
| Tabelas criadas | 7 (`arena_students`, `arena_instructors`, `arena_instructor_availability`, `arena_classes`, `arena_class_enrollments`, `arena_attendance`, `arena_checkin_tokens`) |
| Reaproveitado | `arenas`, `courts`, `profiles`, `auth.users`, `tenant_id`, `is_arena_owner`, `is_tenant_admin` |
| Estendido | `ArenaLayout` (+4 abas), `ArenaDashboard` (+2 cards) |
| Relação chave | tenant → arena → (students, instructors, classes) → enrollments → attendance |
| Integração bookings | Mantida paralela; aula referencia `court_id` mas não cria booking |
| Check-in | Token efêmero + RPC `arena_checkin_validate` + página pública `/arena/checkin?t=` |
| RLS | 100% privada operacional; arena owner + tenant admin + admin global |

---

## ENTREGA C — Riscos / Pendências

**Para Fase 4:**
- Geração automática de ocorrências de aulas recorrentes (ORKYM)
- Sugestão de turma ideal por aluno (ORKYM)
- Otimização de horários professor x quadra (ORKYM)
- Cobrança recorrente de mensalidade via `payment_accounts`
- Marketplace interno (bar/lojinha da arena) — reutilizando estrutura `products` existente com flag `arena_id`

**Simplificações deliberadas:**
- Sem geolocalização no check-in
- Sem antifraude no QR (token simples + expires_at)
- Sem geração automática de ocorrências (criar aula = 1 ocorrência ou recorrência semanal lógica, sem materializar datas)
- Sem detecção automática de conflito de horário no SQL (validação no frontend)
- Sem fluxo de pagamento da matrícula (apenas campo `payment_status`)

**Compatibilidade preservada:**
- Bookings, tournaments, marketplace, sponsors, organizer admin: todos intocados
- Arena dashboard atual continua 100% funcional
- Sem mudanças em RLS de tabelas existentes

**Critério de sucesso:**
- ✅ Arena cadastra alunos, professores, aulas, matrículas, presença
- ✅ QR check-in funcional via token + RPC
- ✅ Tudo isolado por tenant + arena
- ✅ Zero duplicação (profiles/courts/arenas reutilizados)
- ✅ Zero IA local (ORKYM continua o cérebro)
- ✅ Sistema 100% funcional

