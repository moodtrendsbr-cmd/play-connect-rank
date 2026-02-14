
# Correcao Completa: Queries com Joins Invalidos + Dashboard Admin

## Problema Raiz
As foreign keys de `enrollments.user_id`, `match_results.player1_id`, `match_results.player2_id`, etc. apontam para `auth.users`, mas o codigo tenta fazer joins PostgREST com a tabela `profiles` (ex: `profiles:user_id(full_name)`). Isso causa erro 400 e as paginas mostram dados vazios/incorretos.

## Paginas Afetadas e Correcoes

### 1. ManageTournament.tsx (enrollments com nomes)
**Problema**: Query `profiles:user_id(full_name, whatsapp)` falha (FK vai para auth.users, nao profiles).
**Correcao**: Buscar enrollments sem join, depois buscar profiles separadamente e mapear por user_id.

### 2. Brackets.tsx (nomes dos jogadores nas chaves)
**Problema**: Queries `p1:player1_id(full_name)` e `profiles:user_id(full_name)` falham.
**Correcao**: Buscar match_results sem joins, coletar todos player IDs, buscar profiles separadamente e mapear.

### 3. Results.tsx (nomes nos resultados)
**Problema**: Query `p1:player1_id(full_name, user_id)` falha.
**Correcao**: Mesma abordagem - buscar matches simples, depois profiles separadamente.

### 4. Dashboard.tsx (admin ve zeros)
**Problema**: Admin nao e organizer nem athlete, entao o dashboard mostra "MEUS TORNEIOS" com tudo zerado.
**Correcao**: Quando `userRole === "admin"`, mostrar um resumo geral (total torneios, total inscricoes) ou redirecionar para /admin. Adicionar tratamento para role admin.

## Detalhes Tecnicos

O padrao de correcao e o mesmo para todas as paginas:

```text
// ANTES (falha com 400):
const { data } = await supabase
  .from("enrollments")
  .select("*, profiles:user_id(full_name)")
  .eq("tournament_id", id);

// DEPOIS (funciona):
const { data: enrollments } = await supabase
  .from("enrollments")
  .select("*")
  .eq("tournament_id", id);

const userIds = (enrollments || []).map(e => e.user_id).filter(Boolean);
const { data: profiles } = await supabase
  .from("profiles")
  .select("user_id, full_name, whatsapp")
  .in("user_id", userIds.length ? userIds : ["none"]);

const profileMap = {};
(profiles || []).forEach(p => { profileMap[p.user_id] = p; });

// Usar profileMap[enrollment.user_id]?.full_name nas renderizacoes
```

### Arquivos a editar:
1. `src/pages/ManageTournament.tsx` - Remover join, mapear profiles manualmente
2. `src/pages/Brackets.tsx` - Remover joins em match_results e enrollments, mapear profiles
3. `src/pages/Results.tsx` - Remover joins em match_results, mapear profiles
4. `src/pages/Dashboard.tsx` - Adicionar tratamento para userRole "admin" (redirecionar para /admin ou mostrar dados gerais)
