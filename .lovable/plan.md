# Plan — Control Tower: Experiência Invisível

Refazer a camada visível da Control Tower para que **nenhum usuário veja "ORKYM", "IA", "decisão", "configuração" ou jargão técnico**. Toda a inteligência continua igual por baixo (RPC `control_tower_summary`, ORKYM, guardrails) — só muda a apresentação.

## O que muda na prática

Antes:
- "Control Tower AI" + ícone Sparkles
- "Health score" + sub-scores expostos (Adoção ORKYM, etc.)
- "Próxima melhor ação" → botão **"Executar via ORKYM"** + badge `tournament_boost`
- Toast: "ORKYM analisou — sem nova ação."

Depois:
- Título neutro: **"Visão geral"** (sem AI/Sparkles).
- Score continua, mas chamado **"Saúde do negócio"**, sem o sub-score `Adoção ORKYM` (oculto na UI; segue calculado no backend).
- Cada oportunidade vira **um cartão com 1 problema + 1 botão de ação humana + 1 clique**.
- Toasts em linguagem natural: "Estamos divulgando seu torneio agora", "Estamos tentando preencher esse horário".

## 1. Mapa de ações humanas

Mapear `action_type` → rótulo humano + frase de feedback. Tudo vive em um único arquivo novo `src/lib/controlTowerCopy.ts`:

```text
tournament_boost        → "Divulgar torneio"           "Estamos divulgando seu torneio agora"
fill_idle_slots         → "Preencher horário"          "Estamos tentando preencher esse horário"
reactivation_message    → "Trazer cliente de volta"    "Estamos reativando esse cliente"
send_proactive_message  → "Incentivar atleta"          "Estamos enviando um incentivo"
create_campaign         → "Aumentar vendas"            "Estamos impulsionando suas vendas"
upsell_plan             → "Oferecer upgrade"           "Estamos oferecendo upgrade"
(fallback)              → "Resolver agora"             "Estamos cuidando disso"
```

Também mapear `alert.kind` e `opportunity.kind` para títulos humanos quando o backend devolver chave técnica (ex.: `low_enrollment_tournament` → "Torneio com poucas inscrições"; `revenue_drop` → "Queda na receita esta semana"; `idle_court_slot` → "Horário ocioso amanhã"; `inactive_athlete` → "Cliente sumiu há semanas"; `near_rank_up` → "Atleta perto de subir de nível"; `budget_exhausted` → "Limite mensal atingido"). Sem expor termo técnico em nenhuma string.

## 2. Refazer `ControlTowerAIPanel.tsx`

Renomear arquivo para `OverviewPanel.tsx` (manter `ControlTowerAIPanel` re-exportado para não quebrar imports — opcional; mais simples: manter o arquivo, só reescrever o conteúdo e copy. Vou manter o nome do arquivo para não tocar nas 5 páginas que importam).

Mudanças internas:
- Header: ícone `Gauge` (em vez de `Sparkles`), título **"Visão geral"**, sem "AI".
- Bloco 1 — Saúde: label **"Saúde do negócio"** + `HealthScoreBadge`. Sub-scores renomeados: `enrollment`→"Inscrições", `revenue`→"Receita", `occupancy`→"Ocupação", `engagement`→"Engajamento". `orkym_adoption` **omitido** da UI.
- Bloco 2 — Alertas: usa o título humano via mapa (fallback para `alert.title` original do backend).
- Bloco 3 — **substitui "Oportunidades" + "Próxima melhor ação"** por uma única lista **"O que fazer agora"**. Para cada `recommendation` (no máx 3, NBA primeiro):
  - 1 linha de problema (humano, derivado de `kind`/title).
  - 1 botão único com rótulo humano do mapa (ex.: "Divulgar torneio").
  - Sem badges técnicas (`action_type`, `impact`, `effort` removidos da UI).
  - Estado: ocioso → loading "Iniciando…" → sucesso (cartão muda para "Pronto. Estamos cuidando disso." com check verde, sem botão).
- Estados vazios: "Tudo certo por aqui." (sem mencionar score/IA).
- Loading inicial: "Carregando…" (sem "Sintetizando visão executiva").
- Erro: "Não foi possível carregar agora. Tente novamente." (sem detalhe técnico).

## 3. Execução invisível

A função `executeRec` continua chamando `invokeOrkym('growth','decide', ...)` exatamente como hoje (zero mudança no backend, guardrails preservados). Só muda o feedback ao usuário:

```text
onClick      → toast.loading("Estamos cuidando disso…") + cartão em loading
res.ok      → toast.success(<frase humana do mapa>) + cartão em estado "feito"
res.ok && actions_proposed === 0  → toast("Tudo já está sob controle.")
!res.ok      → toast.error("Não conseguimos agora. Tente novamente em instantes.")
```

Sem mostrar `actions_proposed`, sem mencionar "proposta", "ORKYM", "ação", "decisão".

## 4. Sem configuração exposta

- Remover qualquer hint de parâmetros/budget/strategy do painel (já não havia, manter assim).
- O `BudgetEditor` e `GrowthDashboardPanel` continuam existindo onde estão (admin/tenant) — **não são tocados nesta fase**, pois são telas internas separadas. Apenas o `OverviewPanel` (Control Tower visível ao usuário comum) fica 100% limpo.

## 5. Backend / dados

- **Nada muda** em SQL, RPC, edge functions, guardrails, atribuição de receita, budgets ou ORKYM.
- O hook `useControlTowerSummary` permanece igual — só o consumidor (painel) reinterpreta as chaves.

## Arquivos afetados

- **Criar**: `src/lib/controlTowerCopy.ts` (mapas action_type/kind → label + feedback humano).
- **Reescrever**: `src/components/control-tower/ControlTowerAIPanel.tsx` (mantém nome e API pública: mesmas props `scope` + `tenantId`).
- **Atualizar memória**: `mem/features/control-tower-ai.md` (anotar que a UI é não-técnica e que `orkym_adoption` não é exibido).
- **Não tocar**: `useControlTowerSummary.ts`, `HealthScoreBadge.tsx`, as 5 páginas que montam o painel, qualquer SQL/edge.

## Critério de aceitação

- Nenhuma string visível contém "ORKYM", "IA", "AI", "decisão", "proposta", "action_type", "score" técnico, "config".
- Cada recomendação aparece como: 1 problema + 1 botão humano + 1 clique.
- Toasts são frases naturais ("Estamos divulgando seu torneio agora").
- Backend, RPC e guardrails continuam idênticos — só a casca muda.
