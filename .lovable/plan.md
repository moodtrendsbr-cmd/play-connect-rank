## Estado atual (auditoria)

A maior parte do trabalho já foi entregue em loops anteriores. Confirmei via grep e leitura dos arquivos:

| Item | Status |
|---|---|
| Botões Smoke/Seed/Backfill removidos de `AdminControlTower.tsx` | Feito (grep vazio) |
| `AdminInternalTools.tsx` criado (259 linhas, 3 cards técnicos) | Feito |
| Rota `/admin/internal-tools` registrada em `App.tsx` | Feito |
| Item "Ferramentas internas" na sidebar do `AdminLayout.tsx` (ícone Wrench) | Feito |
| Migration `20260505122715` — corrige `backfill_orphan_enrollments` + cria `archive_test_orphans` + adiciona colunas `orphan_reason`/`archived_at` | Feito e aplicada |
| RPC com 3 buckets corretos (`auto_linked` / `needs_category_review` / `unrecoverable_no_category`) e flag `is_test` | Feito |
| `ArenaControlTower.tsx` sem debug (só saúde + uso + Orkym actions de produto) | Já limpo |

## O que ainda falta

### 1. Filtro "Precisam revisão de categoria" em `/admin/enrollments`
`AdminEnrollments.tsx` ainda não tem o filtro/aba para `needs_category_review = true`. Adicionar:
- Toggle/Tab no topo da página: "Todos" | "Precisam revisão" | "Arquivados".
- Quando "Precisam revisão" ativo: filtra `needs_category_review = true AND archived_at IS NULL`.
- Coluna extra mostrando `orphan_reason` e badge `[TESTE]` quando o nome do torneio bate `[SMOKE]%` / `%seed%` / `%test%`.
- Ação inline "Definir categoria": dropdown das `tournament_modalities` daquele torneio → `UPDATE enrollments SET modality_id = X, needs_category_review = false, orphan_reason = NULL`. Trigger existente cria `modality_entry` + `modality_entry_members`.

### 2. Proteção extra (feature flag)
A guarda hoje é só role `admin` via `AdminLayout`. Adicionar em `AdminInternalTools.tsx`:
- Ler `import.meta.env.VITE_ENABLE_INTERNAL_TOOLS`.
- Se `!== 'true'` E não for super_admin → render de "Indisponível neste ambiente".
- Documentar a env var no README.

### 3. Validação final
- Rodar smoke-test pelo card em `/admin/internal-tools` → confirmar 8/8.
- Rodar backfill pelo mesmo card → conferir contagem esperada (`auto_linked=0, needs_category_review=5, unrecoverable_no_category=12, total_processed=17`).
- Conferir via `read_query` que após "Arquivar dados de teste" só restam 5 órfãos visíveis.
- TypeScript build limpo (verificado pelo harness).

## Arquivos afetados nesta iteração

**Editar:**
- `src/pages/admin/AdminEnrollments.tsx` — adicionar filtro/tab + ação "Definir categoria".
- `src/pages/admin/AdminInternalTools.tsx` — guard `VITE_ENABLE_INTERNAL_TOOLS`.

**Sem migrations novas** (a de `20260505122715` já cobre tudo).

## Não-objetivos
- Não tocar Control Tower (já limpo).
- Não criar novas features.
- Não apagar dados — só arquivar via clique explícito.
- Não expor ferramentas internas fora de admin.

## Relatório final (após implementação)
- **Removido do Admin visível**: 3 botões técnicos do header de Control Tower (já feito).
- **Ferramentas internas**: `/admin/internal-tools`, gated por role admin + `VITE_ENABLE_INTERNAL_TOOLS`.
- **Backfill corrigido**: 3 buckets, sem falha silenciosa, retorno enriquecido com `items[]`.
- **Órfãos classificados**: 5 needs_review (Copa Arena Beach), 12 unrecoverable (smoke + seeds antigos) prontos para arquivamento.
- **Fluxo novo**: admin opera categoria via `/admin/enrollments?filter=needs_review`.
