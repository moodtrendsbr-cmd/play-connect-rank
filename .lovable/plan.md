
# Painel do Patrocinador - Plano de Implementacao

## Visao Geral

Criar 3 novas rotas para empresas patrocinadoras (`/sponsor/dashboard`, `/sponsor/tournaments`, `/sponsor/sponsorships/:id`) com layout proprio, tema Kling, e funcionalidade de brindes. Reaproveitar a logica existente de `MarketplaceTournaments` e `SponsorTournamentDialog`, expandindo com dashboard de metricas, detalhe de patrocinio e sistema de brindes.

---

## 1. Migracao de Banco de Dados

### Nova tabela `sponsorship_giveaways`
Armazena os brindes opcionais vinculados a um patrocinio:
- `id` uuid PK
- `sponsorship_id` uuid FK -> tournament_sponsorships
- `item_type` text (tipo do brinde)
- `quantity` integer
- `rules` text (ex: "para os 50 primeiros")
- `needs_refrigeration` boolean DEFAULT false
- `delivery_deadline` date
- `contact_name` text
- `contact_whatsapp` text
- `contact_email` text
- `pickup_address` text (endereco de retirada)
- `delivery_address` text (endereco de entrega)
- `notes` text (observacoes logisticas)
- `status` text DEFAULT 'pending' (pending, ready, delivered)
- `created_at`, `updated_at`

RLS:
- SELECT: owner da company do sponsorship OU admin
- INSERT: owner da company do sponsorship
- UPDATE: owner da company do sponsorship OU admin
- DELETE: admin

### Novas colunas em `tournament_sponsorships`
- `views_count` integer DEFAULT 0 (tracking de impressoes)
- `clicks_count` integer DEFAULT 0 (tracking de cliques)

---

## 2. Novas Paginas

### 2.1 `/sponsor/dashboard` - Dashboard do Patrocinador
- Busca a empresa do usuario logado
- Cards de metricas: plano atual, cidades ativas (distinct cities dos torneios patrocinados), total patrocinios, views e cliques agregados
- Secao "Acoes rapidas" com 4 botoes: Patrocinar torneio, Ver brindes, Ver patrocinios, Atualizar marca
- Lista dos patrocinios recentes com status

### 2.2 `/sponsor/tournaments` - Catalogo de Torneios
- Reutiliza a logica existente de `MarketplaceTournaments` mas com layout expandido
- Filtros: cidade, status (aberto/em andamento/finalizado)
- Cards com dados reais: nome, arena, cidade, datas, inscritos/vagas, modalidades
- Botao "Patrocinar" abre dialog com fluxo de 4 passos (pacote -> identidade -> brindes -> confirmacao)

### 2.3 `/sponsor/sponsorships/:id` - Detalhe do Patrocinio
- Dados do torneio e cidade
- Onde aparece (placements baseado no plano)
- Status do patrocinio
- Bloco de brindes com status logistico
- Metricas: views, cliques
- Botoes: Atualizar logo, Editar brindes, Falar com suporte

---

## 3. Componentes

### 3.1 `SponsorLayout` - Layout compartilhado das rotas /sponsor/*
- Header com logo Mood Play e nome da empresa
- Navegacao simples: Dashboard | Torneios | Meus Patrocinios
- Sem bottom nav (experiencia dedicada para empresa)

### 3.2 `SponsorTournamentDialog` (atualizar existente)
- Adicionar Passo 3: Toggle "Quero oferecer brindes" com campos de logistica
- Ao confirmar, insere tanto `tournament_sponsorships` quanto `sponsorship_giveaways` (se habilitado)

---

## 4. Rotas no App.tsx

Adicionar dentro de `Routes` (fora do AppLayout, layout proprio):
```text
/sponsor/dashboard -> SponsorDashboard
/sponsor/tournaments -> SponsorTournaments
/sponsor/sponsorships/:id -> SponsorshipDetail
```

---

## 5. Arquivos

### Novos:
- `src/pages/sponsor/SponsorLayout.tsx` - layout com nav do patrocinador
- `src/pages/sponsor/SponsorDashboard.tsx` - dashboard principal
- `src/pages/sponsor/SponsorTournaments.tsx` - catalogo de torneios
- `src/pages/sponsor/SponsorshipDetail.tsx` - detalhe de um patrocinio

### Modificados:
- `src/components/sponsorship/SponsorTournamentDialog.tsx` - adicionar passo de brindes
- `src/App.tsx` - novas rotas /sponsor/*
- Migracao SQL para tabela `sponsorship_giveaways` e colunas extras

---

## Detalhes Tecnicos

### Migracao SQL:

```text
sponsorship_giveaways
  id uuid PK DEFAULT gen_random_uuid()
  sponsorship_id uuid FK -> tournament_sponsorships NOT NULL
  item_type text NOT NULL
  quantity integer NOT NULL DEFAULT 1
  rules text
  needs_refrigeration boolean DEFAULT false
  delivery_deadline date
  contact_name text
  contact_whatsapp text
  contact_email text
  pickup_address text
  delivery_address text
  notes text
  status text DEFAULT 'pending'
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

ALTER TABLE tournament_sponsorships
  ADD COLUMN views_count integer DEFAULT 0,
  ADD COLUMN clicks_count integer DEFAULT 0;
```

### RLS para sponsorship_giveaways:
- Funcao helper `is_sponsorship_company_owner(sponsorship_id, user_id)` para verificar ownership
- SELECT/INSERT/UPDATE: owner da company vinculada ao sponsorship
- SELECT/UPDATE/DELETE: admin

### Fluxo de dados:

```text
Empresa -> /sponsor/dashboard (visao geral)
  -> /sponsor/tournaments (escolhe torneio)
    -> Dialog: pacote + logo + brindes (opcional)
      -> INSERT tournament_sponsorships + INSERT sponsorship_giveaways
  -> /sponsor/sponsorships/:id (acompanha metricas e status)
```

### Acesso:
- Todas as rotas /sponsor/* verificam se o usuario tem uma empresa aprovada
- Se nao tiver, redireciona para /marketplace/register
