---
name: Organizer Event Engine
description: Hub /organizer/dashboard transforma o organizer em operador de eventos (5 blocos), separado do tenant admin.
type: feature
---

# Organizer Event Engine (Fase 11.4)

`/organizer/dashboard` usa `OrganizerShell` + `OrganizerSidebar` reorganizada (sem branding/domínios/membros/arenas globais/pagamento). Missão única: operar eventos.

## 5 blocos do dashboard
1. **Event Control Tower (topo dominante)** — KPIs: eventos ativos, próximos, inscritos hoje, check-in pendente, partidas próximas, alertas. Strip de alertas (eventos sem inscrições, eventos próximos com poucas inscrições).
2. **Meus eventos** — top 6 cards com status (Ativo/Em breve/Encerrado) + atalhos Gerenciar/Brackets.
3. **Inscrições** — KPIs agregados (Total/Pendentes/Pagas/Confirmadas/Check-in) + lista das 5 últimas.
4. **Operação de jogos** — eventos em andamento + partidas recentes (de `tournament_modalities` → `match_results`). Âncora `#checkin`.
5. **Performance** — receita estimada (entry_fee × paid) + ocupação por evento (top 5). Atalho para Financeiro.

## Rotas
- `/organizer/dashboard` (index → `OrganizerDashboard`)
- `/organizer/dashboard/eventos|inscricoes|jogos|performance` → mesmo dashboard com âncora
- `/organizer/dashboard/financeiro` → reuso de `OrganizerFinance`
- Legacy `/organizer/*` (settings/members/arenas/domains/payment/finance) intacto para retrocompat
- `ProfileSwitcher` atalho organizer agora vai para `/organizer/dashboard`

## Reuso (zero lógica nova)
- Queries de `Dashboard.tsx` (`tournaments` por `organizer_id` + `enrollments`)
- Padrão de `Brackets.tsx` para `tournament_modalities` + `match_results`
- `OrganizerFinance` para o bloco financeiro
- Helpers locais (`SectionHeader`, `KpiCard`, `ShortcutLink`) seguem padrão visual das Fases 11.2/11.3

## Naming
- "Torneios" → "Eventos"
- Header "Organizador" → "Organizador de eventos"
- Removido do shell de eventos: branding, domínios, membros, arenas globais, pagamento, configurações
