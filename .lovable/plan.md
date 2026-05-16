# Torneios Operational Flow

Objetivo: tornar `/tournaments/:id/manage` a **Central do Torneio** — uma página única, mobile-first, sem termos técnicos — reaproveitando 100% do que já existe (`enrollments`, `tournament_modalities`, `modality_entries`, `match_results`, edge `generate-bracket`, tabs em `src/components/brackets/`).

Sem novas tabelas. Sem novo backend. Sem expor IA/ORKYM. Sem refazer bracket no client.

---

## 1. Central do Torneio (página única)

Reescrever `src/pages/ManageTournament.tsx` para um único hub com:

- Header: nome, hero, data, arena, status, botões "Divulgar" (copia link + Web Share) e "Ver página pública".
- **StageProgress** (componente novo): 6 etapas — Inscrições · Check-in · Grupos · Jogos · Finais · Encerrado. Etapa ativa é derivada de dados (`tournament.status`, presença de `modality_entries`, `match_results`, vencedor final). Cada etapa mostra ícone + label + status (✓ feito / ● ativa / ○ futura) e, na etapa ativa, um botão grande "Próxima ação" (`PrimaryActionButton`).
- Abas: **Resumo · Inscritos · Check-in · Grupos · Jogos · Chave · Pódio**.
- Configurações do torneio continuam dentro do `Collapsible` "Editar" (já existe).
- Manter rota `/tournaments/:id/manage` como verdade única. Adicionar **redirects** de `/arena/dashboard/torneios/:id` e `/organizer/dashboard/eventos/:id` para a mesma página (mais simples que duplicar shell).

### Próxima ação (regra)

| Etapa ativa            | Botão                          | Ação                                                    |
| ---------------------- | ------------------------------ | ------------------------------------------------------- |
| Inscrições abertas     | Divulgar torneio               | Web Share + WhatsApp + copia link                       |
| Inscrições quase cheias| Abrir check-in                 | muda `tournament.status` para `checkin`                 |
| Check-in               | Sortear grupos                 | abre tab Grupos com `GenerateBracketDialog`             |
| Grupos sorteados       | Gerar jogos                    | `generate-bracket` (já existe) por modalidade           |
| Jogos                  | Registrar resultado            | abre tab Jogos                                          |
| Finais                 | Publicar pódio                 | abre tab Pódio                                          |
| Encerrado              | Compartilhar pódio             | Web Share                                               |

---

## 2. Reuso direto das abas existentes

`src/components/brackets/Tab*.tsx` já cobrem o essencial. Vamos **renomear visualmente** (sem mexer no código interno) e plugá-las nas abas da Central:

- **Inscritos** → nova `TabInscritos` que substitui o bloco atual de Pagos/Pendentes/Expirados em `ManageTournament`. Lista unificada vinda de `enrollments` JOIN `modality_entry_members` (via `entry_id`) → garante "uma única verdade" (memória `tournament-enrollment-fix`). Colunas: nome, categoria, dupla/equipe, pagamento, check-in, telefone (se permitido). Ações por linha: confirmar manualmente, lembrete (`enqueue_enrollment_reminder` já existe), `wa.me/{phone}`, remover.
- **Check-in** → reusar `TabCheckin` existente; adicionar no topo card "QR do torneio" reaproveitando `FullscreenQRDialog` da Fase Arena. Botões: Compartilhar QR, Confirmar presença manual.
- **Grupos** → reusar `TabGroups` + `GenerateBracketDialog`. Esconder labels "modality/seed/phase" via cópia (cabeçalho passa a ser "Categoria", "Posição").
- **Jogos** → reusar `TabMatches` com filtros "Próximos / Em andamento / Finalizados". Botão por jogo: Registrar placar (`ScoreEntryDialog`), Alterar horário/quadra, Avisar jogadores (`wa.me` deep link com nomes).
- **Chave** → reusar `TabBracketView`.
- **Pódio** → reusar `TabPlacements`; adicionar botões "Publicar resultado" (insere evento social) e "Compartilhar pódio".

Esconder a tab "Categorias" técnica atual (continua acessível via Editar).

---

## 3. Lista de torneios (Arena/Organizer)

Refinar `ArenaTournaments.tsx` e a lista em `OrganizerDashboard` ("Meus eventos"):

- Cada card: nome, data, modalidade, status (pill colorida), `inscritos/vagas`, nº de categorias, **próxima ação** derivada da mesma regra acima.
- Ações: Abrir (→ Central), Divulgar (share), Ver inscritos (→ Central tab=inscritos).
- Remover jargão ("max_slots" → "Vagas", "modality" → "Categoria").

---

## 4. Experiência do atleta — "Meu jogo"

Já existe `src/components/athlete/MyNextMatchCard.tsx`. Garantir que aparece em:

- `AthleteDashboard` (topo, quando houver próximo jogo).
- `Profile` do atleta logado.
- `TournamentDetail` quando o usuário logado está inscrito (card sticky no topo).

Conteúdo: torneio, categoria, próximo adversário, horário, quadra, status check-in, botão "Abrir meu QR" (reusa fullscreen QR), botão "Abrir conversa do jogo" se já existir match chat.

---

## 5. Página pública (`TournamentDetail.tsx`)

Refinar mobile-first:

- Hero com `cover_image`, logo da arena, título, data, cidade.
- Blocos: Sobre · Categorias (vagas/preço) · Inscritos (se torneio marcado público) · Grupos (se publicados) · Jogos · Resultados.
- CTA fixo no rodapé mobile: "Inscrever-se" + "Compartilhar".
- Esconde blocos vazios; sem mensagens técnicas.

---

## 6. Empty states (cópia consistente)

Criar `src/components/tournament/EmptyState.tsx` reutilizado nas abas:

- Inscritos vazios: "Seu torneio ainda não tem inscritos." → Divulgar
- Sem grupos: "Quando as inscrições fecharem, você poderá sortear os grupos." → Sortear grupos (desabilitado até check-in fechar)
- Sem jogos: "Os jogos ainda não foram gerados." → Gerar jogos
- Sem placares: "Registre os placares para atualizar o chaveamento."
- Sem pódio: "O pódio aparece quando a final terminar."

---

## 7. WhatsApp / avisos (sem IA)

Apenas links `wa.me` e o RPC `enqueue_enrollment_reminder` que já existe:

- "Avisar jogadores" em cada jogo → abre wa.me com texto pronto (horário/quadra).
- "Enviar lembrete" em inscrito pendente → RPC existente.
- "Compartilhar torneio" → Web Share API + fallback wa.me.

Nenhuma menção a ORKYM/IA/tokens.

---

## 8. Feed social

Os triggers de eventos sociais (`social_events`) para inscrição paga, check-in e resultado **já existem no backend**. Vamos apenas:

- Garantir que `TabPlacements` chame o RPC/insert de evento "campeão" ao publicar pódio (se ainda não chama).
- Não mexer em privacidade default.

---

## 9. Não fazer

- Sem nova tabela, sem migration.
- Sem lógica de bracket no client (continua via edge `generate-bracket`).
- Sem nova rota técnica; consolidar tudo em `/tournaments/:id/manage`.
- Sem ORKYM/IA/análises avançadas.
- Sem mexer em `Brackets.tsx` standalone (continua acessível, mas Central passa a ser o caminho principal).

---

## Arquivos previstos

**Novos**
- `src/components/tournament/StageProgress.tsx`
- `src/components/tournament/PrimaryActionButton.tsx`
- `src/components/tournament/TabInscritos.tsx` (unifica enrollment + entry + member)
- `src/components/tournament/TabPodio.tsx` (wrapper de `TabPlacements` com ações)
- `src/components/tournament/EmptyState.tsx`
- `src/lib/tournamentStage.ts` (derivar etapa atual + próxima ação)

**Editados**
- `src/pages/ManageTournament.tsx` (reestrutura completa com tabs)
- `src/pages/TournamentDetail.tsx` (refino público mobile-first + CTA sticky)
- `src/pages/Tournaments.tsx` / `ArenaTournaments.tsx` / `OrganizerDashboard.tsx` (cards com próxima ação)
- `src/pages/athlete/AthleteDashboard.tsx` (garantir `MyNextMatchCard`)
- `src/pages/Profile.tsx` (mostrar `MyNextMatchCard` quando atleta)
- `src/App.tsx` (redirects `/arena/dashboard/torneios/:id` e `/organizer/dashboard/eventos/:id` → `/tournaments/:id/manage`)
- `src/components/brackets/TabGroups.tsx` / `TabMatches.tsx` (apenas cópia: "Categoria", "Posição", filtros próximos/andamento/finalizados; sem mudar lógica)
- `.lovable/plan.md`

## Critério de sucesso

- Uma página resolve criar → divulgar → inscritos → check-in → grupos → jogos → chave → pódio.
- Barra de progresso sempre indica próxima ação.
- Atleta vê "Meu jogo" em dashboard, perfil e página do torneio.
- Lista de inscritos vem do fluxo único `enrollment → modality → entry → member`.
- Mobile-first, botões grandes, zero termos técnicos visíveis.
