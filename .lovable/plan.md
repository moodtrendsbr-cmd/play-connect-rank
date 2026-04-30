
# Expansão do Perfil Arena — 4 Áreas Essenciais

Objetivo: dar à Arena tudo que um dono/gerente precisa para operar de verdade — perfil público, QR físico, lojinha/bar e equipe — reaproveitando o que já existe, sem expor IA, sem duplicar marketplace, sem complicar.

## Reaproveitamento (importante)

Antes de criar qualquer coisa, vou usar o que já existe:

| Necessidade | Reusa | Cria |
|---|---|---|
| Dados da arena | `arenas` (nome, slug, descrição, endereço, cidade, contatos, capa) + `arena_links` (sociais) | adicionar campos opcionais: `logo_url`, `modalities text[]`, `opening_hours jsonb`, `is_public bool` |
| Perfil público | rota `/arenas/:slug` já existe (`ArenaPublic.tsx`) | só adicionar botão "Voltar ao painel" quando logado como dono |
| QR físico | `wa_qr_tokens` (intent, payload, arena_id, expires_at) | adicionar `label text`, `kind text`, `is_active bool`, `scans_count int` |
| Produtos/lojinha/bar | `products` (já tem `service_arena_id`, `kind`, status, featured) + `marketplace_orders` | nada novo — só filtrar por `service_arena_id = arena.id` |
| Equipe | `arena_instructors` (professores) + nova `arena_staff` mínima | tabela `arena_staff` simples (nome, função, contato, status, permissões básicas em jsonb) |

Nada de marketplace paralelo. Nada de PDV/ERP. Nada de permissões técnicas expostas.

---

## 1) Perfil da Arena — `/arena/dashboard/perfil`

Página dentro do shell da Arena para editar dados e controlar visibilidade pública.

Campos editáveis:
- nome, logo, banner (cover), descrição
- endereço, cidade, estado, CEP (ViaCEP no preenchimento)
- telefone / WhatsApp conectado (read-only com badge — vem do gate WA)
- modalidades (multi-select: Beach Tennis, Futevôlei, Vôlei de Praia, Tênis, Padel, Outros)
- horários de funcionamento (seg–dom, abre/fecha)
- links sociais (Instagram, site, mapa, vídeo) — usa `arena_links`
- status público / privado

Ações:
- "Salvar"
- "Ver perfil público" → `/arenas/:slug` (abre em nova aba)
- "Voltar ao painel" → `/arena/dashboard`

Na página pública `/arenas/:slug`, quando o usuário logado é dono da arena, mostrar botão discreto "Voltar ao painel".

## 2) QR Physical OS — `/arena/dashboard/qr`

Lista + criação de QRs físicos para recepção, quadras, mesas, banners.

Tipos (chip selector, sem jargão):
- QR da arena (abre WhatsApp)
- QR de check-in
- QR de reserva de quadra
- QR de torneio
- QR de aula
- QR de produto / bar
- QR de promoção

Cada item da lista mostra: nome, tipo, status ativo/inativo, criado em, scans (se houver), e ações: **Imprimir** (folha A4 com QR grande + nome da arena), **Baixar PNG**, **Compartilhar**, **Desativar**.

Empty state claro: "Crie seu primeiro QR físico. Cole na recepção, mesas, quadras ou eventos. O cliente escaneia e continua pelo WhatsApp."

Geração: gera no client com `qrcode` (lib leve) apontando para `https://wa.me/<numero>?text=<token>` ou link curto da arena. Token salvo em `wa_qr_tokens` com `intent`, `arena_id`, `payload`. Nada de mostrar token cru ao usuário.

## 3) Produtos / Lojinha / Bar — `/arena/dashboard/produtos`

Lista produtos com `service_arena_id = arena.id` na tabela `products` existente.

Categorias (campo já existente `kind` + nova coluna leve `category text`):
- Bebidas, Comidas, Acessórios, Aluguel/Serviço, Esportivos, Outros

Form de produto (drawer):
- nome, descrição, preço, foto, categoria
- estoque (opcional)
- ativo / inativo, destaque (usa `featured` existente)

Por produto:
- "Gerar link de compra" → cria `wa_qr_tokens` com intent `product_buy`
- "Gerar QR do produto" → mesmo token, exibido como QR imprimível
- "Compartilhar no WhatsApp"

Pedidos: aproveita `marketplace_orders` já existente; mostra os últimos 10 pedidos vinculados aos produtos da arena, sem reabrir o checkout do marketplace.

UX copy: "Venda produtos da recepção, bar e loja da arena. Gere QR do produto para mesas e balcão."

## 4) Funcionários / Equipe — `/arena/dashboard/equipe`

Lista da equipe + convite simples.

Tabela nova `arena_staff` (mínima):
- `id`, `arena_id`, `user_id` (nullable — pode ser convite pendente)
- `display_name`, `email`, `phone`
- `role` (enum: gerente, recepção, professor, organizador, financeiro, bar_lojinha, suporte)
- `permissions jsonb` (flags humanizadas: `manage_bookings`, `view_finance`, `manage_students`, `sell_products`)
- `is_active bool`, `invited_at`, `accepted_at`

UI:
- lista com avatar, nome, função, status
- "Convidar funcionário": nome, telefone/email, função → cria registro pendente
- editar função + permissões (toggles humanos: "Pode gerenciar reservas", "Pode ver financeiro", "Pode gerenciar alunos", "Pode vender produtos")
- ativar / desativar

Professores continuam em `arena_instructors` — não duplicar. Botão "Adicionar professor" leva para `/arena/dashboard/professores`.

RLS: dono da arena (`arenas.owner_user_id`) e admins do tenant podem ler/escrever.

## 5) Tenant — Visão de Rede (consolidada)

Adicionar páginas leves dentro do `TenantShell`:

- `/tenant/arenas/perfis` — lista das arenas do tenant com selo "perfil completo / incompleto"
- `/tenant/qr` — QRs ativos por arena (somatório + drilldown)
- `/tenant/produtos` — produtos por arena, vendas da rede (agregado de `marketplace_orders`)
- `/tenant/equipe` — equipe consolidada por arena

Tudo read-only com link "Abrir na arena" que leva ao painel da arena correspondente. Sem duplicar formulários.

## 6) Sidebar da Arena (atualização)

Reorganizar `src/layouts/sidebars/ArenaSidebar.tsx` em grupos limpos:

- **Visão geral** — Visão geral
- **Hoje** — Check-in, Reservas
- **Operação** — Quadras, Horários, Aulas
- **Clientes** — Alunos, Matrículas, Professores, **Equipe** (novo)
- **Torneios** — Torneios
- **Receita** — Financeiro, **Produtos** (novo)
- **Crescimento** — Patrocínios, **QR físico** (novo), **Perfil da arena** (novo)
- **Conversas** — WhatsApp

Esconder do menu lateral: "Ações IA", "Autonomia", "Control Tower", "Comandos" (rotas continuam funcionando, mas saem da navegação principal — já está alinhado com a regra "não expor IA").

Também atualizar `ArenaLayout.tsx` (top nav legado) para refletir os mesmos itens, evitando duas verdades.

## 7) Dashboard da Arena — Próximos passos

Em `ArenaDashboard.tsx`, adicionar uma seção discreta "Próximos passos da arena" só quando algo está faltando:

- "Completar perfil da arena" (se faltam campos)
- "Gerar primeiro QR físico" (se zero QRs)
- "Cadastrar primeiro produto" (se zero produtos)
- "Convidar funcionário" (se equipe vazia)

Cada card é um link direto para a página correspondente. Some quando completo. Sem poluir.

## 8) Botões "Voltar"

- Em `/arenas/:slug` (perfil público), quando o usuário logado é dono → botão "Voltar ao painel" (`/arena/dashboard`).
- Em todas as 4 páginas novas, header com "Voltar" usando `dashboardPathFor(userRole)` (helper já existe).

---

## Detalhes Técnicos

### Migrations (mínimas)

```sql
-- 1) campos novos em arenas (todos opcionais, com defaults)
alter table public.arenas
  add column if not exists logo_url text,
  add column if not exists modalities text[] not null default '{}',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists is_public boolean not null default true;

-- 2) wa_qr_tokens — metadados de gestão
alter table public.wa_qr_tokens
  add column if not exists label text,
  add column if not exists kind text,
  add column if not exists is_active boolean not null default true,
  add column if not exists scans_count integer not null default 0;

-- 3) products — categoria leve
alter table public.products
  add column if not exists category text;

-- 4) equipe da arena
create table if not exists public.arena_staff (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  role text not null check (role in ('gerente','recepcao','professor','organizador','financeiro','bar_lojinha','suporte')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.arena_staff enable row level security;

create policy "Arena owner/admin manage staff" on public.arena_staff
  for all using (
    exists (select 1 from public.arenas a where a.id = arena_id and a.owner_user_id = auth.uid())
    or is_admin(auth.uid())
  );
create policy "Staff sees own row" on public.arena_staff
  for select using (user_id = auth.uid());
```

### Arquivos novos

- `src/pages/arena-dashboard/ArenaProfile.tsx`
- `src/pages/arena-dashboard/ArenaQR.tsx`
- `src/pages/arena-dashboard/ArenaProducts.tsx`
- `src/pages/arena-dashboard/ArenaTeam.tsx`
- `src/components/arena/ArenaProfileForm.tsx`
- `src/components/arena/QRPrintSheet.tsx` (folha A4 imprimível)
- `src/components/arena/QRGenerator.tsx`
- `src/components/arena/ProductForm.tsx`
- `src/components/arena/StaffInviteDialog.tsx`
- `src/components/arena/NextStepsCard.tsx`
- `src/pages/tenant/TenantArenaProfiles.tsx`
- `src/pages/tenant/TenantQR.tsx`
- `src/pages/tenant/TenantProducts.tsx`
- `src/pages/tenant/TenantTeam.tsx`

### Arquivos editados

- `src/App.tsx` — registrar 4 rotas em `/arena/dashboard/*` e 4 em `/tenant/*`
- `src/layouts/sidebars/ArenaSidebar.tsx` — novos grupos + esconder IA/Autonomia/CT
- `src/pages/arena-dashboard/ArenaLayout.tsx` — sincronizar top-nav
- `src/layouts/sidebars/TenantSidebar.tsx` — adicionar visão de rede
- `src/pages/arena-dashboard/ArenaDashboard.tsx` — `NextStepsCard`
- `src/pages/arenas/ArenaPublic.tsx` — botão "Voltar ao painel" para o dono

### Bibliotecas

- `qrcode` (geração de QR no client) — leve, ~20kB. Sem novas chaves de API.

### Regras invioláveis aplicadas

- Sem mencionar ORKYM/IA em qualquer label de UI.
- Sem expor tokens, IDs técnicos, JWTs.
- Sem marketplace paralelo — `products` é a única tabela.
- Sem duplicar professor — `arena_instructors` continua dono dos professores.
- Rotas existentes preservadas.
- Botões "Voltar" sempre via `dashboardPathFor(userRole)`.

## Critério de Sucesso (checklist)

- [ ] Arena edita dados em `/arena/dashboard/perfil` e vê resultado em `/arenas/:slug`
- [ ] Arena gera, imprime e desativa QRs em `/arena/dashboard/qr`
- [ ] Arena cadastra produto e gera QR de produto em `/arena/dashboard/produtos`
- [ ] Arena convida e gerencia equipe em `/arena/dashboard/equipe`
- [ ] Tenant vê visão de rede consolidada em `/tenant/*`
- [ ] Sidebar limpa, sem termos técnicos, sem IA exposta
- [ ] Dashboard mostra "Próximos passos" só quando faltam itens
- [ ] Nada quebrado nas rotas atuais

