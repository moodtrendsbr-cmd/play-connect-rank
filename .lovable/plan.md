

# Fase 11.2 — Arena Control Tower (UX-only)

> **Princípio**: zero banco, zero edge, zero lógica nova. Apenas reorganização visual de `/arena/dashboard` em 5 blocos hierárquicos + 6 sub-blocos de Visão Rápida + ajuste de naming/agrupamento na sidebar nova. Tudo reusa componentes/queries que já existem.

---

## 1. Os 5 blocos do dashboard (reorganização de `ArenaDashboard.tsx`)

```text
┌─────────────────────────────────────────────────────────────────┐
│ HEADER — "Control Tower" + nome arena + status ORKYM + refresh  │
├─────────────────────────────────────────────────────────────────┤
│ BLOCO 1 — CONTROL TOWER (DOMINANTE, topo)                       │
│ ├─ OrkymInsightsCard (alerts + sugestões + status)  [reuso]     │
│ ├─ OrkymActionsCard  (ações pendentes, max 3)       [reuso]     │
│ └─ Caixa de pendências (tasks operacionais)         [reuso]     │
├─────────────────────────────────────────────────────────────────┤
│ BLOCO 2 — OPERAÇÃO DO DIA                                       │
│ ├─ KPIs do dia: Reservas hoje · Aulas hoje · Quadras · Alunos   │
│ ├─ Próximas reservas (lista existente)              [reuso]     │
│ └─ Atalhos: Check-in · Ocorrências abertas · Presença           │
├─────────────────────────────────────────────────────────────────┤
│ BLOCO 3 — FINANCEIRO (resumo)                                   │
│ ├─ Receita do mês · Receita 7d · Vencimentos 7d · Inadimplência │
│ └─ Atalhos: Cobranças · Assinaturas · Transações                │
├─────────────────────────────────────────────────────────────────┤
│ BLOCO 4 — TORNEIOS                                              │
│ ├─ KPI: Torneios ativos                                         │
│ └─ Atalhos: Torneios · Categorias · Check-in torneios           │
├─────────────────────────────────────────────────────────────────┤
│ BLOCO 5 — GROWTH                                                │
│ └─ Atalhos: Patrocínios · Marketplace (link) · Sugestões ORKYM  │
└─────────────────────────────────────────────────────────────────┘
```

**Mudanças concretas em `ArenaDashboard.tsx`** (apenas refactor de JSX, mantém todas as queries do `load()`):
- Header novo com título "Control Tower", subtítulo com nome da arena, badge de status ORKYM (já vem do `OrkymInsightsCard`).
- Subir `OrkymInsightsCard` + `OrkymActionsCard` + Caixa de pendências para o topo dentro de uma section visualmente dominante (border-l-2 primary, bg-primary/5).
- Quebrar grid `statCards` (6) em **3 grids menores** distribuídos pelos blocos 2/3/4 conforme afinidade — mesmas variáveis (`stats.today`, `stats.classesToday`, etc.).
- Remover o grid genérico de 12 atalhos do final; substituir por 4 mini-grids contextuais dentro de cada bloco.
- Adicionar `<SectionHeader>` reusável local (h2 + ícone + cor de acento) — componente trivial inline, ~10 linhas.

**O que NÃO muda**: nenhuma query, nenhum endpoint, nenhuma lógica de `updateTask`, nenhum tipo de dado. Apenas estrutura JSX.

---

## 2. Sidebar do `ArenaShell` (já estruturada — só ajustes finos)

A sidebar nova em `src/layouts/sidebars/ArenaSidebar.tsx` já tem 5 grupos: Control Tower / Operação / Pessoas / Financeiro / Growth. Ajustes mínimos:

| Antes | Depois | Motivo |
|---|---|---|
| Grupo "Control Tower" inclui Dashboard + Control Tower + Ações IA + Autonomia | **"Central de Operação"** com mesmos 4 itens, "Ações IA" → "Ações sugeridas", "Autonomia" → "Controle automático" | naming operacional |
| Grupo "Pessoas" separado | **fundir em "Operação"** abaixo das aulas (Alunos · Professores logo após Matrículas) | menos quebras |
| "Cobranças" | "Cobranças (mensalidades)" | clareza |
| Sem ícone de check-in destacado | Mover Check-in para o topo de Operação | é ação diária crítica |

O `ArenaLayout` legacy (top-bar de 19 abas em `/arena/dashboard`) **não é alterado** — continua intacto para compatibilidade.

---

## 3. Naming (apenas labels, sem renomear rotas)

| Atual | Novo |
|---|---|
| "Dashboard" (título h1) | "Control Tower" |
| "Operação" (subtítulo) | "Visão geral da operação" |
| "Caixa de pendências" | "Caixa de pendências operacionais" (mantém) |
| "Ações IA" (sidebar) | "Ações sugeridas" |
| "Autonomia" (sidebar) | "Controle automático" |
| "Attendance" (se aparecer em algum lugar) | "Presença" |

URLs permanecem idênticas (`/arena/dashboard/acoes-ia`, `/arena/dashboard/autonomia`, etc.).

---

## 4. Componentes — reuso vs criação

**Reusados sem alteração**:
- `OrkymInsightsCard`, `OrkymActionsCard`, `ActionProposalDetail`, `PolicyDecisionBadge`, `OrkymStatusBadge`
- Cards `Card/CardContent/CardHeader/CardTitle` (shadcn)
- `Button`, `Badge`, ícones `lucide-react`
- Toda a função `load()` e `updateTask()` do `ArenaDashboard.tsx`

**Criados (locais ao arquivo, não exportados)**:
- `SectionHeader` (~10 linhas) — h2 + ícone + cor de acento; usado em cada um dos 5 blocos.
- `KpiCard` (~15 linhas) — wrapper visual mais premium para os stats existentes (já existe um padrão inline; só extrai para reduzir duplicação dentro do mesmo arquivo).

Nenhum componente novo em `src/components/`.

---

## 5. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` — refactor de JSX em 5 blocos (queries intactas) |
| Edit | `src/layouts/sidebars/ArenaSidebar.tsx` — relabel + reorder + fundir Pessoas em Operação |
| Memory | `mem/features/arena-management.md` — append nota "Phase 11.2: dashboard reorganizado em 5 blocos (Control Tower / Operação / Financeiro / Torneios / Growth)" |

**Total**: 2 arquivos editados, 1 memory atualizado. Zero arquivos novos. Zero rotas alteradas.

---

## 6. Garantias de não-regressão

- `/arena/dashboard` continua funcionando — legacy `ArenaLayout` (top-bar) intocado.
- Todas as 19 sub-rotas (`/arena/dashboard/*`) intocadas.
- Nenhuma query SQL nova; mesmas tabelas (`bookings`, `arena_students`, `arena_billing_cycles`, `arena_occurrences`, `arena_operational_tasks`, `tournaments`, `financial_transactions`).
- Nenhum import novo de tipos do Supabase.
- Build TS: zero diff de tipos.

---

## 7. ENTREGA B — Relatório (resumo do que será informado ao final)

| Item | Resultado |
|---|---|
| Reaproveitado | OrkymInsightsCard, OrkymActionsCard, queries do dashboard, todos os ícones existentes |
| Reorganizado | ArenaDashboard.tsx em 5 blocos hierárquicos; ARenaSidebar com Pessoas fundido em Operação |
| Renomeado (labels) | "Dashboard"→"Control Tower", "Ações IA"→"Ações sugeridas", "Autonomia"→"Controle automático" |
| Melhor agrupado | KPIs distribuídos por afinidade (dia/financeiro/torneios) ao invés de grid solto de 6 |
| Para subfases | Hub real Operação do Dia com timeline (11.3); financeiro com gráfico (11.4); torneios com brackets resumo (11.5) |

## 8. ENTREGA C — Pendências para próximas subfases

- **11.3**: timeline real do dia (aulas + reservas + ocorrências em uma linha temporal única)
- **11.4**: gráfico financeiro 30d e funil de inadimplência
- **11.5**: card "Torneios" mostrando próximas partidas via `tournament_modalities`/`match_results`
- **11.6**: substituir `tournaments.arena = arena.name` (string match frágil) por FK real — depende de migration
- **11.7**: camada conversacional WhatsApp (alertas críticos + aprovação de ação ORKYM via reply)
- **11.8**: deprecar legacy `ArenaLayout` (top-bar de 19 abas) e migrar `/arena/dashboard` para o `ArenaShell` novo com sidebar

## 9. Critério de sucesso

- ✅ `/arena/dashboard` parece uma central operacional (Control Tower visualmente dominante no topo)
- ✅ Os 5 blocos hierárquicos visíveis sem scroll horizontal
- ✅ ORKYM (insights + actions + tasks) é a primeira coisa que aparece
- ✅ Sidebar do `ArenaShell` tem 5 grupos claros com naming operacional
- ✅ Todas as 19 sub-rotas continuam respondendo
- ✅ Zero edge function, zero migration, zero policy, zero RLS, zero quebra de tipos

