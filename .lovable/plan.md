

# Atualizar paginas de torneios para novo formato de modalidades + busca por cidade

## Resumo

Atualizar as paginas de gerenciamento, listagem publica e resultados para usar o novo sistema de modalidades. Adicionar busca por cidade na listagem publica de torneios.

---

## 1. Pagina Publica de Torneios (`src/pages/Tournaments.tsx`)

### Mudancas:
- Adicionar campo de **busca por cidade** (Input com icone de busca)
- Filtrar torneios apenas **em andamento** (data atual entre start_date e end_date) ou futuros
- Adicionar filtro visual por status: "Todos", "Em andamento", "Proximos"
- Adicionar badge de status em cada card (Em andamento / Inscricoes abertas)
- Adicionar link para chaveamentos em cada card de torneio
- Melhorar visual com skeleton loader durante carregamento

### Logica de filtro:
```text
- Busca por cidade: filtro local no state (case-insensitive)
- Torneios visiveis: is_public = true E end_date >= hoje
- Status: start_date <= hoje = "Em andamento", start_date > hoje = "Inscricoes abertas"
```

---

## 2. Pagina de Gerenciamento (`src/pages/ManageTournament.tsx`)

### Mudancas:
- Remover botoes antigos "Gerar Chaves" e "Lancar Resultados" (linhas 192-194) que apontam para o formato antigo
- Substituir por **secao de Modalidades** que lista as modalidades do torneio
- Cada modalidade mostra: nome, tipo, status, total de inscritos, botao "Gerenciar"
- Botao "Gerenciar" leva para `/tournaments/:id/brackets` (que ja tem o novo sistema)
- Adicionar botao "Adicionar Modalidade" inline (sem precisar ir para outra pagina)
- Manter resumo financeiro e listagem de inscricoes como estao

### Secao adicionada (entre inscricoes e botoes):
```text
MODALIDADES
[+ Adicionar Modalidade]

Card: Dupla Mista | 12 inscritos | Em andamento | [Gerenciar]
Card: Trio Feminino | 8 inscritos | Inscricoes abertas | [Gerenciar]
```

---

## 3. Pagina de Resultados (`src/pages/Results.tsx`)

### Mudancas:
- Atualizar para usar o novo sistema de modalidades em vez do antigo `match_results`
- Listar modalidades do torneio com status
- Para cada modalidade, mostrar resumo: total de jogos, jogos finalizados, top 4 (se finalizado)
- Clicar em "Ver resultados" leva para `/tournaments/:id/brackets` com a modalidade pre-selecionada
- Manter como pagina de visao geral dos resultados, redirecionando para o sistema principal de brackets

### Alternativa simplificada:
- Redirecionar diretamente para `/tournaments/:id/brackets` ja que toda a funcionalidade de resultados ja existe la (aba "Jogos/Resultados" e "Top 4")
- Manter a pagina Results como um wrapper que redireciona para Brackets

---

## 4. Dashboard (`src/pages/Dashboard.tsx`)

### Mudancas:
- Nos cards de torneio do organizador, adicionar botao "Chaveamentos" ao lado de "Gerenciar"
- Para atletas, adicionar link para ver chaveamentos do torneio inscrito

---

## Detalhes tecnicos

### `src/pages/Tournaments.tsx`
- Adicionar state `search` e `filter` (all/active/upcoming)
- Adicionar `Input` com placeholder "Buscar por cidade..." no topo
- Filtrar `tournaments` localmente por `city` ou `state` contendo o texto de busca
- Filtrar por data: `end_date >= today` para esconder encerrados
- Badge de status: comparar `start_date` e `end_date` com data atual
- Adicionar `Skeleton` loader durante carregamento

### `src/pages/ManageTournament.tsx`
- Importar `supabase` para buscar `tournament_modalities` e `modality_entries`
- Adicionar state para modalidades
- Renderizar secao "MODALIDADES" entre a listagem de inscritos e os botoes antigos
- Remover botoes antigos de "Gerar Chaves" e "Lancar Resultados"
- Cada modalidade card com Link para `/tournaments/:id/brackets`

### `src/pages/Results.tsx`
- Substituir query de `match_results` por `tournament_modalities` + `modality_matches`
- Listar modalidades com contagem de jogos finalizados
- Botao "Ver detalhes" leva para `/tournaments/:id/brackets`

### `src/pages/Dashboard.tsx`
- No card de torneio do organizador, adicionar segundo botao "Chaveamentos" linkando para `/tournaments/:id/brackets`

---

## Arquivos modificados

1. `src/pages/Tournaments.tsx` - busca por cidade + filtro de status + visual melhorado
2. `src/pages/ManageTournament.tsx` - secao de modalidades + remover botoes antigos
3. `src/pages/Results.tsx` - migrar para novo formato de modalidades
4. `src/pages/Dashboard.tsx` - link para chaveamentos nos cards de torneio

