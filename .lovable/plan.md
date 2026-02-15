
# Corrigir paginas de torneios (Brackets, Results, Manage)

## Problema

As paginas `/tournaments/:id/manage`, `/tournaments/:id/brackets` e `/tournaments/:id/results` mostram "torneio nao encontrado" ou ficam carregando infinitamente porque o parametro `:id` da URL nao esta sendo validado. Quando o ID e invalido (ou literal `:id`), a query ao banco falha com erro de UUID e a pagina nunca carrega corretamente.

## Solucao

### 1. `src/pages/Brackets.tsx`
- Substituir `.single()` por `.maybeSingle()` na query do torneio (linha 56)
- Adicionar validacao de UUID no parametro `id` antes de fazer queries
- Se `id` for invalido, mostrar mensagem de erro imediatamente sem chamar o banco

### 2. `src/pages/Results.tsx`
- Substituir `.single()` por `.maybeSingle()` na query do torneio (linha 32)
- Adicionar mesma validacao de UUID

### 3. `src/pages/ManageTournament.tsx`
- Substituir `.single()` por `.maybeSingle()` na query do torneio (linha 25)
- Adicionar mesma validacao de UUID

### 4. `src/pages/TournamentDetail.tsx`
- Substituir `.single()` por `.maybeSingle()` na query do torneio
- Adicionar mesma validacao de UUID

### Detalhe tecnico
- Funcao auxiliar de validacao UUID: `const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-.../.test(str)`
- Se o ID nao for UUID valido, setar `dataLoaded = true` e `tournament = null` imediatamente, mostrando a tela de "Torneio nao encontrado" com botao de voltar
- Isso previne erros 400 no banco e da feedback claro ao usuario
