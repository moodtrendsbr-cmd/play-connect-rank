
# Modulo "Patrocinar Torneio" - Plano de Implementacao

## Visao Geral

Criar um sistema completo de patrocinio de torneios onde empresas aprovadas podem escolher torneios, selecionar um pacote (definido pelo admin), enviar logo e pagar para ter visibilidade automatica em multiplos pontos do app.

---

## 1. Migracao de Banco de Dados

### Tabela `tournament_sponsor_plans`
Pacotes de patrocinio definidos pelo admin:
- `id`, `name`, `display_name`, `price` (numeric)
- `max_tournaments` (integer)
- `feed_visibility` (boolean)
- `signup_visibility` (boolean) -- aparece na tela de inscricao/pagamento
- `tournament_visibility` (boolean) -- aparece na pagina do torneio
- `physical_banner_allowed` (boolean)
- `description` (text)
- `active` (boolean, default true)
- `created_at`, `updated_at`

RLS: leitura publica, CRUD restrito a admin.

### Tabela `tournament_sponsorships`
Registro de cada patrocinio contratado:
- `id`, `tournament_id` (FK tournaments), `company_id` (FK companies), `plan_id` (FK tournament_sponsor_plans)
- `logo_url` (text), `link` (text), `message` (text, opcional)
- `status` (text: pending, active, paused, expired)
- `payment_id` (text)
- `created_at`, `updated_at`

RLS:
- SELECT publico (para exibir logos)
- INSERT por owner da company
- UPDATE por owner da company OU admin
- Admin SELECT/UPDATE/DELETE completo

### Seed de pacotes default
Inserir 3 pacotes: Basic (R$99), Pro (R$249), Elite (R$499) com visibilidades progressivas.

---

## 2. Paginas Frontend

### 2.1 `/marketplace/tournaments` - Vitrine de Torneios para Empresas
- Listagem de torneios futuros/ativos com filtros (cidade, modalidade)
- Cards com: nome, arena, cidade, datas, valor inscricao, atletas inscritos/vagas
- Botao "Patrocinar este torneio" em cada card
- Acessivel via menu do Marketplace (somente para donos de empresa)

### 2.2 Dialog/Modal de Patrocinio
- Selecao de pacote (cards com nome, preco e lista de beneficios)
- Upload de logo (bucket `company-images`)
- Campo de link da empresa e mensagem opcional
- Botao confirmar -> cria registro com status `pending`
- Integracao futura com pagamento (por ora, admin aprova manualmente)

### 2.3 `/admin/sponsorships` - Painel Admin de Patrocinios de Torneio
- Gerenciar pacotes (CRUD em `tournament_sponsor_plans`)
- Listar todos os patrocinios (`tournament_sponsorships`) com filtros
- Acoes: aprovar (status -> active), pausar, bloquear
- Ao aprovar: sistema insere automaticamente em `tournament_partners` e gera `sponsored_post` se o plano permitir feed_visibility
- Metricas basicas (total patrocinios, receita, por torneio)

---

## 3. Automacao Pos-Ativacao

Quando admin muda status para `active`:
1. Insere registro em `tournament_partners` (logo aparece na pagina do torneio)
2. Se `feed_visibility = true`, cria `sponsored_post` com template: "Parceiro oficial de {torneio} em {cidade}"
3. A pagina de pagamento (`Payment.tsx`) e `TournamentDetail.tsx` ja exibem parceiros -- basta ter o dado em `tournament_partners`

### Exibicao na tela de inscricao/pagamento
- Adicionar bloco "Parceiros Oficiais" em `Payment.tsx` quando houver patrocinios com `signup_visibility = true`

---

## 4. Navegacao e Rotas

- Adicionar rota `/marketplace/tournaments` no `App.tsx` dentro do `AppLayout`
- Adicionar link na sidebar do Admin: "Patrocinios Torneio" em `/admin/sponsorships`
- Rota admin `/admin/sponsorships` no `AdminLayout`

---

## 5. Arquivos a Criar/Modificar

### Novos:
- `src/pages/MarketplaceTournaments.tsx` -- vitrine de torneios para empresas
- `src/components/sponsorship/SponsorTournamentDialog.tsx` -- modal de contratacao
- `src/pages/admin/AdminSponsorships.tsx` -- painel admin

### Modificados:
- `src/App.tsx` -- novas rotas
- `src/pages/admin/AdminLayout.tsx` -- novo item na sidebar
- `src/pages/TournamentDetail.tsx` -- badge "Parceiro Oficial" nos logos
- `src/pages/Payment.tsx` -- bloco "Parceiros Oficiais" para patrocinios com signup_visibility
- Migracao SQL para as 2 novas tabelas + seed de pacotes

---

## Detalhes Tecnicos

### Migracao SQL resumida:

```text
tournament_sponsor_plans
  id uuid PK
  name text NOT NULL
  display_name text NOT NULL
  price numeric NOT NULL DEFAULT 0
  max_tournaments int DEFAULT 1
  feed_visibility bool DEFAULT false
  signup_visibility bool DEFAULT false
  tournament_visibility bool DEFAULT true
  physical_banner_allowed bool DEFAULT false
  description text
  active bool DEFAULT true
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

tournament_sponsorships
  id uuid PK
  tournament_id uuid FK -> tournaments
  company_id uuid FK -> companies
  plan_id uuid FK -> tournament_sponsor_plans
  logo_url text
  link text
  message text
  status text DEFAULT 'pending'
  payment_id text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
```

### Fluxo de dados:

```text
Empresa -> Escolhe torneio -> Seleciona pacote -> Upload logo -> Confirma
  -> INSERT tournament_sponsorships (status=pending)
  -> Admin aprova (status=active)
    -> INSERT tournament_partners (automatico)
    -> INSERT sponsored_posts (se feed_visibility=true)
```

### RLS Policies:
- `tournament_sponsor_plans`: SELECT publico, INSERT/UPDATE/DELETE admin
- `tournament_sponsorships`: SELECT publico, INSERT owner da company, UPDATE owner+admin, DELETE admin
