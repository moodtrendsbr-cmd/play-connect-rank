# Limpar e simplificar a "Visão geral" da Arena

Reescrever `src/pages/arena-dashboard/ArenaDashboard.tsx` para virar um painel humano, direto, sem jargão técnico. Nada será removido do banco de dados nem de outras páginas — apenas esta tela é reorganizada. Componentes ORKYM/conversational continuam existindo e seguem sendo usados em outras páginas (Control Tower dedicada, Comandos, etc.).

## 1. Remover desta página

Os seguintes componentes/blocos saem da `ArenaDashboard.tsx` (continuam existindo no projeto, só não aparecem mais aqui):

- `OrkymInsightsCard` (Sugestões da ORKYM)
- `OrkymActionsCard` (ações automáticas da ORKYM)
- `OperationModeBanner`
- `CommandExamplesCard` com os exemplos `COMMANDS.arena` ("Criar torneio sábado…", etc.)
- `CommandHistoryCard`
- `RevenueDashboardPanel` (Conversão WhatsApp / Performance por mensagem / Via ORKYM)
- Bloco "Growth" com link "Sugestões da ORKYM"
- Header "Control Tower" + subtítulo "Central de operação"
- Caixa de pendências operacionais com badges "ORKYM / Manual / Sistema" e o texto "ORKYM populará aqui sugestões…"

Imports não usados são removidos (`Bot`, `Cog`, `Sparkles`, `Gauge`, `OrkymInsightsCard`, `OrkymActionsCard`, `OperationModeBanner`, `CommandExamplesCard`, `CommandHistoryCard`, `COMMANDS`, `RevenueDashboardPanel`).

## 2. Nova estrutura da página

```text
Header
  "Sua arena · {nome}"
  (subtítulo curto: "Resumo de hoje")

Próximos passos (NextStepsCard — mantido, é onboarding útil)

[1] Hoje na sua arena
    - Reservas hoje      (stats.today)
    - Aulas hoje         (stats.classesToday)
    - Check-ins hoje     (novo: count em arena_class_attendance ou bookings com checked_in)
    - Torneios ativos    (stats.activeTournaments)
    Lista: Próximas reservas (mantém a lista atual, sem mudanças)

[2] Seu dinheiro
    - Receita do mês     (stats.monthRevenue)
    - Recebimentos 7d    (stats.revenue — receita prevista 7 dias)
    - Vencimentos 7d     (stats.dueSoon)
    - Pendências         (stats.overdue — inadimplência)
    Atalhos: Cobranças · Assinaturas · Transações

[3] Movimento da arena
    - Alunos ativos      (stats.students)
    - Frequência         (% presença últimos 30d, calculado a partir de arena_class_attendance)
    Atalhos: Alunos · Aulas · Matrículas

[4] O que fazer agora
    - Mostra UMA única tarefa (a primeira de tasks[], priorizada).
      Se nenhuma: "Tudo em dia por aqui."
    - Botões "Feito" / "Dispensar" mantidos.
    - Sem badges de origem (ORKYM/Manual/Sistema).

[5] Gerencie pelo WhatsApp
    - Card simples com texto humano: "Receba alertas e gerencie sua arena
      direto pelo WhatsApp."
    - CTA → /arena/connect-whatsapp (status do número conectado vem do
      hook useWhatsAppConnection já existente; mostra "Conectado" ou
      "Conectar agora").
    - SEM exemplos de comandos, SEM aspas, SEM histórico.

[6] Entrada via QR
    - Reaproveita QrEntryCard com textos humanos:
        title: "Entrada via QR"
        subtitle: "Check-in rápido em aulas, torneios e quadras"
        ctaLabel: "Abrir check-in"
```

## 3. Linguagem (regras aplicadas a todos os textos da página)

Banidos: ORKYM, IA, engine, comando, "via WhatsApp", "Conversão", "Performance por mensagem", "Sugestões da ORKYM", "Control Tower", "Sistema", "Manual", aspas em comandos.

Substituições:
- "Control Tower" → não aparece (header vira "Sua arena")
- "Operar pelo WhatsApp" → "Gerencie pelo WhatsApp"
- "Receita via ORKYM" → "Seu dinheiro"
- "Caixa de pendências operacionais" → "O que fazer agora"
- "Receita do mês" mantém
- "Inadimplência" → "Pendências"
- "Receita 7 dias" → "Recebimentos 7d"

## 4. Detalhes técnicos

- Arquivo único alterado: `src/pages/arena-dashboard/ArenaDashboard.tsx`.
- Queries existentes em `load()` são reaproveitadas. Adicionar duas:
  - `checkinsToday`: count em `arena_class_attendance` com `attended_at` no dia + count em `bookings` com `checked_in_at` no dia (somar). Se a coluna não existir em alguma tabela, usar só a que existir; verificar com `code--view` do schema antes de implementar e cair em fallback graceful (mostrar 0).
  - `attendanceRate`: nos últimos 30 dias, `count(present) / count(total)` em `arena_class_attendance`. Fallback "—" se sem dados.
- A página `/arena/dashboard/control-tower` (`ArenaControlTower.tsx`) continua existindo e mantém os componentes ORKYM/Revenue para quem quiser. Nada lá muda.
- A rota `/arena/dashboard/comandos` continua existindo no menu lateral; só não é promovida no dashboard.
- `NextStepsCard` é mantido sem alterações.
- `QrEntryCard` é mantido (apenas com textos novos via props).
- A "tarefa única" usa `tasks[0]` do estado já carregado; layout fica em um único card simples sem badges nem fontes.
- Nenhuma migração, nenhuma edge function, nenhuma dependência nova.

## 5. Critério de sucesso

Ao abrir `/arena/dashboard`, em 5 segundos o dono vê:
1. Como está o dia (reservas, aulas, check-ins, torneios).
2. Como está o dinheiro (receita, recebimentos, pendências).
3. Movimento (alunos, frequência).
4. Uma única próxima ação.
5. Atalho de WhatsApp e QR — sem exemplos de comando, sem ORKYM, sem termos técnicos.
