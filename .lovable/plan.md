
# Barra de Navegacao Fixa em Toda a Experiencia do Usuario

## O que muda

A bottom nav bar (Feed, Ranking, +Criar, Torneios, Perfil) atualmente so aparece na pagina `/feed`. Vamos torna-la global, presente em todas as paginas principais do usuario.

## Abordagem

Criar um layout compartilhado (`AppLayout`) que envolve as rotas de usuario e inclui a bottom nav + o dialog de criar post. As paginas individuais (Tournaments, Ranking, Profile) serao adaptadas para usar o tema dark e o padding inferior correto.

## Alteracoes

### 1. Criar `src/components/layout/AppLayout.tsx`
- Componente wrapper com `FeedLayout` (fundo dark #050708)
- Inclui `FeedBottomNav` fixo na base
- Inclui `CreatePostDialog` (ativado pelo botao +)
- Renderiza `<Outlet />` do react-router para o conteudo da pagina
- Adiciona `pb-20` ao conteudo para nao ficar atras da barra

### 2. Refatorar `FeedBottomNav.tsx`
- Tornar `onCreatePost` opcional (com fallback vazio)
- Nenhuma mudanca visual

### 3. Atualizar `src/App.tsx`
- Criar um grupo de rotas com `AppLayout` como layout pai para: `/feed`, `/ranking`, `/tournaments`, `/profile`
- As rotas admin, login, register, landing permanecem sem a bottom nav

```text
<Route element={<AppLayout />}>
  <Route path="/feed" element={<Feed />} />
  <Route path="/ranking" element={<Ranking />} />
  <Route path="/tournaments" element={<Tournaments />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/tournaments/:id" element={<TournamentDetail />} />
</Route>
```

### 4. Adaptar paginas para remover headers duplicados e usar tema dark

**Tournaments.tsx:**
- Remover o `<header>` proprio (a top bar ja vem do layout ou nao e necessaria)
- Usar fundo `#050708` (via FeedLayout do AppLayout)
- Adicionar padding bottom para a barra

**Ranking.tsx:**
- Remover o `<header>` proprio
- Adaptar para tema dark consistente

**Profile.tsx:**
- Remover o `<header>` proprio
- Adaptar para tema dark

### 5. Remover bottom nav e CreatePostDialog de `Feed.tsx`
- Como agora estao no AppLayout, remover de dentro do Feed para evitar duplicacao

## Resultado

- O usuario ve a bottom nav em TODAS as paginas principais
- Pode navegar livremente entre Feed, Ranking, Torneios e Perfil
- O botao "+" de criar post funciona de qualquer pagina
- Visual dark neon verde consistente em toda a experiencia
