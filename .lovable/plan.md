

# Social Completo: Perfil, Seguir, Hashtags, Busca Global e Ranking Enriquecido

## Visao Geral

Implementar sistema de seguidores, perfil social completo com posts salvos e campos adicionais, hashtags, busca global inteligente, perfil publico, e ranking redesenhado com secoes de trending.

---

## Fase 1: Banco de Dados (Migracao SQL)

### Nova tabela `follows`
- id (uuid PK), follower_id (uuid NOT NULL), following_id (uuid NOT NULL), created_at (timestamptz default now())
- UNIQUE(follower_id, following_id)
- CHECK(follower_id != following_id)
- RLS: SELECT publico, INSERT onde auth.uid() = follower_id, DELETE onde auth.uid() = follower_id

### Nova tabela `hashtags`
- id (uuid PK), tag (text NOT NULL UNIQUE), created_at (timestamptz default now())

### Nova tabela `post_hashtags`
- id (uuid PK), post_id (uuid NOT NULL refs posts ON DELETE CASCADE), hashtag_id (uuid NOT NULL refs hashtags ON DELETE CASCADE)
- UNIQUE(post_id, hashtag_id)
- RLS: SELECT publico, INSERT para author do post

### Nova tabela `hashtag_searches`
- id (uuid PK), hashtag_id (uuid refs hashtags), searched_by (uuid nullable), created_at (timestamptz default now())
- RLS: SELECT publico, INSERT autenticado
- Registra cada busca por hashtag para calcular trending

### Novos campos na tabela `profiles`
- bio (text nullable)
- team (text nullable)
- titles (text nullable)
- show_contact (boolean default false)

---

## Fase 2: Sistema de Hashtags

### Na criacao do post (CreatePostDialog)
- Extrair hashtags do texto via regex `/#(\w+)/g`
- Para cada hashtag encontrada: UPSERT na tabela `hashtags`, depois INSERT em `post_hashtags`
- As hashtags no texto do post serao renderizadas em cor neon verde clicavel

### No PostCard
- Renderizar hashtags dentro do texto como `<span>` clicavel com cor `#2BFF88`
- Ao clicar numa hashtag, preencher o campo de busca do feed com essa hashtag

---

## Fase 3: Busca Global Inteligente (FeedTopBar + Feed.tsx)

### Logica de busca expandida
Quando o usuario digitar no campo de busca, buscar em paralelo:
1. **Posts por conteudo**: `ilike content '%termo%'`
2. **Posts por nome do autor**: buscar `profiles` com `ilike full_name '%termo%'`, pegar user_ids, buscar posts com `author_id IN (...)`
3. **Posts por hashtag**: se comeca com `#`, buscar na tabela `hashtags` -> `post_hashtags` -> posts
4. Combinar resultados sem duplicatas, ordenar por created_at desc

### Debounce
- Adicionar debounce de 400ms na busca para nao disparar a cada tecla

---

## Fase 4: Perfil Redesenhado (Profile.tsx)

### Layout novo
- Avatar grande (com iniciais como fallback)
- Nome, localizacao, bio
- Campos adicionais: time, titulos
- Toggle "mostrar contato" no modo edicao
- Contadores clicaveis: posts | seguidores | seguindo
- Tabs: "Posts" e "Salvos"

### Aba Posts
- Buscar posts onde author_id = user.id
- Renderizar com PostCard reutilizado

### Aba Salvos
- Buscar post_saves do usuario -> enriquecer com enrichPosts
- Renderizar com PostCard

### Formulario de edicao expandido
- Adicionar campos: bio, team, titles, show_contact (switch)

---

## Fase 5: Perfil Publico (UserProfile.tsx)

### Nova rota `/profile/:userId`
- Adicionar em App.tsx dentro do AppLayout
- Mostra perfil de qualquer usuario
- Botao Seguir/Deixar de seguir (otimista)
- Contadores: posts, seguidores, seguindo
- Aba Posts (sem aba Salvos)
- Mostra contato somente se show_contact=true
- Mostra team, titles, bio

### FollowListDialog.tsx
- Modal que lista seguidores ou seguindo
- Cada item: avatar + nome + botao seguir
- Clicavel para ir ao perfil

---

## Fase 6: Seguir no PostCard e Feed

### PostCard
- Avatar e nome viram links para `/profile/:authorId`
- Usar `useNavigate` ou `Link`

### Feed priorizado
- Ao carregar, buscar `follows` do usuario: `SELECT following_id FROM follows WHERE follower_id = user.id`
- Marcar cada post com `is_following: boolean`
- Separar e concatenar: posts de seguidos primeiro, depois restante
- Manter scroll infinito e busca funcionando

---

## Fase 7: Ranking Redesenhado (Ranking.tsx)

### Secoes do ranking

**1. Hashtags em Alta (Trending)**
- Query: contar ocorrencias em `hashtag_searches` dos ultimos 7 dias, agrupado por hashtag_id
- Exibir top 10 hashtags como chips/pills clicaveis
- Ao clicar, navegar para `/feed` com busca pre-preenchida com a hashtag
- Visual: fundo `#0B0F12`, texto `#2BFF88`, pill arredondado

**2. Post Mais Curtido da Semana**
- Query: contar likes dos ultimos 7 dias agrupado por post_id, pegar o top 1
- Exibir como um card destacado com imagem (se tiver), nome do autor, contagem de likes
- Visual: card com borda glow verde mais forte

**3. Perfis com Mais Seguidores (50+)**
- Query: contar follows agrupado por following_id, filtrar >= 50
- Buscar profiles correspondentes
- Exibir lista rankeada com avatar, nome, contagem de seguidores
- Visual: medalhas para top 3, cards estilo existente

**4. Ranking de Vitorias (existente, mantido)**
- Manter a logica atual de match_results
- Reestilizar para combinar com as novas secoes

### Layout final do Ranking
```text
+----------------------------------+
|  RANKING                         |
|                                  |
|  # Em Alta                       |
|  [#beach] [#volei] [#copa2025]  |
|                                  |
|  Post da Semana                  |
|  [Card com imagem + likes]       |
|                                  |
|  Top Perfis                      |
|  1. Joao - 120 seguidores       |
|  2. Maria - 89 seguidores       |
|                                  |
|  Ranking de Vitorias             |
|  1. Atleta1 - 50pts             |
|  2. Atleta2 - 40pts             |
+----------------------------------+
```

---

## Resumo de Arquivos

### Criar
- `src/pages/UserProfile.tsx` -- perfil publico
- `src/components/profile/FollowListDialog.tsx` -- lista seguidores/seguindo
- `src/components/profile/ProfileHeader.tsx` -- header reutilizavel (avatar, stats, bio, follow)

### Editar
- `src/pages/Profile.tsx` -- redesenho com tabs Posts/Salvos, campos adicionais, contadores
- `src/pages/Feed.tsx` -- busca global multi-campo, priorizacao por follows, debounce
- `src/pages/Ranking.tsx` -- redesenho completo com 4 secoes
- `src/components/feed/PostCard.tsx` -- hashtags clicaveis, avatar/nome como link
- `src/components/feed/FeedTopBar.tsx` -- debounce na busca
- `src/components/feed/CreatePostDialog.tsx` -- extracao e persistencia de hashtags
- `src/App.tsx` -- nova rota /profile/:userId

### Migracao SQL
- Criar tabelas: follows, hashtags, post_hashtags, hashtag_searches
- Adicionar colunas em profiles: bio, team, titles, show_contact
- RLS para todas as novas tabelas

