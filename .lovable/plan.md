# Tenant Strategic Operations Sprint

Transformar o Tenant em **central estratégica da rede esportiva** — não admin técnico, não operação de arena. Sem novas tabelas, sem edge functions, sem alterar runtime ORKYM/IA: apenas reorganização de UX, queries derivadas e refinamento dos módulos existentes.

## Princípios

- **Tenant ≠ Arena.** Nada de estoque, bar, caixa, pedidos físicos.
- **Zero IA exposta.** Remover Control Tower, ORKYM, "ações automáticas", "kill switch", usage meters, autonomy tier do dashboard principal. Manter acesso interno apenas em `/tenant/dominios` (configurações avançadas) se necessário.
- **Linguagem humana.** "Pendências importantes" não "alertas abertos"; "Automação ativa" opcional ou removido.
- **Reuso total** de queries e tabelas atuais (`arenas`, `tournaments`, `tenant_memberships`, `companies`, `v_organizer_balances_canonical`, `transaction_splits`, `arena_billing_cycles`, `arena_operational_events`).

## 1. Renomeação (glossário tenant)

Atualizar `src/lib/profileNaming.ts` (PROFILE_NAMING.tenant) + strings em `TenantShell.tsx`, `TenantSidebar.tsx`, `TenantDashboard.tsx`:

| Antes | Depois |
|---|---|
| Control Tower da Rede | Central da Rede |
| Visão Executiva | Visão da Rede |
| MoodPlay Default / Rede Default | `{tenant.name}` real |
| Ações automáticas | (remover do dashboard) |
| Alertas abertos | Pendências importantes |
| Mensagens (técnico) | (remover do KPI principal) |
| Conversas | Conversas da rede |

Header do shell: `Rede · {tenant.name}` (já está) — remover chip Free/tier do header principal.

## 2. Dashboard principal `/tenant/dashboard`

Reescrita do `TenantDashboard.tsx` com 4 blocos estratégicos (substitui os 5 atuais técnicos):

### 2.1 Rede (substitui "Visão executiva")
KPIs: Arenas ativas · Organizadores ativos · Eventos ativos · Torneios da semana · Patrocinadores ativos.
Queries: `arenas` (is_active), `tenant_memberships`, `tournaments` (status in upcoming/registrations_open/in_progress; created_at semana), `companies` (tenant_id, is_active/sponsor flag).

### 2.2 Crescimento
Cards de insight derivados de queries simples:
- Arena com maior crescimento (delta de torneios/inscrições últimos 30d vs 30d anteriores)
- Horários mais movimentados (agregação `bookings.start_time` por hora — top 3)
- Esportes mais praticados (agregação `tournaments.modality` ou `bookings.modality`)
- Arenas com baixa atividade (sem torneios/bookings 30d)
- Taxa de ocupação média (bookings confirmados / slots disponíveis estimados)
- Crescimento da rede (arenas/organizadores novos 30d)

Implementação: hook novo `useTenantInsights(tenantId)` em `src/hooks/` consolidando queries paralelas (sem novas tabelas).

### 2.3 Receita
Reusar `RevenueDashboardPanel` mas com **separação por fonte** já existente em `financial_transactions.source_type`:
- Torneios (enrollment)
- Patrocínios (sponsorship)
- Produtos próprios (marketplace com vendor=tenant)
- Taxas (platform_fee)
- Repasses (payout/withdrawal)

Filtros: período (7d/30d/90d), comparação com período anterior, tendência (sparkline simples já no GrowthDashboardPanel ou cálculo inline).

### 2.4 Inteligência da rede
Cards humanos (sem termos técnicos):
- "Arena em destaque" (top receita 30d)
- "Torneio em alta" (mais inscrições semana)
- "Esporte crescendo" (modalidade com maior delta)
- "Melhor conversão" (arena com maior % booking pago)
- "Horário de pico" (hora mais movimentada da rede)

**Remover** do dashboard: UsageMeter, KillSwitchPanel, OrkymActionsCard, ControlTowerAIPanel, tier badge, "ações automáticas", "mensagens".

## 3. Sidebar reorganizada

`TenantSidebar.tsx` — agrupar por intenção estratégica:

```
Visão geral
  Visão geral                 /tenant/dashboard

Rede
  Arenas                      /tenant/arenas
  Organizadores               /tenant/membros
  Empresas & Patrocinadores   /tenant/empresas

Eventos
  Eventos & Torneios          /tenant/torneios
  Circuitos                   /tenant/circuitos    (novo)
  Calendário                  /tenant/calendario   (novo)

Receita
  Financeiro                  /tenant/financeiro

Identidade
  Perfil da rede              /tenant/perfil       (novo)
  Configurações               /tenant/dominios

Conversas
  Conversas                   /tenant/mensagens-wa
```

Remover: "Visão da rede" (Perfis das arenas, QR físico, Produtos, Equipe) — mover para sub-abas dentro dos módulos pertinentes (Produtos → dentro de Empresas; Equipe → Configurações; QR físico → Arena, não Tenant).

## 4. Módulos a refinar

### 4.1 `/tenant/arenas` (TenantArenaProfiles.tsx + nova ArenaDetail)
- Listagem com cards: nome, cidade, status, ocupação 30d, torneios ativos, receita 30d
- Botão "Criar arena" (já existe fluxo admin — replicar com tenant_id pré-preenchido)
- Detalhe arena tenant-side: performance, ocupação, eventos, **sem** bar/estoque/caixa

### 4.2 `/tenant/torneios` (TenantTournaments.tsx)
- Calendário visual + lista
- Filtros: arena, modalidade, status, patrocinador
- CTAs: Criar evento / Criar torneio / Criar circuito
- Coluna "patrocinadores" e "organizadores" por torneio

### 4.3 `/tenant/circuitos` (novo)
Página listando circuitos (sequência de torneios). Se não existir tabela `circuits`, criar agrupamento virtual por `tournaments.circuit_name` ou tag. **Confirmar com user antes de criar tabela.**

### 4.4 `/tenant/membros` → renomear UI para "Organizadores"
- Listagem com torneios realizados, receita gerada, status
- Aprovar/revogar organizador (via `tenant_memberships.status`)

### 4.5 `/tenant/empresas` → "Empresas & Patrocinadores"
TenantCompanies.tsx hoje é ComingSoon. Implementar:
- Listagem de companies (tenant_id)
- Cadastrar patrocinador
- Vincular a arenas (nova tabela `sponsor_arena_links` ou reuso de `sponsorships`/`ad_campaigns` — confirmar)
- Vincular a torneios (reusar `ad_campaigns.kind='tournament_sponsorship'`)
- Acompanhar ativações (métricas de `ad_impressions`)

### 4.6 `/tenant/perfil` (novo — TenantProfile.tsx)
Página pública/editável do perfil da rede:
- Logo, hero, descrição, cidades atendidas
- Listas: arenas, patrocinadores, organizadores, torneios
- Feed da rede (reusar `SocialActivityFeed` filtrado por tenant)
- Upload via `ImageUploadField` para bucket `tenant-assets` (criar bucket público se ainda não existir)

### 4.7 `/tenant/financeiro` — refinar
Hoje básico. Reescrever com:
- **Entradas** segmentadas: torneios, patrocínios, ativações, taxas, produtos, inscrições
- **Saídas** segmentadas: premiações, repasses, gateway, marketing, operacional
- **Filtros**: período, arena, evento, torneio, patrocinador, organizador, tipo
- Exportação CSV (botão simples client-side)

## 5. Empty states

Padronizar em todas páginas tenant via componente reutilizável (criar `src/components/tenant/EmptyState.tsx` ou reusar `ComingSoonPage`):
- Arenas vazias → "Sua rede ainda não tem arenas. Adicione a primeira." + CTA
- Sem patrocinadores → "Conecte marcas que querem patrocinar seus torneios." + CTA
- Sem torneios → "Crie o primeiro torneio da rede." + CTA
- Sem organizadores → "Convide organizadores para operar seus eventos." + CTA

## 6. Mobile-first

Todos cards/grids do dashboard: `grid-cols-1` mobile, `md:grid-cols-2`, `lg:grid-cols-3/4`. Sidebar já colapsa via `useSidebar`. KPIs em 2 colunas no mobile.

## 7. Separação Tenant vs Arena (UX rule)

Adicionar memory `mem://constraints/tenant-vs-arena.md`:
- Tenant: rede, estratégia, expansão, perfil rede, produtos da rede
- Arena: operação física, bar, estoque, caixa, pedidos, lojinha interna
- Tenant pode ter produtos próprios (merchandising da rede) — separar de "produtos da arena"

## 8. Testes (manual smoke)

- Criar torneio via `/tenant/torneios`
- Cadastrar patrocinador e vincular arena/torneio
- Aprovar organizador
- Criar/editar arena
- Filtros financeiro
- Editar perfil tenant + upload de imagens
- Sidebar e rotas em 375px/768px/1280px
- Build TS sem erros

## 9. Out of scope

- Novas tabelas (exceto confirmação prévia: `circuits`, `sponsor_arena_links`, bucket `tenant-assets`)
- Edge functions novas
- Alterar lógica ORKYM/IA/runtime
- Operação física de arena (bar/estoque/caixa)
- Analytics complexos (BI completo)

## 10. Decisões pendentes (perguntar antes de implementar)

1. **Circuitos**: criar tabela `circuits` ou agrupar virtualmente por campo já existente?
2. **Sponsor↔Arena**: criar tabela de vínculo dedicada ou reusar `ad_campaigns`?
3. **Bucket `tenant-assets`**: criar agora ou reusar `arena-assets`?

## Arquivos a tocar

**Editar:**
- `src/lib/profileNaming.ts`
- `src/layouts/TenantShell.tsx`
- `src/layouts/sidebars/TenantSidebar.tsx`
- `src/pages/tenant/TenantDashboard.tsx` (reescrita parcial)
- `src/pages/tenant/TenantCompanies.tsx` (sair de ComingSoon)
- `src/pages/tenant/TenantTournaments.tsx`
- `src/pages/tenant/TenantArenaProfiles.tsx`
- `src/App.tsx` (novas rotas)

**Criar:**
- `src/hooks/useTenantInsights.ts`
- `src/components/tenant/EmptyState.tsx`
- `src/components/tenant/NetworkInsightCard.tsx`
- `src/pages/tenant/TenantProfile.tsx`
- `src/pages/tenant/TenantFinance.tsx` (refinado, substituir base atual)
- `src/pages/tenant/TenantCircuits.tsx` (se decisão #1 = virtual)
- `src/pages/tenant/TenantCalendar.tsx`
- `mem://constraints/tenant-vs-arena.md`

**Não tocar:**
- Edge functions, supabase/migrations (exceto decisões aprovadas)
- ORKYM, IA, autonomy, control-tower-ai
- Componentes de arena (bar/estoque/caixa)
