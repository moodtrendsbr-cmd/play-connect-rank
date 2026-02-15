

# Sistema de Monetizacao SaaS -- Mood Play

## Resumo

Evoluir o marketplace existente para um modelo SaaS automatizado com planos configuraveis, cobranca recorrente, geracao automatica de ads e controle total via admin. Empresas escolhem apenas plano e cidade -- todo o resto e governado pela Mood Play.

---

## 1. Migracao SQL

### Nova tabela: company_plans

Tabela de planos editaveis pelo admin em tempo real.

- id (uuid PK)
- name (text, NOT NULL) -- free, pro, elite
- display_name (text, NOT NULL) -- "Free", "Pro", "Elite"
- monthly_price (numeric, default 0)
- sponsored_posts_per_month (integer, default 0)
- banner_feed_enabled (boolean, default false)
- tournament_visibility (boolean, default false)
- marketplace_highlight (boolean, default false)
- commission_rate (numeric, default 15)
- max_products (integer, nullable) -- null = ilimitado
- description (text)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

Seed inicial com 3 planos: Free (0, 15%, 5 produtos), Pro (199, 10%, ilimitado), Elite (499, 8%, ilimitado).

RLS: SELECT publico, INSERT/UPDATE/DELETE somente admin.

### Nova tabela: subscriptions

- id (uuid PK)
- company_id (uuid FK companies, UNIQUE)
- plan_id (uuid FK company_plans)
- status (text, default 'active') -- active, overdue, canceled
- started_at (timestamptz, default now())
- next_billing_at (timestamptz)
- canceled_at (timestamptz, nullable)
- created_at (timestamptz, default now())

RLS: SELECT owner da empresa + admin, INSERT/UPDATE admin.

### Nova tabela: financial_ledger

- id (uuid PK)
- source (text, NOT NULL) -- 'subscription', 'marketplace_order', 'sponsorship'
- source_id (uuid, nullable)
- company_id (uuid FK companies, nullable)
- amount (numeric, NOT NULL)
- mood_share (numeric, default 0)
- description (text)
- created_at (timestamptz, default now())

RLS: SELECT admin only.

### Alteracao na tabela companies

- Adicionar coluna plan_id (uuid FK company_plans, nullable)
- Adicionar coluna billing_status (text, default 'none') -- none, active, overdue, canceled

### Trigger

- Trigger em companies para updated_at (ja existe a funcao update_updated_at_column)

---

## 2. Edge Function: generate-sponsored-posts

**Arquivo**: `supabase/functions/generate-sponsored-posts/index.ts`

Logica:
1. Buscar empresas com subscription ativa e plano com sponsored_posts_per_month > 0
2. Contar posts ja gerados no mes atual para cada empresa
3. Se abaixo do limite, gerar sponsored_post com template:
   - Titulo: "{Empresa} -- Parceiro Mood Play em {cidade}"
   - Conteudo: "Confira as ofertas de {empresa} para atletas de {cidade}!"
   - city = empresa.city
   - active_from = now, active_to = fim do mes
   - active = false (aguardando aprovacao admin)
4. Registrar no financial_ledger

Config no config.toml: verify_jwt = false (sera chamado via cron ou manualmente pelo admin)

---

## 3. Pagina Admin: Monetizacao

**Rota**: `/admin/monetization`

**Arquivo**: `src/pages/admin/AdminMonetization.tsx`

### Secao Planos
- Cards editaveis para cada plano (Free, Pro, Elite)
- Campos inline: preco, posts/mes, comissao, max produtos, toggles (banner, torneio, destaque)
- Salvar em tempo real na tabela company_plans

### Secao Assinaturas
- Lista de empresas com plano ativo
- Status (active/overdue/canceled)
- Acoes: ativar plano, suspender, cancelar
- Botao "Gerar ads do mes" (chama edge function manualmente)

### Secao Extrato Financeiro
- Tabela financial_ledger com filtros por source e periodo
- Totais: receita assinaturas, receita marketplace, total Mood Play

---

## 4. Atualizacao: MyCompany (Painel da Empresa)

Adicionar secao "Meu Plano" no topo:
- Mostrar plano atual (Free/Pro/Elite) com descricao comercial
- Status billing (ativo/atrasado/cancelado)
- Se Free: botao "Upgrade" com descricao dos planos Pro e Elite
- Empresa NAO gerencia campanha -- apenas ve plano e status

---

## 5. Atualizacao: AdminCompanies

- Adicionar coluna "Plano" na listagem
- Select para alterar plan_id da empresa
- Campo billing_status visivel
- Ao alterar plano: criar/atualizar subscription, atualizar commission_rate da empresa conforme plano

---

## 6. Atualizacao: AdminAds

- Adicionar secao "Ads Automaticos" que lista sponsored_posts gerados automaticamente (active = false)
- Botao para aprovar (active = true) ou rejeitar (deletar)
- Badge visual para diferenciar ads manuais vs automaticos

---

## 7. Atualizacao: AdminFinances

- Adicionar secao "Receita Marketplace" com dados do financial_ledger
- Cards: Receita Assinaturas, Receita Marketplace, Total Mood

---

## 8. Atualizacao: AdminDashboard

- Card: "Assinaturas Ativas"
- Card: "Receita Assinaturas"
- Card: "Empresas Overdue"

---

## 9. Atualizacao: AdminLayout

- Adicionar item "Monetizacao" no grupo Marketplace da sidebar (icone CreditCard, rota /admin/monetization)

---

## 10. Navegacao (App.tsx)

- Adicionar rota `/admin/monetization` -> AdminMonetization

---

## Detalhes tecnicos

### Arquivos a criar
- `supabase/functions/generate-sponsored-posts/index.ts`
- `src/pages/admin/AdminMonetization.tsx`

### Arquivos a editar
- `src/App.tsx` (nova rota admin)
- `src/pages/admin/AdminLayout.tsx` (item sidebar)
- `src/pages/admin/AdminDashboard.tsx` (cards novos)
- `src/pages/admin/AdminCompanies.tsx` (coluna plano)
- `src/pages/admin/AdminAds.tsx` (secao ads automaticos)
- `src/pages/admin/AdminFinances.tsx` (secao receita marketplace)
- `src/pages/MyCompany.tsx` (secao plano)
- `supabase/config.toml` (nova function)
- Migracao SQL (tabelas + seed + alteracoes)

### Logica de billing
- Billing e controlado pelo admin manualmente nesta fase
- Admin ativa plano -> cria subscription com next_billing_at = now + 30 dias
- Edge function pode ser chamada pelo admin para gerar ads
- Cron pode ser configurado futuramente via pg_cron

### Regras de negocio
- Empresa ve apenas plano e status, zero autonomia em campanhas
- Ads sao gerados automaticamente conforme plano e aprovados pelo admin
- Se billing_status = overdue: ads pausados, marketplace mantido
- Admin pode alterar qualquer parametro de plano em tempo real
- financial_ledger registra todas as movimentacoes

