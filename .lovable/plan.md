
# Adicionar botao "Voltar" em todas as paginas de torneios

## Problema
Varias paginas nao possuem botao de voltar visivel, deixando o usuario "preso" sem opcao de navegacao alem do logo.

## Paginas e alteracoes

### 1. `src/pages/Tournaments.tsx`
- Adicionar um header com logo e botao "Voltar" para `/dashboard` ou `/feed`
- Atualmente a pagina nao tem header nenhum

### 2. `src/pages/TournamentDetail.tsx`
- Adicionar botao "Voltar" ao lado do logo no header, apontando para `/tournaments`

### 3. `src/pages/Brackets.tsx`
- Adicionar botao "Voltar" no header, apontando para `/tournaments/{id}/manage`

### 4. `src/pages/Results.tsx`
- Adicionar botao "Voltar" no header, apontando para `/tournaments/{id}/manage`

### 5. `src/pages/ManageTournament.tsx`
- Adicionar botao "Voltar" no header, apontando para `/dashboard`

### 6. `src/pages/CreateTournament.tsx`
- Adicionar botao "Voltar" no header, apontando para `/dashboard`

## Padrao visual
Todas as paginas receberao um botao com icone de seta (ArrowLeft do lucide-react) ao lado do logo no header, seguindo o padrao consistente:

```text
[<- Voltar]   MOOD PLAY
```

## Detalhes tecnicos
- Importar `ArrowLeft` do lucide-react em cada pagina
- Adicionar `<Button variant="ghost" size="sm">` com `<Link>` dentro do header existente
- Para paginas que nao tem header (Tournaments.tsx), criar o header padrao com border-b
