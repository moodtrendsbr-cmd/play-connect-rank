

# Reconstrucao Completa: Social Feed Instagram-Style

## Visao Geral

Transformar o feed atual (cards simples sem imagens) em uma experiencia de rede social moderna, mobile-first, com suporte a imagens, comentarios inline, tipos de post, navegacao bottom bar, e visual neon verde sobre fundo escuro.

---

## Fase 1: Banco de Dados

### Novas tabelas

**post_media** - Suporte a imagens nos posts
- id (uuid, PK)
- post_id (uuid, FK -> posts.id, ON DELETE CASCADE)
- media_url (text, NOT NULL)
- order_index (integer, default 0)
- created_at (timestamptz)

**post_saves** - Posts salvos pelo usuario
- id (uuid, PK)
- post_id (uuid, FK -> posts.id, ON DELETE CASCADE)
- user_id (uuid, NOT NULL)
- created_at (timestamptz)
- UNIQUE(post_id, user_id)

### Alteracoes em tabelas existentes

**posts** - Adicionar coluna `type` enum se ainda nao existir com os valores corretos. A coluna `type` ja existe como text, entao criaremos um check ou usaremos os valores diretamente: `user`, `tournament`, `ranking`, `highlight`.

### Storage bucket

Criar bucket `post-images` (publico) para upload de imagens dos posts.

### RLS Policies

- post_media: SELECT publico, INSERT para author do post
- post_saves: SELECT/INSERT/DELETE para o proprio usuario
- Storage: upload autenticado, leitura publica

---

## Fase 2: Componentes de UI

### Novos arquivos a criar

```text
src/components/feed/
  FeedTopBar.tsx        - Logo + Search + Notificacoes
  FeedBottomNav.tsx     - Home, Ranking, +Criar, Torneios, Perfil
  PostCard.tsx          - Card completo estilo Instagram
  PostImageCarousel.tsx - Carrossel de imagens com swipe (Embla)
  PostComments.tsx      - Preview de comentarios + input rapido
  CreatePostDialog.tsx  - Modal para criar post com texto + imagens
  PostSkeleton.tsx      - Skeleton loading para posts
  PostTypeBadge.tsx     - Badge visual por tipo de post
  FeedLayout.tsx        - Layout wrapper (top bar + bottom nav + content)
```

### FeedTopBar
- Fundo `#050708`, borda inferior com glow verde sutil
- Logo "MOOD PLAY" a esquerda
- Input de busca centralizado (estilo pill, fundo `#0B0F12`)
- Icone de sino (notificacoes) a direita
- Posicao fixa no topo

### FeedBottomNav
- 5 icones: Home (feed), Ranking, + (criar post), Torneios, Perfil
- Botao "+" central maior com destaque neon verde
- Fundo `#050708`, borda superior sutil
- Posicao fixa na base
- Indicador ativo com cor neon

### PostCard
- Fundo `#0B0F12`, borda com `border-[#2BFF88]/10`
- Header: Avatar circular (iniciais como fallback) + nome + data relativa ("2h atras") + menu "..."
- Body: Texto + imagem(ns). Imagem ocupa largura total do card
- Footer: icones de Curtir (com animacao de escala), Comentar, Compartilhar, Salvar
- Contadores de likes e comentarios
- Preview dos 2 primeiros comentarios
- Link "ver todos os X comentarios"
- Campo rapido de comentario na base

### PostImageCarousel
- Usa Embla (ja instalado) para swipe entre imagens
- Indicadores de dots na base
- Aspect ratio 4:5 ou 1:1

### CreatePostDialog
- Dialog/Sheet full-screen no mobile
- Textarea para texto
- Botao de adicionar imagem (upload para bucket post-images)
- Preview das imagens selecionadas antes de publicar
- Botao "Publicar" com loading

---

## Fase 3: Logica do Feed

### Fetch de posts (refatorado)
1. Buscar posts com paginacao (20 por vez) para scroll infinito
2. Para cada lote, buscar:
   - profiles (author names + avatar_url) via mapping manual
   - post_media (imagens dos posts)
   - likes count + se o usuario atual curtiu
   - comments count + 2 primeiros comentarios
   - post_saves (se o usuario salvou)
3. Data relativa com `date-fns` (formatDistanceToNow)

### Acoes
- **Curtir/Descurtir**: Toggle na tabela likes com animacao no icone (escala + cor)
- **Comentar**: Insert em comments, atualiza preview inline
- **Salvar**: Toggle na tabela post_saves
- **Compartilhar**: Copiar link do post para clipboard
- **Scroll infinito**: Carregar mais 20 posts ao chegar no final
- **Busca**: Filtrar posts por conteudo ou nome do autor

### Tipos de post (badges visuais)
- `user`: Sem badge (post normal)
- `tournament`: Badge verde "Torneio" com icone de trofeu
- `ranking`: Badge amarela "Ranking" com icone de medalha
- `highlight`: Badge especial "Destaque" com icone de estrela, card com borda glow mais forte

---

## Fase 4: Pagina Feed.tsx (reescrita completa)

Estrutura:
```text
<FeedLayout>
  <FeedTopBar />
  <main> (com padding para top/bottom bars)
    <PostSkeleton /> (enquanto carrega)
    {posts.map(post => <PostCard />)}
    <div ref={loadMoreRef} /> (intersection observer para infinite scroll)
  </main>
  <FeedBottomNav />
  <CreatePostDialog /> (ativado pelo botao + do bottom nav)
</FeedLayout>
```

---

## Fase 5: Pagina Profile.tsx (adicionar aba Posts/Salvos)

- Adicionar Tabs com "Posts" e "Salvos"
- Aba "Posts": listar posts do usuario usando PostCard
- Aba "Salvos": listar posts salvos pelo usuario

---

## Detalhes Tecnicos

### Cores customizadas (adicionadas ao index.css ou inline)
- Background principal: `#050708`
- Cards: `#0B0F12`
- Neon primario: `#2BFF88`
- Texto secundario: `#9CA3AF`

### Dependencias existentes utilizadas
- `embla-carousel-react` para carrossel de imagens
- `date-fns` para datas relativas
- `framer-motion` para animacao do like
- `lucide-react` para icones
- Radix UI Dialog/Sheet para criar post

### Upload de imagens
- Upload via `supabase.storage.from("post-images").upload()`
- Gerar URL publica com `getPublicUrl()`
- Salvar referencia na tabela post_media

### Arquivos editados
1. `src/pages/Feed.tsx` - Reescrita completa
2. `src/pages/Profile.tsx` - Adicionar abas Posts/Salvos

### Arquivos criados
1. `src/components/feed/FeedTopBar.tsx`
2. `src/components/feed/FeedBottomNav.tsx`
3. `src/components/feed/PostCard.tsx`
4. `src/components/feed/PostImageCarousel.tsx`
5. `src/components/feed/PostComments.tsx`
6. `src/components/feed/CreatePostDialog.tsx`
7. `src/components/feed/PostSkeleton.tsx`
8. `src/components/feed/PostTypeBadge.tsx`
9. `src/components/feed/FeedLayout.tsx`

### Migracoes SQL
1. Criar tabela `post_media` com FK e RLS
2. Criar tabela `post_saves` com FK, unique constraint e RLS
3. Criar bucket `post-images` (publico)
4. Policies de storage para upload autenticado

