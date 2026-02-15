
# Filtro no Ranking, Medalhas no Perfil, Fixes de Layout e Barra Menor

## 1. Filtro na pagina de Ranking

Adicionar tabs ou botoes de filtro no topo do Ranking para que o usuario escolha qual secao visualizar. Opcoes:

- **Todos** (padrao): mostra tudo como esta hoje
- **Vitorias**: apenas a secao de ranking de vitorias
- **Perfis**: apenas top perfis por seguidores
- **Hashtags**: apenas trending hashtags

Implementacao: estado `filter` com valor `"all" | "victories" | "profiles" | "hashtags"`, e renderizacao condicional das secoes. Chips horizontais estilizados em neon verde.

## 2. Medalha no perfil para top 3 do ranking

Para atletas que estao nas posicoes 1, 2 ou 3 do ranking de vitorias, exibir uma medalha ao lado do nome no `ProfileHeader.tsx` e `UserProfile.tsx`.

### Logica:
- No `ProfileHeader`, ao montar, buscar `match_results` e calcular o ranking de vitorias (mesma logica do `Ranking.tsx`)
- Verificar se o `profileUserId` esta entre os top 3
- Se sim, exibir o emoji da medalha (ouro, prata, bronze) e um tooltip/descricao curta: "1o lugar no Ranking de Vitorias" etc.
- A medalha aparece ao lado do nome do atleta, visivel para todos

### Detalhes tecnicos:
- Reutilizar a query de `match_results` agrupando vitorias
- Calcular posicao do usuario atual no ranking
- Mostrar badge colorido ao lado do `<h1>` do nome

## 3. TournamentDetail: conteudo escondido atras da barra fixa

O `TournamentDetail` esta dentro do `AppLayout` (que tem a bottom nav fixa), mas nao tem `pb-20` suficiente. O conteudo inferior fica atras da barra.

### Fix:
- Na `<main>` do `TournamentDetail.tsx`, adicionar `pb-24` para garantir espaco suficiente abaixo do ultimo elemento

## 4. Payment: sem barra de navegacao e sem botao de voltar

A rota `/payment/:id` esta FORA do `AppLayout` (linha 57 do App.tsx), entao nao tem a bottom nav. Solucoes:

### Opcao escolhida:
- Mover a rota `/payment/:id` para dentro do `AppLayout` para que tenha a barra de navegacao fixa
- Adicionar um botao "Voltar" no topo da pagina de Payment apontando para `/tournaments/:id`
- Adicionar `pb-24` ao conteudo do Payment

## 5. Diminuir tamanho da barra fixa e do botao "+"

Atualmente a barra tem `h-16` e o botao `+` tem `h-14 w-14` com `-mt-5`.

### Ajustes:
- Barra: reduzir para `h-14`
- Botao `+`: reduzir para `h-11 w-11` com `-mt-4`
- Icone do `+`: reduzir de `h-7 w-7` para `h-5 w-5`
- Icones dos outros itens: manter `h-5 w-5` (ja estao proporcionais)
- Atualizar `pb-20` para `pb-18` nas paginas que usam padding bottom (ou manter `pb-20` que ainda e seguro)

---

## Resumo de arquivos

### Editar
- `src/pages/Ranking.tsx` -- adicionar filtro por secao (tabs/chips)
- `src/components/profile/ProfileHeader.tsx` -- buscar e exibir medalha do ranking ao lado do nome
- `src/pages/TournamentDetail.tsx` -- adicionar `pb-24` no main, remover header proprio (ja vem do AppLayout)
- `src/pages/Payment.tsx` -- adicionar botao voltar, `pb-24` no conteudo
- `src/App.tsx` -- mover rota `/payment/:id` para dentro do `AppLayout`
- `src/components/feed/FeedBottomNav.tsx` -- reduzir altura da barra e tamanho do botao `+`
