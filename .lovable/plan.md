

# Fase 11.5 — Athlete Experience (UX-only)

> **Princípio**: zero banco, zero edge, zero RLS, zero ORKYM. Apenas reorganizar `/athlete/*` para que o atleta tenha um perfil esportivo vivo, mobile-first e orientado à ação. Toda rota legacy (`/profile`, `/feed`, `/tournaments`, `/ranking`, `/messages`) permanece intacta.

---

## Diagnóstico atual

- `AthleteShell` já existe (Fase 11.1) e está montado em `/athlete/*` em `App.tsx`.
- `AthleteSidebar` tem apenas 1 grupo plano com 5 itens (Meu Perfil, Feed, Torneios, Ranking, Mensagens) — todos apontando para reuso direto de páginas legacy.
- Não há `AthleteDashboard` próprio: `/athlete/perfil` cai em `Profile.tsx` (que mistura organizer/wallet — pesado para atleta).
- Lógica esportiva já existe espalhada: `AthleteActivities` (componente), `enrollments`, `match_results`, `tournament_modalities`, `athlete_activities`, `Explore`, `AthletesList`, `Ranking`.

---

## 1. Os 5 blocos do Athlete Dashboard

Nova página `src/pages/athlete/AthleteDashboard.tsx` (única tela nova — wrapper de leitura, mobile-first, reusa queries existentes):

```text
┌─────────────────────────────────────────────────────────┐
│ BLOCO 1 — ATHLETE HERO (DOMINANTE)                      │
│ ├─ Avatar grande · Nome · Nickname · Cidade/Time/Arena  │
│ ├─ Mini KPIs: Torneios · Vitórias · Check-ins · Posição │
│ └─ CTAs: Ver torneios · Check-in · Meus jogos           │
├─────────────────────────────────────────────────────────┤
│ BLOCO 2 — MEU ESPORTE HOJE                              │
│ ├─ Próximo jogo (se houver) com hora/quadra             │
│ ├─ Check-ins pendentes (torneios já inscrito)           │
│ └─ Torneios futuros (próximos 7d, max 3)                │
├─────────────────────────────────────────────────────────┤
│ BLOCO 3 — TORNEIOS E JOGOS                              │
│ ├─ Torneios em andamento · Inscrições pagas             │
│ ├─ Partidas recentes (últimas 5)                        │
│ └─ Atalhos: Todos torneios · Meus jogos                 │
├─────────────────────────────────────────────────────────┤
│ BLOCO 4 — RANKING E HISTÓRICO                           │
│ ├─ Posição atual no ranking · Pontos                    │
│ └─ AthleteActivities (últimas 10) [reuso componente]    │
├─────────────────────────────────────────────────────────┤
│ BLOCO 5 — DISCOVERY                                     │
│ ├─ Arenas próximas · Torneios abertos · Atletas         │
│ └─ Atalhos: Explore · Feed · Marketplace                │
└─────────────────────────────────────────────────────────┘
```

**Queries (todas já existem)**:
- `profiles` + `athlete_profiles` (athlete-specific)
- `enrollments` filtrado por `user_id = user.id` + join `tournaments`
- `match_results` filtrado por `winner_id`/`loser_id` ou via `tournament_entries`
- `athlete_activities` (componente já pronto)
- `arenas_public`, `tournaments` open enrollment, `athletes_public` para discovery

**Helpers locais ao arquivo** (não exportados): `SectionHeader`, `KpiPill`, `MatchCard`, `TournamentRow`, `ShortcutLink` — mesmo padrão visual das Fases 11.2/11.3/11.4 mas adaptado para mobile-first (cards verticais, CTAs grandes).

---

## 2. Novas rotas (aditivas) em `App.tsx`

Reorganizar bloco `/athlete`:

```text
<Route path="/athlete" element={<AthleteShell />}>
+ <Route index element={<Navigate to="/athlete/dashboard" replace />} />
+ <Route path="dashboard" element={<AthleteDashboard />} />
  <Route path="perfil" element={<Profile />} />          /* mantém */
+ <Route path="meu-dia" element={<AthleteDashboard />} /> /* âncora #hoje */
  <Route path="torneios" element={<Tournaments />} />     /* mantém */
+ <Route path="jogos" element={<AthleteDashboard />} />   /* âncora #jogos */
  <Route path="ranking" element={<Ranking />} />          /* mantém */
+ <Route path="historico" element={<AthleteDashboard />}/> /* âncora #historico */
+ <Route path="descobrir" element={<Explore />} />
  <Route path="feed" element={<Feed />} />                /* mantém */
  <Route path="mensagens" element={<Messages />} />       /* mantém */
</Route>
```

Inscrições/Jogos/Histórico são **âncoras dentro do dashboard** (mesmo padrão das fases anteriores). `Explore` é reusado para Descobrir.

---

## 3. Nova `AthleteSidebar` (substitui a atual — 5 grupos)

| Grupo | Itens | Destino |
|---|---|---|
| **Meu Perfil** | Dashboard · Meu perfil | `/athlete/dashboard` · `/athlete/perfil` |
| **Meu Dia** | Hoje · Mensagens | `/athlete/meu-dia` · `/athlete/mensagens` |
| **Torneios** | Torneios · Meus jogos | `/athlete/torneios` · `/athlete/jogos` |
| **Ranking & Histórico** | Ranking · Histórico | `/athlete/ranking` · `/athlete/historico` |
| **Descobrir** | Descobrir · Feed | `/athlete/descobrir` · `/athlete/feed` |

Ícones: `LayoutDashboard`, `User`, `Sun`, `MessageSquare`, `Trophy`, `Swords`, `Medal`, `History`, `Compass`, `Rss`.

---

## 4. Polimento `AthleteShell`

`src/layouts/AthleteShell.tsx` — trocar legenda do header "Atleta" por "Atleta · Mood Play" (1 string). Guard intacto.

---

## 5. Convergência opcional do `ProfileSwitcher`

`src/components/feed/ProfileSwitcher.tsx` — atalho `athlete` aponta para `/athlete/dashboard` (1 linha). Legacy continua respondendo via redirect do index.

---

## 6. Naming (apenas labels)

| Antes | Depois |
|---|---|
| Header "Atleta" | "Atleta · Mood Play" |
| "Meu Perfil" (sidebar único item) | grupo "Meu Perfil" com Dashboard + Perfil |
| "Feed" como item top | movido para grupo "Descobrir" |
| "Mensagens" | movido para grupo "Meu Dia" |
| (não existia) | "Hoje", "Meus jogos", "Histórico", "Descobrir" |

URLs legacy não mudam.

---

## 7. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/pages/athlete/AthleteDashboard.tsx` (~280 linhas, mobile-first, leitura) |
| Edit | `src/App.tsx` — adicionar 5 rotas dentro do bloco `/athlete` (sem remover existentes) + import |
| Edit | `src/layouts/sidebars/AthleteSidebar.tsx` — reescrever em 5 grupos |
| Edit | `src/layouts/AthleteShell.tsx` — relabel header (1 string) |
| Edit | `src/components/feed/ProfileSwitcher.tsx` — 1 linha (atalho athlete) |
| Memory | `mem/features/athlete-experience.md` (novo) |

**Total**: 1 arquivo novo, 4 edits mínimos, 1 memory.

---

## 8. Garantias de não-regressão

- `/profile`, `/feed`, `/tournaments`, `/ranking`, `/messages`, `/explore` — todos intocados.
- `/athlete/perfil`, `/athlete/feed`, `/athlete/torneios`, `/athlete/ranking`, `/athlete/mensagens` — todos continuam respondendo (rotas mantidas).
- `/arena/*`, `/tenant/*`, `/organizer/*`, `/admin/*`, `/company/*` — intocados.
- Nenhuma migration, nenhuma RLS, nenhum edge, nenhum tipo Supabase novo.
- Componente `AthleteActivities` reusado sem alteração.
- Build TS limpo (mesmo padrão de cast `as any` para tabelas/views quando necessário).

---

## 9. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Reaproveitado | `AthleteActivities`, queries de `enrollments`/`match_results`/`tournaments`/`athlete_profiles`, `Explore`, `Ranking`, padrão visual das Fases 11.2/11.3/11.4 |
| Reorganizado | Sidebar de 1 grupo plano → 5 grupos contextuais; index do `/athlete` aponta para dashboard |
| Renomeado | Header "Atleta" → "Atleta · Mood Play"; novos labels: "Hoje", "Meus jogos", "Histórico", "Descobrir" |
| Deixou de parecer genérico | Hero esportivo com KPIs reais (vitórias, check-ins, ranking) ao invés de só nome+avatar; bloco "Hoje" com próximo jogo + check-in |
| Para subfases | Dashboard é leitura — edição continua em `/athlete/perfil` (Profile.tsx); jogos/histórico ainda são âncoras (viram páginas dedicadas em 11.6+) |

## 10. ENTREGA C — Pendências

- **11.6**: rota dedicada `/athlete/jogos` com agenda visual real (calendário) e filtros
- **11.7**: rota dedicada `/athlete/historico` com timeline + estatísticas por modalidade
- **11.8**: WhatsApp para atleta (lembrete de check-in 2h antes, próximo jogo, resultado de partida)
- **11.9**: split do `Profile.tsx` — separar campos organizer/wallet do perfil de atleta puro
- **11.10**: gamificação leve (badges baseados em `athlete_activities` agregado — depende de view nova)
- **11.11**: feed personalizado para atleta (foco em arenas/torneios seguidos)

## 11. Critério de sucesso

- ✅ `/athlete/dashboard` mostra os 5 blocos (Hero dominante + Hoje + Torneios + Ranking + Discovery)
- ✅ Atleta entende rapidamente: identidade esportiva, próximos jogos, check-ins pendentes, ranking, descobrir
- ✅ Sidebar do `AthleteShell` reflete missão "perfil esportivo vivo"
- ✅ Mobile-first (cards verticais, CTAs grandes, sem scroll horizontal)
- ✅ Todas as rotas legacy continuam funcionando
- ✅ Zero migration, zero edge, zero RLS, zero ORKYM bridge alterado

