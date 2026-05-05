
## Diagnóstico confirmado

### Bug do backfill (causa raiz)
A RPC `backfill_orphan_enrollments()` tem dois defeitos:
1. O loop filtra `WHERE needs_category_review = false` — então os 5 enrollments da Copa Arena Beach (já marcados `true` numa execução anterior) **são ignorados silenciosamente** e não aparecem no relatório.
2. Não distingue `skipped_no_modality` (torneio sem categoria, irrecuperável) de erro genérico, e não classifica seed/smoke vs produção real.

### Estado real dos 17 órfãos (query confirmada)
| Categoria | Qtde | Origem | Ação |
|---|---|---|---|
| `needs_category_review` (18 modalities) | 5 | Copa Arena Beach - Fase Final | Já marcados, expor em UI |
| `unrecoverable_no_category` (0 modalities, nome `[SMOKE]`) | 5 | Smoke-tests antigos | Arquivar |
| `unrecoverable_no_category` (0 modalities, seed) | 7 | Arena Mista Inverno, Torneio Feminino de Praia, Copa Mood Play 2026 | Arquivar |

### Botões técnicos visíveis hoje em `/admin/control-tower`
- "Criar piloto" (`seed-pilot-arena`)
- "Smoke-test pagamento" (`smoke-test-payment`)
- "Backfill inscrições" (`backfill_orphan_enrollments`)

---

## Plano de execução

### 1. Limpar `AdminControlTower.tsx`
Remover do header os 3 botões: `seedPilot`, `smokeTestPayment`, `backfillEnrollments` e seus handlers/state. Manter apenas o botão Refresh. Control Tower volta a mostrar só saúde/alertas/receita/upsell.

### 2. Criar `/admin/internal-tools` (super_admin only)
Nova rota `src/pages/admin/AdminInternalTools.tsx`:
- Guard: redireciona se `!has_role(user, 'admin')` (já protegido por AdminLayout, mas reforça server-side via RPC).
- 3 cards distintos com linguagem técnica explícita ("Ambiente interno · não visível a clientes"):
  - **Smoke-test pagamento** (mostra checks 8/8 detalhados)
  - **Seed piloto arena**
  - **Backfill + relatório de órfãos** (ver §4)
- Adicionar entrada no `AdminLayout.tsx` (sidebar real, não o deprecado `AdminSidebar.tsx`) num grupo novo "Interno" no fim, com ícone `Wrench` e label "Ferramentas internas".
- Rota registrada em `src/App.tsx` dentro do bloco admin.

### 3. Corrigir RPC `backfill_orphan_enrollments` (migration)
Reescrita com:
- **Remove** o filtro `needs_category_review = false` no loop — re-processa todos os pagos sem entry.
- **3 buckets corretos**:
  - `0 modalities` → marca `needs_category_review = false`, novo flag `metadata->>'orphan_reason' = 'unrecoverable_no_category'` (usar coluna `metadata jsonb` se existe; senão adicionar via migration), conta em `unrecoverable_no_category`.
  - `1 modality` → vincula, dispara trigger, conta em `auto_linked`.
  - `≥2 modalities` → marca `needs_category_review = true`, conta em `needs_category_review`.
- **Retorno enriquecido**: `{ ok, auto_linked, needs_category_review, unrecoverable_no_category, total_processed, items: [{enrollment_id, tournament_id, tournament_name, bucket, modality_count, is_test}] }` onde `is_test = tournament_name ILIKE '[SMOKE]%' OR ILIKE '%seed%'`.
- Verificação extra: se `enrollments` não tiver coluna `metadata`, a migration adiciona `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb` e `orphan_reason text`.

### 4. UI do relatório (dentro de `/admin/internal-tools`)
- Botão "Rodar backfill" → chama RPC, exibe os 3 contadores em cards.
- Tabela classificada por bucket, com badges:
  - 🟢 `auto_linked`
  - 🟡 `needs_category_review` (link para `/admin/enrollments?filter=needs_review`)
  - 🔴 `unrecoverable_no_category` (badge extra `[TESTE]` se `is_test`)
- Botão secundário "Arquivar dados de teste" → chama nova RPC `archive_test_orphans()` que faz `UPDATE enrollments SET status='archived', metadata = metadata || '{"archived_reason":"test_data"}'` apenas onde `is_test=true`. Confirmação obrigatória.

### 5. Filtro em `/admin/enrollments`
Adicionar tab/filtro "Precisam revisão de categoria" listando `needs_category_review = true`, com ação "Definir categoria" (dropdown das modalities do torneio → UPDATE enrollment.modality_id, trigger cria entry).

### 6. Validação final
- Smoke-test continua passando 8/8 (rodar via /admin/internal-tools).
- Após rodar backfill corrigido: esperado `auto_linked=0, needs_category_review=5, unrecoverable_no_category=12, total_processed=17`.
- Após "Arquivar dados de teste": 12 órfãos arquivados, restam 5 visíveis em `/admin/enrollments` aguardando categoria.
- Confirmar via query SQL.

---

## Detalhes técnicos

**Arquivos modificados:**
- `src/pages/admin/AdminControlTower.tsx` — remove 3 botões + state + handlers + imports não usados (`Sparkles`, `Zap` mantém só onde necessário).
- `src/pages/admin/AdminLayout.tsx` — adiciona item "Ferramentas internas" na sidebar, condicionado a admin.
- `src/App.tsx` — registra `<Route path="internal-tools" element={<AdminInternalTools />} />`.
- `src/pages/admin/AdminEnrollments.tsx` — adiciona filtro `needs_category_review`.

**Arquivos criados:**
- `src/pages/admin/AdminInternalTools.tsx`
- `supabase/migrations/<ts>_fix_backfill_and_archive.sql` — corrige `backfill_orphan_enrollments`, cria `archive_test_orphans`, adiciona colunas `metadata`/`orphan_reason` se faltantes.

**Memórias atualizadas:**
- `mem/features/tournament-enrollment-fix.md` — adiciona nota do fix do backfill + buckets corretos + localização das ferramentas internas.
- `mem/index.md` — atualiza one-liner.

**Não-objetivos (explícitos):**
- Não criar novas features de produto.
- Não tocar bracket/jogos/pódio (fora de escopo).
- Não apagar dados automaticamente — apenas arquivar mediante clique explícito.
- Não expor ferramentas internas a tenant/arena/organizer/company/athlete.
