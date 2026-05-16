# Sprint Arena Operational Excellence — Dashboard "Hoje"

Refatorar `src/pages/arena-dashboard/ArenaDashboard.tsx` em central operacional simples, sem novas features de backend, sem ERP, sem IA visível. Apenas reagrupar dados que já existem em torno de quatro perguntas: o que está rolando agora, o que vem nas próximas horas, o que precisa de atenção, o que posso fazer rápido.

## Escopo

**Arquivo principal:** `src/pages/arena-dashboard/ArenaDashboard.tsx` (rewrite focado).
**Componentes novos** (apenas UI, sob `src/components/arena/`):
- `NowBlock.tsx` — bloco "Agora"
- `NextHoursBlock.tsx` — bloco "Próximas horas"
- `AttentionBlock.tsx` — até 3 cards problema+ação
- `QuickActionsBar.tsx` — barra de ações rápidas

**Não tocar:** sidebar, shells, rotas, edge functions, RPCs, schemas, ORKYM, Control Tower IA. `NextStepsCard` permanece (onboarding).

## Estrutura nova de "Hoje"

```text
HEADER  Nome da arena · "terça, 14h32"
QUICK ACTIONS BAR  [Abrir QR] [Nova reserva] [Criar torneio] [Resultado] [Conversas]
─────────────────────────────────────────────
AGORA         quadras ocupadas · jogos/aulas em andamento · check-ins (5min) · próximo jogo (1h)
PRÓXIMAS HORAS  reservas/aulas/torneios das próximas ~6h em timeline simples
PRECISA DE ATENÇÃO  até 3 cards (vazio importante · reserva pendente · cobrança próxima · torneio com poucas inscrições · aluno inativo)
─────────────────────────────────────────────
NEXT STEPS (existente, só se houver pendência de setup)
```

Remover do dashboard atual: KPI grid genérico (`Receita do mês`, `Recebimentos 7d`, `Vencimentos 7d`, `Pendências`, `Reservas hoje` numérico, `Aulas hoje` numérico, `Torneios ativos` numérico, `Alunos ativos`), seções "Seu dinheiro", "Movimento da arena", card WhatsApp, card QrEntry duplicado, atalhos repetidos. Esses dados continuam acessíveis via sidebar — o dashboard para de ser vitrine de números.

## Detalhes por bloco

### Quick Actions Bar (topo, sticky no mobile)
Barra horizontal scrollável no mobile, grid no desktop. Botões:
- Abrir QR → `/arena/dashboard/qr`
- Nova reserva → `/arena/dashboard/reservas` (lista, criar manual já existe)
- Criar torneio → `/create-tournament`
- Registrar resultado → `/arena/dashboard/torneios`
- Conversas → `/arena/dashboard/mensagens-wa`

### Agora
Queries (todas em `bookings`, `arena_classes`, `arena_attendance` — tabelas existentes):
- Reservas com `booking_date = today` e `start_time <= now <= end_time`, status≠canceled → "X de Y quadras ocupadas" + lista das ocupadas (quadra · cliente · até HH:MM).
- `arena_classes` com `start_at <= now <= end_at` → aulas em andamento (turma · professor).
- `arena_attendance` últimos 30 min → "N check-ins recentes".
- Próximo `bookings` nas próximas 60 min → card destacado "Próximo: quadra X às HH:MM".

Empty: "Nenhuma quadra ocupada agora" + link "Ver agenda do dia".

### Próximas horas
Lista cronológica unificada (próximas ~6h, limit 8) misturando:
- `bookings` futuras hoje (HH:MM · quadra · cliente)
- `arena_classes` futuras hoje (HH:MM · turma)
- `tournaments` que começam hoje (badge "torneio")

Ordenado por horário. Cada item tem chevron clicável que leva ao detalhe correspondente.

Empty: "Sem mais agendamentos hoje" → CTA "Divulgar horários" (`/arena/dashboard/perfil`).

### Precisa de atenção (máx. 3)
Pipeline determinístico em ordem de prioridade, mostra os 3 primeiros que dispararem:
1. **Cobrança vencendo em 48h** — query `arena_billing_cycles` pending com `due_at <= now+48h` → ação "Ver cobranças".
2. **Reserva pendente de pagamento >2h** — `bookings` status pending criados há >2h hoje → ação "Revisar".
3. **Torneio com <30% de inscrição e início <7d** — derivado de `tournaments` + `enrollments` count → ação "Divulgar".
4. **Buraco na agenda em horário nobre** — janela ≥2h vazia entre 18h–22h hoje → ação "Promover horário".
5. **Aluno inativo** — `arena_students` sem `arena_attendance` últimos 21d → ação "Reativar aluno".

Cada card: ícone semafórico (amber/red), título curto ("3 cobranças vencem esta semana"), 1 linha de contexto, botão único. Sem cards = bloco escondido (não mostrar "tudo ok" placebo).

### Empty states
Linguagem humana, sempre com CTA acionável. Sem "—" ou "0".

## Visual / UX

- Tipografia: heading Bebas Neue, body Inter (já no projeto). Sentence case.
- Tokens semânticos (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary`). Acentos `text-primary` (verde #2BFF88) somente em estados vivos (ocupada, ao vivo, próximo).
- Pulsing dot verde discreto em "Agora" quando há atividade ao vivo (CSS `animate-pulse`).
- Mobile-first: blocos em `space-y-6`, cards `p-4`, fontes ≥ `text-sm`, toques ≥ 44px. Quick actions horizontalmente scrolláveis com `overflow-x-auto snap-x`.
- Densidade: máximo ~1 viewport mobile para Agora + Quick Actions; resto rola.

## Dados — reaproveitamento

Todas as tabelas/queries já existem (`bookings`, `arena_classes`, `arena_attendance`, `arena_billing_cycles`, `tournaments`, `enrollments`, `arena_students`). Nenhuma migração. Nenhuma RPC nova. Apenas novas combinações no client.

Carregamento: `Promise.all` único no `useEffect` do dashboard, passando subsets para cada bloco via props. Refresh manual via botão discreto no header (ícone refresh) e auto-refresh leve a cada 60s para o bloco Agora apenas.

## Fora de escopo (explícito)

- Sem alterar sidebar (entradas para Financeiro/Alunos/etc continuam lá).
- Sem novos endpoints, edge functions, schemas.
- Sem analytics/gráficos.
- Sem expor ORKYM/IA na "Hoje".
- `OrkymInsightsCard`/`OrkymActionsCard` (mencionados na memória Phase 11.2) **são removidos da Hoje** — passam a viver apenas em `/arena/dashboard/control-tower` se ainda existir (verificar antes; se a sidebar não os referencia, ignorar).
- WhatsApp connect deixa de ser banner permanente — vira 1 dos cards de "Atenção" só se desconectado.

## Relatório final (entregável após implementação)

- Diff resumido: 1 arquivo refatorado + 4 componentes novos.
- Removido: 4 KPIs genéricos, 2 grids de atalhos duplicados, banner WhatsApp, QrEntryCard duplicado.
- Novo: Agora, Próximas horas, Atenção (regra dos 3), Quick Actions sticky.
- Mobile QA via preview a 375px e 768px.
- Lista de gaps detectados (ex.: campos faltantes, queries lentas) — sem corrigir, apenas reportar.

## Critério de sucesso

Dono da arena abre `/arena/dashboard` no celular e em ≤3 segundos enxerga: o que está rolando, o que vem, o que precisa fazer. Sem rolagem para encontrar a primeira ação útil.
