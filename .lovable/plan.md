
# Modulo de Arenas - Mood Play

## Resumo
Implementar o sistema completo de arenas com multi-quadras, reservas com pagamento, painel de gestao, pagina publica e integracao com patrocinadores. O modulo segue os mesmos padroes visuais e arquiteturais ja existentes no projeto (SponsorLayout, Marketplace, etc.).

## Fase 1 - Banco de Dados (Migracao SQL)

Criar 7 tabelas principais com RLS:

**arenas** - Dados da arena (vinculada ao user_id do dono via user_roles com role='arena')
- id, owner_user_id, name, slug (unique), city, state, address, zip_code, description, rules, cover_image_url, contact_email, contact_whatsapp, mp_connected (boolean default false), mp_collector_id (text nullable), is_active (boolean default true), created_at

**courts** - Quadras de cada arena
- id, arena_id (FK arenas), name, is_active (default true), price_per_hour (numeric nullable), modalities (text[] default '{}'), created_at

**court_availability** - Horarios de funcionamento por dia da semana
- id, court_id (FK courts), weekday (int 0-6), start_time (time), end_time (time), slot_duration_minutes (int default 60), created_at

**court_blocks** - Bloqueios pontuais (manutencao, feriados)
- id, court_id (FK courts), block_date (date), start_time (time nullable), end_time (time nullable), reason (text), created_at

**bookings** - Reservas
- id, arena_id (FK arenas), court_id (FK courts), user_id (uuid, ref auth.users), booking_date (date), start_time (time), end_time (time), amount (numeric), status (text default 'pending_payment': pending_payment, confirmed, canceled, completed), payment_provider (text nullable), payment_ref (text nullable), customer_name (text), customer_email (text), customer_whatsapp (text), created_at

**arena_links** - Links externos da arena
- id, arena_id (FK arenas), title, url, icon_type (text: video, instagram, maps, site, other), is_active (default true), position_order (int default 0), created_at

**arena_partners** - Patrocinadores/apoiadores da arena
- id, arena_id (FK arenas), company_id (uuid nullable FK companies), name, logo_url (text nullable), link_url (text nullable), tier (text default 'basic': basic, pro, elite), physical_space_included (boolean default false), position_order (int default 0), is_active (default true), created_at

**arena_physical_inventory** - Espacos fisicos para venda
- id, arena_id (FK arenas), space_type (text: mural, banner, placa, backdrop), description (text nullable), price_monthly (numeric nullable), is_available (boolean default true), created_at

**Politicas RLS:**
- arenas: publico pode ler arenas ativas; owner pode CRUD na propria arena; admin pode tudo
- courts: publico pode ler quadras de arenas ativas; owner da arena pode CRUD
- court_availability/court_blocks: publico pode ler; owner da arena pode CRUD
- bookings: usuario pode ver/criar as proprias; owner da arena pode ver/atualizar todas da arena; admin pode tudo
- arena_links/arena_partners/arena_physical_inventory: publico pode ler ativos; owner pode CRUD; admin pode tudo

**Funcoes auxiliares:**
- `is_arena_owner(arena_id uuid, user_id uuid)` - security definer para verificar dono da arena

**Storage bucket:**
- `arena-images` (publico) para capa e logos de parceiros

**Registro na tabela arenas:**
- Ao cadastrar como role='arena', tambem criar registro na tabela `arenas` com os dados iniciais (nome, cidade, estado, endereco)

## Fase 2 - Rotas e Navegacao

Adicionar no App.tsx:

```
/arenas                           -> ArenasList (dentro do AppLayout)
/arenas/:arenaSlug                -> ArenaPublic (dentro do AppLayout)
/arenas/:arenaSlug/reservar       -> ArenaBooking (dentro do AppLayout)
/arena/dashboard                  -> ArenaLayout > ArenaDashboard
/arena/dashboard/quadras          -> ArenaLayout > ArenaCourts
/arena/dashboard/horarios         -> ArenaLayout > ArenaSchedule
/arena/dashboard/reservas         -> ArenaLayout > ArenaBookings
/arena/dashboard/patrocinios      -> ArenaLayout > ArenaSponsors
/admin/arenas                     -> AdminArenas (dentro do AdminLayout)
```

Adicionar "Arenas" na barra de navegacao inferior (FeedBottomNav) e no admin sidebar.

## Fase 3 - Paginas Publicas

### 3.1 Listagem de Arenas (/arenas)
- Cards com: foto, nome, cidade, qtd quadras, preco a partir de, CTA "Ver Arena"
- Filtros: cidade, modalidade, disponivel hoje
- Busca por nome

### 3.2 Pagina Publica da Arena (/arenas/:arenaSlug)
- Hero com capa, nome, endereco, qtd quadras, botao "Reservar quadra"
- Secoes: Sobre/Infraestrutura, Regras, Links externos (cards com icones), Patrocinadores (grid com logos), Espacos fisicos disponiveis

### 3.3 Fluxo de Reserva (/arenas/:arenaSlug/reservar)
- Passo 1: Escolher quadra, data, horario, duracao
- Passo 2: Resumo (arena + quadra + data/hora + valor)
- Passo 3: Checkout transparente Mercado Pago (nome, email, whatsapp, pagamento)
- Regras: slot so garantido apos pagamento; validacao de overbooking no backend

## Fase 4 - Painel da Arena

### 4.1 ArenaLayout
- Seguir o padrao do SponsorLayout: header com nome da arena, nav com abas (Dashboard, Quadras, Horarios, Reservas, Patrocinios)
- Verificar se usuario tem role='arena' e se possui registro na tabela arenas

### 4.2 ArenaDashboard (/arena/dashboard)
- Cards: reservas de hoje, reservas da semana, receita total, saldo disponivel
- Proximas reservas (lista)
- Atalhos rapidos para sub-paginas

### 4.3 ArenaCourts (/arena/dashboard/quadras)
- Lista de quadras com nome, status, preco/hora
- Acoes: adicionar, editar, ativar/desativar

### 4.4 ArenaSchedule (/arena/dashboard/horarios)
- Para cada quadra: horario de funcionamento por dia da semana
- Duracoes permitidas
- Bloqueios (data + motivo)

### 4.5 ArenaBookings (/arena/dashboard/reservas)
- Lista com quadra, data/horario, cliente (nome/whatsapp), status
- Acoes: cancelar, marcar concluida

### 4.6 ArenaSponsors (/arena/dashboard/patrocinios)
- Patrocinadores ativos
- Espacos fisicos (mural/banner/placa) - status disponivel/vendido
- Gerenciar parceiros

## Fase 5 - Edge Function de Pagamento

### create-booking-payment
- Recebe: booking_id, dados do pagador, metodo de pagamento
- Verifica se slot ainda esta disponivel (anti-overbooking)
- Cria pagamento no Mercado Pago
- Se arena tem mp_collector_id: split automatico (arena recebe - comissao Mood)
- Se nao: pagamento integral para Mood, gera saldo na arena para saque posterior
- Atualiza status da reserva

### booking-webhook (Mercado Pago callback)
- Confirma reserva apos pagamento aprovado
- Bloqueia slot no calendario

## Fase 6 - Admin (/admin/arenas)

- Lista de arenas com status, cidade, qtd quadras
- Acoes: aprovar/suspender arena
- Visualizar reservas e financeiro por arena

## Fase 7 - Integracao no Cadastro

Atualizar o Register.tsx para que ao cadastrar como "Arena":
- Criar conta no auth
- Inserir role='arena' no user_roles
- Criar registro na tabela `arenas` com nome, slug (gerado a partir do nome), cidade, estado, endereco, zip_code, contact_whatsapp
- Redirecionar para /arena/dashboard apos cadastro

## Arquivos a Criar

```
src/pages/arenas/ArenasList.tsx
src/pages/arenas/ArenaPublic.tsx
src/pages/arenas/ArenaBooking.tsx
src/pages/arena-dashboard/ArenaLayout.tsx
src/pages/arena-dashboard/ArenaDashboard.tsx
src/pages/arena-dashboard/ArenaCourts.tsx
src/pages/arena-dashboard/ArenaSchedule.tsx
src/pages/arena-dashboard/ArenaBookings.tsx
src/pages/arena-dashboard/ArenaSponsors.tsx
src/pages/admin/AdminArenas.tsx
supabase/functions/create-booking-payment/index.ts
supabase/functions/booking-webhook/index.ts
```

## Arquivos a Modificar

```
src/App.tsx                        - Novas rotas
src/pages/Register.tsx             - Criar arena no cadastro
src/components/feed/FeedBottomNav.tsx - Adicionar aba "Arenas"
src/pages/admin/AdminLayout.tsx    - Adicionar "Arenas" no sidebar
src/components/feed/ProfileSwitcher.tsx - Link para painel arena
supabase/config.toml               - Config das novas edge functions
```

## Ordem de Implementacao

1. Migracao SQL (tabelas + RLS + funcoes + bucket)
2. Atualizar Register.tsx (criar arena no cadastro)
3. ArenaLayout + ArenaDashboard
4. ArenaCourts + ArenaSchedule
5. ArenaBookings
6. ArenasList (listagem publica)
7. ArenaPublic (pagina da arena)
8. ArenaBooking (fluxo de reserva)
9. Edge functions de pagamento
10. ArenaSponsors
11. AdminArenas
12. Atualizacao da navegacao (FeedBottomNav, ProfileSwitcher, AdminLayout)
13. Rotas no App.tsx
