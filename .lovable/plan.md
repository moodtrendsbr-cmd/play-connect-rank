

# Modulo MARKETPLACE -- Shopping Esportivo com Gestao Admin

## Resumo

Criar um marketplace esportivo integrado a plataforma Mood Play, onde empresas cadastram produtos sujeitos a aprovacao admin. Todo controle de planos, comissoes, destaques e publicidade e centralizado no painel administrativo. Inclui posts patrocinados no feed, parceiros de torneio e patrocinio de atletas.

---

## 1. Migracao SQL

### Novas tabelas

**companies**
- id (uuid PK)
- owner_user_id (uuid, NOT NULL) -- usuario que cadastrou a empresa
- name (text, NOT NULL)
- city (text)
- state (text)
- email (text)
- phone (text)
- category (text) -- vestuario, acessorios, suplementos, fotografia, servicos, locacao
- description (text)
- logo_url (text, nullable)
- status (text, default 'pending_approval') -- pending_approval, approved, blocked
- plan (text, default 'free') -- free, pro, elite
- commission_rate (numeric, default 10)
- highlight_enabled (boolean, default false)
- feed_ads_enabled (boolean, default false)
- tournament_visibility (boolean, default false)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**products**
- id (uuid PK)
- company_id (uuid FK companies)
- name (text, NOT NULL)
- description (text)
- price (numeric, NOT NULL)
- image_urls (text[], default '{}')
- external_link (text, nullable)
- stock (integer, nullable)
- status (text, default 'pending') -- pending, approved, rejected
- featured (boolean, default false)
- created_at (timestamptz, default now())

**sponsored_posts**
- id (uuid PK)
- company_id (uuid FK companies)
- post_id (uuid FK posts, nullable) -- pode ter post vinculado ou nao
- title (text)
- content (text)
- image_url (text, nullable)
- city (text, nullable)
- active_from (timestamptz)
- active_to (timestamptz)
- active (boolean, default true)
- created_at (timestamptz, default now())

**tournament_partners**
- id (uuid PK)
- tournament_id (uuid FK tournaments)
- company_id (uuid FK companies)
- position_order (integer, default 0)
- created_at (timestamptz, default now())

**athlete_sponsors**
- id (uuid PK)
- athlete_user_id (uuid, NOT NULL)
- company_id (uuid FK companies)
- amount (numeric, default 0)
- start_date (date)
- end_date (date, nullable)
- created_at (timestamptz, default now())

**marketplace_orders**
- id (uuid PK)
- product_id (uuid FK products)
- buyer_user_id (uuid, NOT NULL)
- quantity (integer, default 1)
- total_amount (numeric, NOT NULL)
- mood_commission (numeric, default 0)
- company_amount (numeric, default 0)
- status (text, default 'pending') -- pending, confirmed, delivered, cancelled
- created_at (timestamptz, default now())

### Storage bucket
- Criar bucket publico `company-images` para logos e imagens de produtos

### RLS Policies

**companies**:
- SELECT: publico (status = 'approved') + admin ve todos + owner ve propria
- INSERT: usuarios autenticados (owner_user_id = auth.uid())
- UPDATE: admin ou owner (campos limitados)

**products**:
- SELECT: publico (status = 'approved' e company aprovada) + admin + owner da empresa
- INSERT: owner da empresa
- UPDATE/DELETE: admin ou owner da empresa

**sponsored_posts**:
- SELECT: publico (active = true e dentro das datas) + admin
- INSERT/UPDATE/DELETE: somente admin

**tournament_partners**:
- SELECT: publico
- INSERT/UPDATE/DELETE: somente admin

**athlete_sponsors**:
- SELECT: publico + atleta ve proprios
- INSERT/UPDATE/DELETE: somente admin

**marketplace_orders**:
- SELECT: comprador ve proprios + admin + owner da empresa do produto
- INSERT: usuarios autenticados (buyer_user_id = auth.uid())
- UPDATE: admin

---

## 2. Paginas do Marketplace (Usuario)

### 2a. Pagina principal do Marketplace

**Rota**: `/marketplace`

**Arquivo**: `src/pages/Marketplace.tsx`

- Barra de busca no topo
- Filtros por categoria (chips horizontais scrollaveis)
- Grid de cards de empresas aprovadas (logo, nome, cidade, categoria)
- Empresas locais primeiro (baseado na cidade do perfil do usuario)
- Ao clicar em empresa, abre pagina da empresa

### 2b. Pagina da Empresa

**Rota**: `/marketplace/company/:companyId`

**Arquivo**: `src/pages/MarketplaceCompany.tsx`

- Header com logo, nome, cidade, descricao
- Grid de produtos aprovados
- Card de produto: imagem, nome, preco, botao "Ver" ou "Comprar"

### 2c. Pagina do Produto

**Rota**: `/marketplace/product/:productId`

**Arquivo**: `src/pages/MarketplaceProduct.tsx`

- Imagens do produto (carousel)
- Nome, descricao, preco
- Botao "Comprar" (link externo ou criar pedido interno)
- Info da empresa

### 2d. Cadastro de Empresa

**Rota**: `/marketplace/register`

**Arquivo**: `src/pages/MarketplaceRegister.tsx`

- Formulario: nome, cidade, estado, email, telefone, categoria, descricao, logo
- Ao enviar: status = pending_approval
- Mensagem: "Sua empresa foi enviada para analise"

### 2e. Painel da Empresa (owner)

**Rota**: `/marketplace/my-company`

**Arquivo**: `src/pages/MyCompany.tsx`

- Ver status da empresa (pendente/aprovada/bloqueada)
- Listar produtos proprios
- Adicionar/editar produto (nome, descricao, preco, imagens, link externo, estoque)
- Produtos ficam em "pending" ate admin aprovar
- Ver pedidos recebidos

---

## 3. Navegacao

### Bottom Nav
- Substituir o icone "Ranking" (Medal) por "Marketplace" (ShoppingBag) no menu inferior
- Ranking ficara acessivel via outras rotas (perfil ou feed)

Alternativa (melhor UX): manter os 5 itens atuais e adicionar icone de marketplace no FeedTopBar ao lado do sino

**Decisao**: Adicionar icone de ShoppingBag no FeedTopBar (ao lado do sino e perfil), linkando para `/marketplace`

### Rotas (App.tsx)
Dentro do bloco `<Route element={<AppLayout />}>`:

```text
/marketplace                        -> Marketplace
/marketplace/register               -> MarketplaceRegister
/marketplace/my-company             -> MyCompany
/marketplace/company/:companyId     -> MarketplaceCompany
/marketplace/product/:productId     -> MarketplaceProduct
```

---

## 4. Admin Panel -- Marketplace

### 4a. Sidebar do Admin
Adicionar novo grupo "Marketplace" na sidebar com itens:
- Empresas (`/admin/companies`)
- Produtos (`/admin/products`)
- Publicidade (`/admin/ads`)
- Patrocinios (`/admin/sponsors`)

### 4b. Admin Empresas

**Rota**: `/admin/companies`

**Arquivo**: `src/pages/admin/AdminCompanies.tsx`

- Tabela com todas as empresas
- Filtros: status (pending/approved/blocked), categoria
- Acoes por empresa:
  - Aprovar / Rejeitar / Bloquear
  - Alterar plano (free/pro/elite)
  - Definir commission_rate
  - Toggle highlight_enabled
  - Toggle feed_ads_enabled
  - Toggle tournament_visibility

### 4c. Admin Produtos

**Rota**: `/admin/products`

**Arquivo**: `src/pages/admin/AdminProducts.tsx`

- Tabela com todos os produtos pendentes e aprovados
- Filtros: status, empresa
- Acoes: Aprovar / Rejeitar / Remover / Marcar destaque

### 4d. Admin Publicidade

**Rota**: `/admin/ads`

**Arquivo**: `src/pages/admin/AdminAds.tsx`

- Criar/editar sponsored posts (titulo, conteudo, imagem, cidade, datas, empresa vinculada)
- Associar empresa a torneio (tournament_partners)
- Ver lista de banners/posts ativos

### 4e. Admin Patrocinios

**Rota**: `/admin/sponsors`

**Arquivo**: `src/pages/admin/AdminSponsors.tsx`

- Associar empresa a atleta (athlete_sponsors)
- Associar empresa a torneio
- Definir valor patrocinado
- Ver historico

---

## 5. Publicidade Contextual

### 5a. Sponsored Posts no Feed
- No componente Feed.tsx, buscar `sponsored_posts` ativos (dentro das datas, city match ou sem city)
- Inserir entre posts regulares (a cada ~5 posts) como um card especial com badge "Patrocinado"
- Criar componente `SponsoredPostCard.tsx`

### 5b. Parceiros do Torneio
- Na pagina TournamentDetail.tsx, buscar `tournament_partners` do torneio
- Exibir bloco "Parceiros" com logos e nomes das empresas

---

## 6. Dashboard Admin atualizado

No AdminDashboard.tsx, adicionar cards:
- Total Empresas (aprovadas/pendentes)
- Total Produtos
- Pedidos do Marketplace
- Receita Marketplace (comissoes)

---

## Arquivos a criar
- `src/pages/Marketplace.tsx`
- `src/pages/MarketplaceCompany.tsx`
- `src/pages/MarketplaceProduct.tsx`
- `src/pages/MarketplaceRegister.tsx`
- `src/pages/MyCompany.tsx`
- `src/pages/admin/AdminCompanies.tsx`
- `src/pages/admin/AdminProducts.tsx`
- `src/pages/admin/AdminAds.tsx`
- `src/pages/admin/AdminSponsors.tsx`
- `src/components/feed/SponsoredPostCard.tsx`

## Arquivos a editar
- `src/App.tsx` (novas rotas)
- `src/components/feed/FeedTopBar.tsx` (icone marketplace)
- `src/pages/admin/AdminLayout.tsx` (novos itens sidebar)
- `src/pages/admin/AdminDashboard.tsx` (cards marketplace)
- `src/pages/Feed.tsx` (inserir sponsored posts)
- `src/pages/TournamentDetail.tsx` (bloco parceiros)
- Migracao SQL (1 migracao com todas as tabelas)

## Regras de negocio
- Empresa so aparece no marketplace apos aprovacao admin
- Produto so aparece apos aprovacao admin
- Planos, comissoes e destaques sao controlados exclusivamente pelo admin
- Empresa bloqueada nao aparece em lugar nenhum
- Sponsored posts so podem ser criados pelo admin
- Patrocinios de atletas e torneios so via admin

