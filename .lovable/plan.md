
# Corrigir paginas de torneios - Analise completa

## Problemas encontrados

### 1. Bug no Brackets.tsx - dependencia do useEffect
O `useEffect` no Brackets.tsx tem `[id]` como dependencia, mas o codigo verifica `if (id && user)` antes de executar. Quando o componente monta, o `user` ainda pode ser `null` (auth carregando). Quando o `user` finalmente carrega, o efeito nao re-executa porque `user` nao esta no array de dependencias. Isso causa o "Carregando..." infinito.

### 2. URLs literais
As capturas de tela mostram URLs como `/tournaments/:id/manage` (literal `:id`). Isso ocorre quando o usuario digita a rota diretamente no navegador em vez de navegar pela aplicacao. A validacao de UUID ja trata esse caso corretamente mostrando "Torneio nao encontrado".

## Correcoes

### `src/pages/Brackets.tsx`
- Adicionar `user` ao array de dependencias do `useEffect` (linha 85): mudar `[id]` para `[id, user]`
- Isso garante que quando a autenticacao terminar de carregar, o efeito re-execute e busque os dados do torneio

### Verificacao das outras paginas
- `Results.tsx` (linha 58): ja tem `[id, user]` - correto
- `ManageTournament.tsx` (linha 61): ja tem `[id, user]` - correto
- `TournamentDetail.tsx`: verificar e corrigir se necessario

## Detalhes tecnicos

A correcao e de uma unica linha:

```text
// Antes (Brackets.tsx, linha 85)
}, [id]);

// Depois
}, [id, user]);
```

Isso resolve o problema de carregamento infinito na pagina de chaveamentos. As outras paginas (Results e Manage) ja possuem a dependencia correta e funcionam quando acessadas com um ID valido de torneio atraves dos links do app (Dashboard ou pagina do torneio).
