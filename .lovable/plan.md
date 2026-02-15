
# Grid de Posts no Perfil, Editar Perfil com Icone, Destaques com Clips e Fixar Posts

## 1. Posts em grid 3 colunas no perfil

Atualmente os posts no perfil (`Profile.tsx` e `UserProfile.tsx`) sao exibidos como cards grandes em lista vertical. A mudanca e exibi-los como miniaturas em grid de 3 colunas (estilo Instagram).

- Cada miniatura mostra a primeira imagem do post (ou um icone de texto se nao tiver imagem)
- Ao clicar na miniatura, abre um Dialog/modal com o PostCard completo
- Aplicar o mesmo layout tanto no perfil proprio (`Profile.tsx`) quanto no perfil de outro usuario (`UserProfile.tsx`)

## 2. Icone de editar perfil

Substituir o botao "Editar perfil" (texto) por um icone de lapis/editar (`Settings` ou `Pencil` do lucide) posicionado no canto do header do perfil, mais discreto e moderno.

## 3. Destaques: salvar posts e clips

Atualmente os destaques so mostram posts fixados via `profile_highlights`. A mudanca:

- Incluir tambem os **clips do usuario** (da tabela `clips`) nos destaques, exibindo thumbnail ou icone de video
- Os clips aparecem ao lado dos posts destacados na fila horizontal de destaques

## 4. Fixar posts no perfil

Adicionar coluna `pinned_at` (timestamptz, nullable) na tabela `posts`. Posts fixados aparecem primeiro na listagem do perfil.

- No menu de 3 pontinhos do PostCard, adicionar opcao "Fixar no perfil" (apenas para o autor)
- Ao fixar, seta `pinned_at = now()` no post
- Na query de posts do perfil, ordenar por `pinned_at DESC NULLS LAST, created_at DESC`
- Posts fixados exibem um icone de pin na miniatura do grid

---

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE public.posts ADD COLUMN pinned_at timestamptz DEFAULT NULL;
```

### Arquivos a editar

**`src/pages/Profile.tsx`**
- Substituir a renderizacao de `PostCard` em lista por um grid de 3 colunas
- Cada celula: imagem de capa ou icone de texto, com overlay de pin se fixado
- Ao clicar, abrir Dialog com o PostCard completo
- Ordenar posts com `pinned_at` primeiro
- Na query de posts, adicionar `.order("pinned_at", { ascending: false, nullsFirst: false })`

**`src/pages/UserProfile.tsx`**
- Mesma logica de grid de 3 colunas e dialog ao clicar
- Ordenar posts com pinned primeiro

**`src/components/profile/ProfileHeader.tsx`**
- Trocar botao "Editar perfil" por icone (`Pencil` ou `Settings`) no canto superior direito do header
- Nos destaques, buscar tambem clips do usuario (tabela `clips`) e exibir na mesma fila horizontal junto com os highlights

**`src/components/feed/PostCard.tsx`**
- Adicionar opcao "Fixar no perfil" / "Desafixar" no menu de 3 pontinhos (apenas para o autor)
- Ao fixar: `supabase.from("posts").update({ pinned_at: new Date().toISOString() }).eq("id", post.id)`
- Ao desafixar: `supabase.from("posts").update({ pinned_at: null }).eq("id", post.id)`
- Adicionar `pinned_at` na interface `PostData`
