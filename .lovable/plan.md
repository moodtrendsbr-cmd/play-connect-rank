
# Corrigir Paginas de Torneio (Manage, Brackets, Results)

## Problemas identificados

1. **Falta de tratamento de autenticacao**: As paginas de gerenciamento, chaves e resultados ficam presas em "Carregando..." se o usuario nao estiver logado ou nao for o organizador do torneio, porque as queries retornam vazio (bloqueadas por RLS) e nao ha fallback.

2. **Admin nao consegue acessar gerenciamento**: No painel admin, o botao de "olho" leva para `/tournaments/:id` (pagina de detalhes publica), mas nao ha link para a pagina de gerenciamento. Admin precisa de acesso ao manage/brackets/results.

3. **Sem redirecionamento para login**: Usuarios nao autenticados ficam presos no "Carregando..." sem saber o que fazer.

---

## Plano de correcao

### 1. ManageTournament.tsx
- Adicionar verificacao de autenticacao: se nao logado, redirecionar para login
- Se a query do torneio retornar null (RLS bloqueou), mostrar mensagem de "Torneio nao encontrado ou sem permissao" em vez de "Carregando..." infinito
- Adicionar timeout ou check de loading state

### 2. Brackets.tsx
- Mesma protecao de autenticacao
- Mesmo fallback para torneio nao encontrado
- Corrigir estado de loading para nao ficar infinito

### 3. Results.tsx
- Mesma protecao de autenticacao
- Mesmo fallback para torneio nao encontrado

### 4. AdminTournaments.tsx
- Adicionar botao/link para "Gerenciar" ao lado do botao de visualizar, levando o admin para `/tournaments/:id/manage`
- Isso permite ao admin acessar chaves e resultados pela pagina de gerenciamento

### 5. TournamentDetail.tsx
- Adicionar botao "Gerenciar" visivel apenas para o organizador do torneio (quando `user.id === tournament.organizer_id`)
- Isso facilita a navegacao para o organizador que acessa o detalhe pelo feed/lista publica

---

## Detalhes tecnicos

### Padrao de protecao a ser aplicado nas 3 paginas (Manage, Brackets, Results):

```text
1. Verificar se user existe (via useAuth)
2. Se loading do auth, mostrar spinner
3. Se nao logado, redirecionar para /login
4. Ao buscar torneio, tratar data === null como "sem permissao"
5. Exibir mensagem com botao de voltar em vez de "Carregando..." infinito
```

### AdminTournaments - novo botao:
- Adicionar icone Settings/Cog ao lado do Eye para linkar para `/tournaments/:id/manage`

### TournamentDetail - botao condicional:
- Se `user?.id === tournament.organizer_id`, exibir botao "Gerenciar torneio" linkando para manage
