
# Adicionar acesso a Chaveamento e Resultados no painel admin

## Problema
O painel admin mostra a lista de torneios com botoes de "Ver" e "Gerenciar", mas nao tem acesso direto ao chaveamento e resultados. O usuario precisa navegar por varias paginas para chegar la.

## Solucao

### `src/pages/admin/AdminTournaments.tsx`
Adicionar dois novos botoes de acao na coluna "Acoes" de cada torneio:
- Botao de **Chaveamento** (icone `GitBranch` ou `Network`) linkando para `/tournaments/{id}/brackets`
- Botao de **Resultados** (icone `Trophy` ou `ClipboardList`) linkando para `/tournaments/{id}/results`

A coluna de acoes passara de 3 para 5 botoes:
1. Ver torneio (Eye) - ja existe
2. Gerenciar (Settings) - ja existe
3. **Chaveamento (GitBranch)** - novo
4. **Resultados (Trophy)** - novo
5. Excluir (Trash2) - ja existe

### Detalhes tecnicos

No arquivo `src/pages/admin/AdminTournaments.tsx`:
- Importar `GitBranch` e `Trophy` do lucide-react (linha 10)
- Adicionar 2 botoes na div de acoes (entre o botao Settings e o Trash2, linhas 96-98):

```text
// Novo botao Chaveamento
<Button variant="ghost" size="icon" asChild title="Chaveamento">
  <Link to={`/tournaments/${t.id}/brackets`}><GitBranch className="h-4 w-4" /></Link>
</Button>

// Novo botao Resultados
<Button variant="ghost" size="icon" asChild title="Resultados">
  <Link to={`/tournaments/${t.id}/results`}><Trophy className="h-4 w-4" /></Link>
</Button>
```

Isso permite ao admin acessar chaveamento e resultados diretamente da tabela, sem precisar navegar pela pagina de gerenciamento primeiro.
