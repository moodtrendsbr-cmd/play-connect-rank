## Tenant Cleanup + Circuit Activation Sprint

Finaliza a transformação do Tenant em central estratégica de rede. Sem novas engines, sem IA nova, sem expor runtime/ORKYM/bindings.

### 1. Rotas órfãs removidas

Remover de `src/App.tsx` (rotas e imports) e da sidebar:
- `/tenant/produtos` + `TenantProducts.tsx`
- `/tenant/qr` + `TenantQR.tsx`
- `/tenant/whatsapp-routing` + `TenantWhatsAppRouting.tsx` (mover apenas para Admin se já não existir lá; senão remover)
- `/tenant/equipe` (substituída — ver §3)

Apagar arquivos órfãos correspondentes. Limpar imports/links restantes via `rg`.

### 2. WhatsApp do Tenant humanizado

**`TenantConnectWhatsApp.tsx` → "Comunicação da Rede"**
Remover toda menção a ORKYM, IA, runtime, binding, provider, auditoria. Reescrever copy do `ConnectWhatsAppLayout` + `WhatsAppConnectionPanel` para mostrar apenas:
- número conectado · status · última sincronização · QR · botão reconectar

A lógica do hook `useWhatsAppConnectionStatus` é mantida (já abstraída); só o texto/UX muda.

**Badge no `TenantShell`**: manter ícone/status, sem termos técnicos no tooltip.

### 3. Gestão da Rede (substitui "Equipe")

Nova página `src/pages/tenant/TenantNetworkManagement.tsx` em `/tenant/gestao-rede`.

Sidebar: grupo "Identidade" recebe item "Gestão da Rede" (ícone Users), `/tenant/equipe` removido.

Reusa `tenant_memberships` (já existe): listar gestores, adicionar por email, remover, definir role (`owner`/`admin`/`member` = "Gestor"/"Organizador"). Vínculo com arenas continua via `arenas.tenant_id`. Sem staff físico/caixa/recepção.

Renomes globais via grep: "Equipe" → "Gestão da Rede", "Operadores" → "Gestores".

### 4. Circuitos ativados (P0)

**4.1 `CreateTournament.tsx`**
- Adicionar `<Select>` "Circuito (opcional)" carregando `circuits` do tenant do usuário.
- Botão "+ Novo circuito" abre Dialog inline (nome + temporada) que insere em `circuits` e seleciona.
- `circuit_id` enviado no insert de `tournaments`.

**4.2 `ManageTournament.tsx`**
- Mesmo select para alterar/remover circuito do torneio existente.

**4.3 `TournamentDetail.tsx`**
- Se `circuit_id`, badge "Etapa do circuito · {nome}" linkando para `/tenant/circuitos/{id}` (ou rota pública futura). Logo do circuito quando houver.

**4.4 `TenantCircuits.tsx` + nova `TenantCircuitDetail.tsx` em `/tenant/circuitos/:id`**
Refinar página de detalhe (mesmo que básica):
- header com nome/temporada/logo
- lista de etapas (tournaments do circuit_id ordenadas por start_date)
- arenas envolvidas (distinct via tournaments→arena)
- ranking básico (placeholder com link futuro)
- próximos eventos · campeões (de torneios concluídos) · patrocinadores (sponsor_arena_links filtrado por arenas do circuito)

### 5. Insights corrigidos

Em `useTenantInsights.ts` + `TenantDashboard.tsx`:
- "Arena em destaque" = maior ocupação 30d (bookings/horas livres)
- "Arena crescendo" = maior delta receita período vs anterior
- "Esporte em alta" = mais inscrições absolutas 30d
- "Esporte crescendo" = maior delta % período
- "Torneio em alta" = maior nº inscrições reais (não mais o criado recentemente)

Remover duplicações ("Arena mais ativa" = "Arena em destaque" some).

### 6. Financeiro

`TenantFinance.tsx`:
- Card "Receita por arena" (group by arena via splits/transactions já existentes)
- "Arena mais rentável" no topo
- Breakdown por tipo (torneio/reserva/produto)
- Comparação período anterior (delta % e seta)

Sem migrations: agrega no client a partir das queries atuais.

### 7. Patrocinadores

Migration leve adiciona em `sponsor_arena_links`:
- `tournament_id uuid null references tournaments(id) on delete cascade`
- `contract_start date null`, `contract_end date null`
- índice em `tournament_id`

UI em `TenantCompanies.tsx` (ou nova aba "Patrocínios"):
- vínculo patrocinador ↔ arena ↔ torneio (opcional)
- lista de ativos + "próximos vencimentos" (contract_end ≤ 30d)

### 8. Conversas

`TenantMessages.tsx` ganha filtros por origem: Arenas · Organizadores · Patrocinadores · Suporte. Filtragem client-side baseada em metadata do contato (role do peer). Linguagem "Central de Relacionamento da Rede".

### 9. Segurança RLS

Migration corrige `sponsor_arena_links`:
- DROP "Sponsor links visible to all"
- SELECT policy restrita a: admin (`has_role`), membros do tenant via `tenant_memberships`, owner da arena envolvida.

### 10. Performance

- `useTenantInsights` envolto em `useMemo` por inputs
- `React.memo` em cards de KPI repetidos
- Consolidar queries duplicadas no Dashboard (uma única chamada de arenas reusada)
- Sem refactor estrutural

### 11. Mobile UX

`overflow-x-auto` + `min-w-0` em tabelas de Financeiro/Circuitos/Empresas. Filtros em `flex-wrap`. Headers stick em scroll horizontal.

### 12. Empty states

Padronizar uso de `EmptyState` (já existe) em: Gestão Rede · Patrocinadores · Circuitos · Financeiro · Conversas. CTA sempre acionável.

### 13. Testes manuais (checklist no relatório)

Criar circuito → criar torneio vinculado → editar → ver no detail → vincular patrocinador a torneio → adicionar gestor → connect whatsapp limpo → financeiro com breakdown → mobile sem overflow → sidebar sem itens removidos → todas rotas tenant resolvendo.

### 14. Detalhes técnicos

**Arquivos removidos:** `src/pages/tenant/TenantProducts.tsx`, `TenantQR.tsx`, `TenantTeam.tsx`, `TenantWhatsAppRouting.tsx`.

**Arquivos novos:** `TenantNetworkManagement.tsx`, `TenantCircuitDetail.tsx`.

**Arquivos editados:** `src/App.tsx`, `src/layouts/sidebars/TenantSidebar.tsx`, `src/layouts/TenantShell.tsx`, `TenantConnectWhatsApp.tsx`, `TenantDashboard.tsx`, `TenantFinance.tsx`, `TenantCompanies.tsx`, `TenantCircuits.tsx`, `TenantMessages.tsx`, `useTenantInsights.ts`, `CreateTournament.tsx`, `ManageTournament.tsx`, `TournamentDetail.tsx`.

**Migrations (2):**
1. `sponsor_arena_links` ALTER (tournament_id, contract_start, contract_end) + nova RLS SELECT escopada.
2. (Se necessário) ajustes mínimos para suportar query de ranking de circuitos.

**Memória:** atualizar `mem/constraints/tenant-vs-arena.md` e `mem/features/tenant-control-tower.md` com rotas removidas e Circuit Activation.

### Critério de sucesso

Tenant parece operador de rede esportiva (não admin técnico, não arena, não painel SaaS). Zero menção a ORKYM/runtime/binding na UI Tenant. Circuitos utilizáveis ponta a ponta. Build TypeScript verde.
