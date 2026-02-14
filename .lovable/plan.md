

# Painel de Administracao - Mood Play

## Resumo

Criar um painel administrativo completo acessivel apenas por usuarios com role "admin". O painel permite gerenciamento total da plataforma: usuarios, organizadores, torneios, inscricoes, pagamentos, saldos e metricas.

## Mudancas no banco de dados

### 1. Adicionar role "admin" ao enum `app_role`

O enum atual tem apenas `organizer` e `athlete`. Sera adicionado o valor `admin`.

### 2. RLS e seguranca

- Criar funcao auxiliar `is_admin()` usando `has_role` existente para simplificar policies
- Adicionar policies de SELECT em todas as tabelas para admins (para que o admin consiga ler todos os dados)
- Policies necessarias:
  - `profiles`: admin pode ver e atualizar todos
  - `enrollments`: admin pode ver e atualizar todos
  - `tournaments`: admin pode ver, atualizar e deletar todos
  - `organizer_balances`: admin pode ver e atualizar todos
  - `withdrawal_requests`: admin pode ver e atualizar todos (aprovar/rejeitar saques)
  - `user_roles`: admin pode ver todos e inserir/atualizar

### 3. Atribuir role admin

Sera necessario inserir manualmente o role admin para o primeiro usuario (via SQL). Futuramente, admins podem promover outros usuarios pelo painel.

## Estrutura do Frontend

### Novas paginas e componentes

```text
src/pages/admin/
  AdminDashboard.tsx    -- Metricas gerais e visao geral
  AdminUsers.tsx        -- Lista de usuarios/organizadores
  AdminTournaments.tsx  -- Todos os torneios
  AdminEnrollments.tsx  -- Inscricoes por torneio
  AdminFinances.tsx     -- Saldos, pagamentos, saques
  AdminLayout.tsx       -- Layout com sidebar de navegacao
```

### AdminLayout (Layout compartilhado)

- Sidebar com navegacao entre as secoes do painel
- Header com titulo e botao de voltar
- Verificacao de role admin no carregamento (redireciona se nao for admin)
- Links: Dashboard, Usuarios, Torneios, Inscricoes, Financeiro

### AdminDashboard - Metricas gerais

Cards com:
- Total de usuarios na plataforma
- Total de organizadores
- Total de torneios (ativos/finalizados)
- Total de inscricoes (pagas/pendentes)
- Receita total da plataforma (comissoes Mood)
- Saques pendentes

### AdminUsers - Gerenciamento de usuarios

- Tabela com todos os profiles + roles
- Filtro por role (admin/organizer/athlete)
- Busca por nome ou email
- Acoes: ver detalhes, alterar role, ver torneios do organizador
- Indicador de conta MP vinculada (para organizadores)

### AdminTournaments - Gerenciamento de torneios

- Tabela com todos os torneios
- Filtros: status (ativo/encerrado), cidade, organizador
- Informacoes: nome, organizador, datas, vagas, inscritos, receita
- Acoes: ver detalhes, ver inscricoes, editar, deletar

### AdminEnrollments - Inscricoes

- Selecionar torneio para ver inscricoes
- Tabela: atleta, status, data, pagamento
- Acoes: confirmar pagamento manual, cancelar inscricao

### AdminFinances - Financeiro

- Visao geral de receitas e comissoes
- Lista de saldos pendentes por organizador
- Lista de solicitacoes de saque com acoes (aprovar/rejeitar)
- Historico de pagamentos

## Mudancas em arquivos existentes

### App.tsx
- Adicionar rotas `/admin`, `/admin/users`, `/admin/tournaments`, `/admin/enrollments`, `/admin/finances`

### AuthContext.tsx
- Nenhuma mudanca necessaria (ja carrega `userRole` do `user_roles`)

### Dashboard.tsx
- Adicionar link para painel admin (visivel apenas se role === "admin")

## Detalhes tecnicos

### Protecao de rotas

O `AdminLayout` verifica se o usuario logado tem role "admin" via `useAuth()`. Se nao tiver, redireciona para `/dashboard`. Todas as paginas admin sao filhas desse layout.

### Queries do admin

As queries usam o client Supabase normal, mas as RLS policies com `has_role(auth.uid(), 'admin')` permitem que o admin acesse todos os registros de todas as tabelas.

### Gerenciamento de saques

O admin pode atualizar o status de `withdrawal_requests` para "approved" ou "rejected" diretamente pela tabela, e marcar `organizer_balances` como "withdrawn" quando o pagamento manual for feito.

### Sequencia de implementacao

1. Migracao SQL (adicionar "admin" ao enum, criar policies)
2. Criar `AdminLayout.tsx` com sidebar e protecao de rota
3. Criar `AdminDashboard.tsx` com metricas
4. Criar `AdminUsers.tsx` com tabela e acoes
5. Criar `AdminTournaments.tsx` com tabela e filtros
6. Criar `AdminEnrollments.tsx` com lista por torneio
7. Criar `AdminFinances.tsx` com saldos e saques
8. Atualizar `App.tsx` com as novas rotas
9. Adicionar link no `Dashboard.tsx` para admins

