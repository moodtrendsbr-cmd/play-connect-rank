
# Melhorias no Perfil, PostCard e Clips/Stories

## Resumo

Adicionar foto de perfil editavel, funcionalidade dos 3 pontinhos e compartilhar no PostCard, campo de link clicavel no perfil, secao de destaques, e sistema de Clips (stories) no topo do feed.

---

## 1. Foto de Perfil Editavel

### ProfileHeader.tsx
- No perfil proprio, ao clicar no avatar, abrir um file input para selecionar imagem
- Upload da imagem para o bucket `post-images` (ja existe) no path `avatars/{userId}`
- Atualizar `profiles.avatar_url` com a URL publica
- Mostrar um icone de camera sobre o avatar quando for perfil proprio

### Profile.tsx (formulario de edicao)
- Adicionar botao "Alterar foto" no formulario de edicao tambem

---

## 2. Tres Pontinhos (Menu do Post) - PostCard.tsx

- Ao clicar nos 3 pontinhos, abrir um DropdownMenu com opcoes:
  - **Se for autor do post**: "Excluir post" (delete da tabela posts)
  - **Para qualquer usuario**: "Copiar link", "Denunciar" (placeholder)
  - **Se for perfil proprio**: "Adicionar aos Destaques" (salvar em nova tabela)

---

## 3. Botao Compartilhar Funcional - PostCard.tsx

- Usar a Web Share API (`navigator.share`) quando disponivel (mobile)
- Fallback: copiar link para clipboard e mostrar toast "Link copiado!"
- O link sera `{origin}/feed#${post.id}`

---

## 4. Campo de Link no Perfil

### Banco de dados
- Adicionar coluna `link` (text, nullable) na tabela `profiles`

### ProfileHeader.tsx
- Exibir link logo abaixo da bio, com icone de link externo
- Renderizar como `<a>` clicavel abrindo em nova aba
- Cor neon verde (#2BFF88)

### Profile.tsx (formulario de edicao)
- Adicionar campo "Link" no formulario

---

## 5. Destaques no Perfil

### Banco de dados
- Nova tabela `profile_highlights`:
  - id (uuid PK)
  - user_id (uuid NOT NULL)
  - post_id (uuid NOT NULL, refs posts ON DELETE CASCADE)
  - created_at (timestamptz default now())
  - UNIQUE(user_id, post_id)
  - RLS: SELECT publico, INSERT/DELETE onde auth.uid() = user_id

### ProfileHeader.tsx / Profile.tsx / UserProfile.tsx
- Adicionar secao horizontal scrollavel abaixo do header com thumbnails dos posts destacados
- Cada thumbnail: primeira imagem do post (ou icone de texto se nao tiver imagem)
- Ao clicar, abrir o post em destaque (dialog ou scroll para ele)
- No perfil proprio: mostrar botao "+" para adicionar novo destaque

### PostCard.tsx (menu 3 pontinhos)
- Opcao "Destacar" para posts proprios
- Insert/delete na tabela profile_highlights

---

## 6. Clips (Stories) no Topo do Feed

### Banco de dados
- Nova tabela `clips`:
  - id (uuid PK)
  - author_id (uuid NOT NULL)
  - media_url (text NOT NULL) -- video curto
  - thumbnail_url (text, nullable)
  - caption (text, nullable)
  - created_at (timestamptz default now())
  - expires_at (timestamptz default now() + interval '24 hours')
  - RLS: SELECT publico, INSERT onde auth.uid() = author_id, DELETE onde auth.uid() = author_id

### Componentes novos
- `src/components/feed/ClipsBar.tsx`:
  - Barra horizontal scrollavel no topo do feed (abaixo do FeedTopBar)
  - Mostra circulos com avatar de quem tem clips ativos (nao expirados)
  - Primeiro circulo: "+" para adicionar clip proprio
  - Borda neon verde animada nos circulos com clips nao vistos
  - Ao rolar o feed para baixo, a barra sobe junto (nao e fixa)
  - Ao clicar em "Feed" na bottom nav, scroll volta ao topo e a barra reaparece

- `src/components/feed/ClipViewer.tsx`:
  - Modal fullscreen para assistir clips
  - Reproduz video com controles basicos (pause/play ao tocar)
  - Mostra nome do autor, caption, e tempo restante
  - Swipe horizontal para proximo/anterior clip do mesmo autor
  - Botao fechar (X) no topo

- `src/components/feed/CreateClipDialog.tsx`:
  - Dialog para upload de video curto (max 60s sugerido)
  - Campo de caption opcional
  - Upload para bucket de storage

### Feed.tsx
- Adicionar `<ClipsBar />` no topo do conteudo (dentro do `<main>`, antes dos posts)
- Ao clicar no icone Feed na bottom nav, fazer scroll to top

### FeedBottomNav.tsx
- Ao clicar em "Feed" quando ja esta na pagina do feed, emitir evento/callback para scroll to top

---

## Resumo de Arquivos

### Criar
- `src/components/feed/ClipsBar.tsx` -- barra de clips/stories
- `src/components/feed/ClipViewer.tsx` -- visualizador fullscreen de clips
- `src/components/feed/CreateClipDialog.tsx` -- dialog para criar clip

### Editar
- `src/components/profile/ProfileHeader.tsx` -- upload de foto, link, secao destaques
- `src/pages/Profile.tsx` -- campos link, destaques, upload avatar no form
- `src/pages/UserProfile.tsx` -- secao destaques
- `src/components/feed/PostCard.tsx` -- menu 3 pontinhos funcional, share funcional, opcao destacar
- `src/pages/Feed.tsx` -- integrar ClipsBar, scroll to top
- `src/components/feed/FeedBottomNav.tsx` -- callback scroll to top no Feed

### Migracao SQL
- Adicionar coluna `link` em profiles
- Criar tabela `profile_highlights` com RLS
- Criar tabela `clips` com RLS
