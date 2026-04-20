

# Refino do módulo de Torneios — estilo Rankup

Transformar o que já existe em uma experiência de **acompanhamento** simples, mobile-first. Sem duplicar nada: reaproveitamos `Brackets.tsx`, `ModalityDetail`, `TabEntries/Groups/Matches/Placements/BracketView` e o `GenerateBracketDialog`. Apenas refinamos UI e adicionamos 2 colunas mínimas no banco para suportar **Vagas** e **Quadras**.

## 1. Auditoria do que já existe (reaproveitado)

| Camada | Arquivo / Tabela | Estado | Ação |
|---|---|---|---|
| Overview do torneio | `src/pages/Brackets.tsx` | OK (lista modalidades) | Refinar header + cards |
| Detalhe da modalidade | `ModalityDetail.tsx` (6 tabs) | OK | Adicionar **card resumo** no topo |
| Inscritos | `TabEntries.tsx` | OK | Adicionar status "Confirmado/Pendente" + grupo |
| Grupos | `TabGroups.tsx` | Lista plana | Substituir por tabela classificação (J/V/D/PF/PC/SG) |
| Bracket visual | `TabBracketView.tsx` | OK | Adicionar zoom + tab "Grupos / Mata-Mata" |
| Partidas | `TabMatches.tsx` | OK | Agrupar por rodada + filtro Grupo/Mata-mata |
| Top 4 | `TabPlacements.tsx` | Grid 2col | Substituir por **Pódio central maior** |
| Geração | `GenerateBracketDialog.tsx` | 4 formatos | Reaproveitado |
| Placar | `ScoreEntryDialog.tsx` | OK | Adicionar opção **BYE** + **Quadra** |
| Tabelas DB | `tournament_modalities`, `modality_*`, `enrollments`, `courts` | OK | +2 colunas mínimas |

**Nada será duplicado.** Nenhuma tabela nova.

## 2. Migration mínima (extensão, não duplicação)

```sql
-- Vagas e horário por modalidade (já temos name/type/status/bracket_format/num_groups)
ALTER TABLE tournament_modalities
  ADD COLUMN IF NOT EXISTS max_entries int,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS sets_to_win int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_per_set int DEFAULT 21,
  ADD COLUMN IF NOT EXISTS sport text DEFAULT 'Vôlei',
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS gender text;

-- Quadra vinculada à partida (reusa courts existente do módulo Arenas)
ALTER TABLE modality_matches
  ADD COLUMN IF NOT EXISTS court_id uuid;

-- Status confirmado/pendente já existe em enrollments.status (enum). Não criar.
```

Sem novas tabelas, sem novas RLS (herdam das existentes via `is_modality_tournament_owner`).

## 3. Telas a refinar (sem criar páginas novas)

### 3.1 `Brackets.tsx` — Tela Geral
**Card principal** no topo (acima da lista):
- Nome do torneio + Etapa (`tournament.name`)
- Datas (`start_date – end_date`)
- Status pill: Inscrições Abertas / Em andamento / Finalizado (derivado de datas)
- Contador "Categorias (N)"

**Cards de categoria** (`ModalityCard.tsx`) reformulados:
- Título da modalidade
- Pills: Esporte • Nível • Gênero • Tipo (Dupla/Quarteto)
- Linha: 🕐 horário • 👥 X/Y equipes
- Pill de status: **Lotado** (X==Y) ou **Aberto**
- Click → modalidade

### 3.2 `ModalityDetail.tsx` — Header card
Adicionar **resumo fixo** acima das tabs:
- Pills (Esporte, Nível, Tipo)
- Grid 2x2: Formato • Equipes (X/Y) • Sets para vencer • Pontos por set

Tabs renomeadas e enxutas: **Inscritos · Grupos · Jogos · Pódio**
(remover "Chaveamento" e "Parceiros" da modalidade — chaveamento vira sub-tab dentro de "Jogos"; parceiros já existem em TournamentDetail).

### 3.3 `TabEntries` — Inscritos
- Lista numerada
- Coluna: nome da equipe + grupo (se sorteado: "Grupo A")
- Pill direita: **Confirmado** (`enrollments.status='paid'`) / **Pendente**
- Toggle topo: "Mostrar gênero"

### 3.4 `TabGroups` — Classificação
Para cada grupo card:
- Header "Grupo A — N equipes" + pill "Completo"
- Tabela: # | Equipe | J | V | D | PF | PC | SG
- Top N classificados (`num_groups` define corte) → linha em **verde** com ícone troféu
- Cálculo dos números feito em frontend a partir de `modality_matches` finalizados do grupo

### 3.5 `TabMatches` — Jogos (com sub-abas)
Sub-tabs internas: **Grupos | Mata-Mata | Lista**
- **Grupos:** filtro por grupo (chips A,B,C,D)
- **Mata-Mata:** reusa `TabBracketView` com controle de zoom (botões −/40%/+)
- **Lista:** rodadas agrupadas (Rodada 1, 2, 3...) — visual igual hoje, status: Em andamento / Finalizada / BYE
- Botão "Editar" abre `ScoreEntryDialog` ampliado (ver 3.7)

### 3.6 `TabPlacements` — Pódio
- Pódio visual: card 1º **central maior** (dourado), 2º esquerda (prata), 3º direita (bronze)
- Linha embaixo: 4º Lugar
- Lista numerada 1–4 abaixo do pódio

### 3.7 `ScoreEntryDialog` — extensão
Adicionar:
- Select **Status da Partida**: Em andamento / Finalizada
- Botões **BYE → Equipe A** / **BYE → Equipe B** (passa direto sem placar)
- Select **Quadra** (lista `courts` da arena do torneio se houver, senão "Sem quadra atribuída")

### 3.8 Quadras (sub-aba opcional dentro de Jogos → Mata-Mata header)
Pequeno bloco "Quadras em uso": chips Quadra 1 (Livre) / Quadra 2 (Em uso: Time X vs Y). Derivado de `modality_matches.court_id` + `status='in_progress'`. Nenhuma tela nova, só um bloco compacto.

## 4. UI/UX

- Mobile-first; cards `rounded-xl border bg-card`
- Pills: `rounded-full px-2.5 py-0.5 text-xs` com cores existentes (`primary/20`, `secondary/20`, `muted`)
- Tipografia: `font-display` (Bebas) nos títulos, `font-sans` no resto
- Hierarquia: título > pills meta > contador > status
- Verde `#2BFF88` (primary) só em: status "Aberto", linhas de classificados, vencedor
- Sem bottom-bar duplicada — `Brackets.tsx` já vive fora do AppLayout (header próprio)

## 5. Arquitetura — sem inteligência local

Nenhum motor de decisão será criado no MoodPlay. Toda lógica de:
- ranking
- otimização de chaveamento
- agendamento automático de quadras
- predição

permanece **delegada a ORKYM** via edge functions existentes. Esta entrega é **apenas UI + render + CRUD básico** (placar, status, BYE, atribuição manual de quadra). O sorteio atual (`GenerateBracketDialog`) continua sendo um shuffle simples — quando ORKYM expuser endpoint de sorteio inteligente, basta trocar a função `generate()` por um `supabase.functions.invoke('orkym-bracket')`.

## 6. Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/<timestamp>_modality_extensions.sql` | novo (só ALTER) |
| `src/pages/Brackets.tsx` | refino header + tournament status |
| `src/components/brackets/ModalityCard.tsx` | redesenho pills+vagas+horário |
| `src/components/brackets/ModalityDetail.tsx` | card resumo + tabs reduzidas |
| `src/components/brackets/TabEntries.tsx` | + status + grupo + toggle |
| `src/components/brackets/TabGroups.tsx` | tabela classificação calculada |
| `src/components/brackets/TabMatches.tsx` | sub-abas Grupos/Mata/Lista + bloco Quadras |
| `src/components/brackets/TabBracketView.tsx` | controles de zoom |
| `src/components/brackets/TabPlacements.tsx` | pódio central |
| `src/components/brackets/ScoreEntryDialog.tsx` | + BYE + Status + Quadra |

**Não criados:** nenhuma página nova, nenhuma tabela nova, nenhuma edge function nova, nenhum motor de IA local.

## 7. Resultado

- Visitante entende o torneio em 3 segundos (status + categorias + vagas)
- Atleta sabe se está confirmado, em qual grupo, quando joga, contra quem
- Organizador continua com os mesmos botões (gerar, lançar placar) + BYE + quadra
- Visual idêntico em peso ao Rankup (pills, contadores, pódio, classificação)

