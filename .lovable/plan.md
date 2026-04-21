

# Fase 11.4 — Organizer Event Engine (UX-only)

> **Princípio**: zero banco, zero edge, zero RLS, zero ORKYM. Apenas reorganizar `/organizer/*` para que o Organizer deixe de parecer "tenant admin" e passe a ser o motor de eventos. Toda rota legacy (`/organizer/settings`, `/organizer/members`, `/organizer/arenas`, `/organizer/domains`, `/organizer/payment`, `/organizer/finance`) permanece intacta.

---

## Diagnóstico atual (resumido)

- `OrganizerShell` (Fase 11.1) existe mas **não está montado em `App.tsx`** — `/organizer` ainda usa `OrganizerLayout` (tenant-flavored: branding, domínios, pagamento).
- `OrganizerSidebar` lista itens para `/organizer/torneios`, `/organizer/inscricoes`, `/organizer/jogos` que **não existem como rota**.
- Não há `OrganizerDashboard` próprio — fluxo cai em `OrganizerSettings`.
- Lógica de eventos do organizer já existe espalhada: `Dashboard.tsx` (tourns por `organizer_id`), `ManageTournament` (enrollments/check-in), `Brackets`, `TabCheckin`, `Tournaments`.

---

## 1. Os 5 blocos do Organizer Dashboard

Nova página `src/pages/organizer/OrganizerDashboard.tsx` (única tela nova — wrapper de leitura, reusa queries de `Dashboard.tsx` e `ManageTournament`):

```text
┌─────────────────────────────────────────────────────────────┐
│ HEADER — "Event Control Tower" + nome organizer + ↻         │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 1 — EVENT CONTROL TOWER (DOMINANTE)                   │
│ ├─ KPI grid: Eventos ativos · Próximos · Inscritos hoje ·   │
│ │   Check-ins pendentes · Partidas próximas · Alertas       │
│ └─ Strip alertas (eventos sem categorias, sem partidas etc) │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 2 — MEUS EVENTOS                                      │
│ ├─ Cards (top 6): nome, arena, datas, status, inscrições    │
│ └─ Atalhos: Ver · Editar (manage) · Brackets · Inscrições   │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 3 — INSCRIÇÕES (resumo agregado)                      │
│ ├─ KPIs: Total · Pendentes · Pagas · Confirmadas · Check-in │
│ └─ Lista 5 últimas inscrições (todas tourns do organizer)   │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 4 — OPERAÇÃO DE JOGOS                                 │
│ ├─ Eventos em andamento → atalho Brackets / Match / Resul.  │
│ └─ Próximas partidas (se já houver match_results agendado)  │
├─────────────────────────────────────────────────────────────┤
│ BLOCO 5 — PERFORMANCE                                       │
│ ├─ KPIs por evento: ocupação · receita estimada (já exists) │
│ └─ Atalho: Financeiro do organizer                          │
└─────────────────────────────────────────────────────────────┘
```

**Queries (todas já existem em outras telas)**:
- `tournaments` filtrado por `organizer_id = user.id`
- `enrollments` agregado por torneios do organizer
- `tournament_modalities` / `match_results` para jogos próximos (mesmo padrão de `Brackets.tsx`)
- `arena_operational_tasks` filtradas por arena vinculada (opcional, leve)

**Helpers locais ao arquivo** (não exportados): `SectionHeader`, `KpiCard`, `EventCard`, `ShortcutLink` — mesmo padrão visual das Fases 11.2 e 11.3.

---

## 2. Montar `OrganizerShell` no roteamento (aditivo)

Em `src/App.tsx`, adicionar **bloco paralelo** `/organizer/dashboard/*` que usa `OrganizerShell` (a sidebar nova). O bloco legacy `/organizer/*` (com `OrganizerLayout` tenant-flavored) **permanece intacto**.

```text
+ <Route path="/organizer/dashboard" element={<OrganizerShell />}>
+   <Route index element={<OrganizerDashboard />} />
+   <Route path="eventos" element={<Tournaments />} />
+   <Route path="criar" element={<CreateTournament />} />
+   <Route path="inscricoes" element={<OrganizerDashboard />} />  /* âncora #inscricoes */
+   <Route path="jogos" element={<OrganizerDashboard />} />        /* âncora #jogos */
+   <Route path="performance" element={<OrganizerDashboard />} />  /* âncora #performance */
+   <Route path="financeiro" element={<OrganizerFinance />} />
+ </Route>
  /* legacy bloco /organizer permanece intacto */
```

Sem rota nova de página real além do dashboard. "Inscrições/Jogos/Performance" são âncoras dentro do mesmo dashboard (mesmo padrão da Fase 11.3 para `/tenant`).

---

## 3. Nova `OrganizerSidebar` (substitui a atual)

Reescrever `src/layouts/sidebars/OrganizerSidebar.tsx` removendo qualquer eco de tenant admin (sem branding, domínios, membros, arenas globais, pagamento global) e refletindo missão "operador de eventos":

| Grupo | Itens | Destino |
|---|---|---|
| **Event Control Tower** | Dashboard | `/organizer/dashboard` |
| **Eventos** | Meus eventos · Criar evento | `/organizer/dashboard` (#eventos) · `/tournaments/create` |
| **Inscrições** | Inscrições | `/organizer/dashboard/inscricoes` |
| **Jogos** | Jogos & Brackets | `/organizer/dashboard/jogos` |
| **Check-in** | Check-in | `/organizer/dashboard#checkin` |
| **Performance** | Performance | `/organizer/dashboard/performance` |
| **Financeiro** | Financeiro do evento | `/organizer/dashboard/financeiro` |

Configurações administrativas (settings/branding/dominios/payment/members/arenas) **não aparecem** nesta sidebar — elas continuam acessíveis em `/organizer/*` legacy se o usuário for também tenant admin.

---

## 4. Pequeno ajuste no `OrganizerShell`

`src/layouts/OrganizerShell.tsx` — trocar legenda do header "Organizador" por "Organizador de eventos" (1 string). Guard de role (`organizer` | `admin`) permanece.

---

## 5. Convergência opcional do `ProfileSwitcher`

`src/components/feed/ProfileSwitcher.tsx` — atalho `organizer` muda destino de `/organizer` para `/organizer/dashboard` (1 linha). Legacy `/organizer` continua respondendo (cai em `/organizer/settings`).

---

## 6. Naming (apenas labels)

| Antes | Depois |
|---|---|
| "Meus Torneios" (sidebar) | "Meus eventos" |
| "Todos Torneios" | (removido da sidebar do organizer; vive em `/tournaments` público) |
| "Criar Torneio" | "Criar evento" |
| "Jogos / Brackets" | "Jogos & Brackets" |
| "Configurações" (sidebar) | (removido do shell de eventos) |
| Header "Organizador" | "Organizador de eventos" |

URLs legacy não mudam.

---

## 7. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/pages/organizer/OrganizerDashboard.tsx` (~280 linhas, leitura) |
| Edit | `src/App.tsx` — adicionar bloco `/organizer/dashboard/*` (legacy `/organizer/*` intacto) |
| Edit | `src/layouts/sidebars/OrganizerSidebar.tsx` — reescrever 6 grupos focados em eventos |
| Edit | `src/layouts/OrganizerShell.tsx` — relabel header (1 string) |
| Edit | `src/components/feed/ProfileSwitcher.tsx` — 1 linha (atalho organizer) |
| Memory | `mem/features/organizer-event-engine.md` (novo) |

**Total**: 1 arquivo novo, 4 edits mínimos, 1 memory.

---

## 8. Garantias de não-regressão

- `/organizer`, `/organizer/settings`, `/organizer/members`, `/organizer/arenas`, `/organizer/domains`, `/organizer/payment`, `/organizer/finance` — todos intocados.
- `/tournaments/:id/manage`, `/tournaments/:id/brackets`, `/tournaments/:id/results`, `/tournaments/create` — intocados.
- `/tenant/*`, `/arena/*`, `/admin/*`, `/athlete/*`, `/company/*` — intocados.
- Nenhuma migration, nenhuma RLS, nenhum edge, nenhum tipo Supabase novo.
- Build TS: limpo (mesmo padrão de cast `as any` para joins quando necessário).

---

## 9. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Reaproveitado | Queries de `Dashboard.tsx` (organizer_id), `ManageTournament` (enrollments), `Brackets` (modalities/matches), `Tournaments`, `OrganizerFinance`, padrão visual das Fases 11.2/11.3 |
| Reorganizado | Shell `/organizer/dashboard` montado pela primeira vez; sidebar reescrita com missão "event engine" |
| Renomeado | "Torneios" → "Eventos"; header "Organizador" → "Organizador de eventos"; "Configurações" removido do shell de eventos |
| Deixou de parecer tenant admin | Sidebar agora não tem branding/domínios/membros/arenas globais/pagamento; apenas operação de eventos |
| Para subfases | Inscrições/Jogos/Performance ainda são âncoras — viram páginas dedicadas em 11.5+ |

## 10. ENTREGA C — Pendências

- **11.5**: rota dedicada `/organizer/dashboard/inscricoes` com tabela completa (não só resumo)
- **11.6**: rota dedicada `/organizer/dashboard/jogos` com agenda visual e conflitos de quadra
- **11.7**: rota dedicada `/organizer/dashboard/performance` com gráficos 30d
- **11.8**: WhatsApp para organizer (lembrete de check-in, alerta de inscrições paradas, briefing pré-evento)
- **11.9**: separar definitivamente `/organizer` legacy do tenant admin via redirect 301 para `/tenant/*` quando user for tenant admin
- **11.10**: deprecar `/dashboard` legacy (que ainda é usado por organizer simples)

## 11. Critério de sucesso

- ✅ `/organizer/dashboard` existe e mostra os 5 blocos (Event Control Tower dominante)
- ✅ Organizer entende rapidamente: eventos ativos, inscrições, jogos próximos, check-ins pendentes
- ✅ Sidebar do `OrganizerShell` reflete missão "operador de eventos" (sem branding/domínios/etc)
- ✅ Todas as rotas legacy `/organizer/*` continuam funcionando
- ✅ Zero migration, zero edge, zero RLS, zero ORKYM bridge alterado
- ✅ Build limpo

