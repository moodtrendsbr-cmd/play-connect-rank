
# Feed sem Posts Proprios e Sugestoes de Amizade

## 1. Excluir posts do proprio usuario no feed

Atualmente o feed mostra todos os posts, incluindo os do usuario logado. A mudanca e simples:

**`src/pages/Feed.tsx`**
- Na query de posts (`fetchPosts`), adicionar `.neq("author_id", user.id)` para excluir posts do usuario logado
- Isso se aplica apenas quando o usuario esta autenticado
- Na busca (search), tambem filtrar para excluir posts proprios dos resultados

## 2. Componente de Sugestoes de Amizade

Criar um componente `FriendSuggestions.tsx` que aparece no feed (abaixo dos Clips, acima dos posts) como uma fila horizontal scrollavel.

### Logica de sugestao (por prioridade):

1. **Amigos em comum**: buscar usuarios que sao seguidos por pessoas que o usuario ja segue, mas que o usuario ainda nao segue
2. **Proximidade (cidade/estado)**: buscar usuarios da mesma cidade ou estado do perfil do usuario
3. **Excluir**: o proprio usuario e usuarios que ja segue

### Implementacao:

**Criar `src/components/feed/FriendSuggestions.tsx`**
- Buscar o perfil do usuario logado (cidade, estado)
- Buscar lista de quem o usuario ja segue
- Buscar "amigos de amigos": `follows` onde `follower_id` esta nos `following_ids` do usuario, excluindo o proprio usuario e quem ja segue
- Buscar usuarios da mesma cidade/estado que o usuario ainda nao segue
- Combinar resultados, priorizando amigos em comum, depois proximidade
- Limitar a ~10 sugestoes
- Exibir como cards horizontais com avatar, nome, cidade e botao "Seguir"
- Ao seguir, remover da lista e inserir na tabela `follows`

**Editar `src/pages/Feed.tsx`**
- Importar e renderizar `FriendSuggestions` entre `ClipsBar` e os posts

### Layout do card de sugestao:
- Card vertical compacto (~120px largura)
- Avatar circular no topo
- Nome abaixo (truncado)
- Info de contexto pequena: "X amigos em comum" ou icone de localizacao + cidade
- Botao "Seguir" verde neon

---

## Detalhes Tecnicos

### Arquivos a criar
- `src/components/feed/FriendSuggestions.tsx`

### Arquivos a editar
- `src/pages/Feed.tsx` -- adicionar filtro `.neq("author_id", user.id)` e importar FriendSuggestions

### Nenhuma migracao SQL necessaria
Todas as tabelas necessarias ja existem (`profiles` com city/state, `follows`).
