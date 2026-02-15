

# Sistema de Chaveamentos por Modalidade - Mood Play

## Resumo

Reimplementar completamente a pagina de chaveamentos com suporte a multiplas modalidades por torneio, visual bracket premium inspirado na referencia, e fluxo inteligente para organizador e publico.

---

## 1. Novas Tabelas no Banco de Dados

### `tournament_modalities`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tournament_id | uuid | FK para tournaments |
| name | text | Ex: "Dupla Mista", "Trio Feminino" |
| type | text | individual, dupla, trio, equipe |
| status | text | open, closed, bracket_generated, finished |
| bracket_format | text | single_elimination, double_elimination, round_robin, groups |
| num_groups | integer | Quantidade de grupos (se aplicavel) |
| created_at | timestamptz | |

### `modality_entries`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| modality_id | uuid | FK para tournament_modalities |
| name | text | Nome da equipe/dupla (gerado automaticamente) |
| seed | integer | Cabeca de chave (opcional) |
| created_at | timestamptz | |

### `modality_entry_members`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| entry_id | uuid | FK para modality_entries |
| user_id | uuid | Referencia ao jogador |

### `modality_groups`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| modality_id | uuid | FK para tournament_modalities |
| group_name | text | A, B, C... |

### `modality_group_members`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| group_id | uuid | FK para modality_groups |
| entry_id | uuid | FK para modality_entries |

### `modality_matches`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| modality_id | uuid | FK |
| group_id | uuid | Nullable - se fase de grupos |
| round_number | integer | |
| match_number | integer | |
| entry_a_id | uuid | Nullable - FK para modality_entries |
| entry_b_id | uuid | Nullable |
| score_a | integer | Nullable |
| score_b | integer | Nullable |
| winner_entry_id | uuid | Nullable |
| status | text | scheduled, in_progress, finished |
| created_at | timestamptz | |

### `modality_placements`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| modality_id | uuid | FK |
| entry_id | uuid | FK |
| position | integer | 1 a 4 |

### `modality_prizes`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| modality_id | uuid | FK |
| position | integer | 1 a 4 |
| amount | numeric | Valor em R$ |
| description | text | Descricao do premio |

### Politicas RLS

Todas as novas tabelas terao:
- **SELECT publico** (true) - dados de chaveamento sao publicos
- **INSERT/UPDATE/DELETE** restritos a organizador do torneio (`is_tournament_owner`) ou admin (`is_admin`)

---

## 2. Nova Rota

```text
/tournaments/:id/brackets  (reescrita completa)
```

A rota existente sera substituida pela nova implementacao. A rota de Results tambem sera absorvida dentro da nova pagina (aba "Jogos/Resultados").

---

## 3. Arquitetura de Componentes

```text
src/pages/Brackets.tsx (reescrito - pagina principal)
src/components/brackets/
  ModalityCard.tsx          -- Card de modalidade na lista
  ModalityDetail.tsx        -- Container com abas da modalidade
  TabEntries.tsx            -- Aba Inscritos
  TabGroups.tsx             -- Aba Grupos
  TabBracketView.tsx        -- Aba Chaveamento (visual bracket)
  BracketConnector.tsx      -- Componente de bracket visual com conectores SVG
  TabMatches.tsx            -- Aba Jogos/Resultados
  TabPlacements.tsx         -- Aba Top 4 e Premiacao
  TabPartners.tsx           -- Aba Parceiros
  GenerateBracketDialog.tsx -- Modal para organizador gerar chaveamento
  ScoreEntryDialog.tsx      -- Modal para lancar resultado de partida
```

---

## 4. Fluxo da Pagina

### 4.1 Tela Inicial - Lista de Modalidades

**Header**: Nome do torneio, local, data, botao Voltar para `/tournaments/:id`

**Grid de modalidades**: Cards com nome, tipo (dupla/trio/etc), total de inscritos, badge de status (Inscricoes abertas / Em andamento / Finalizado), botao "Ver"

**Organizador/Admin ve extra**: Botao "Adicionar modalidade" no topo

### 4.2 Detalhe da Modalidade (ao clicar)

Transicao suave (framer-motion fade+slide). Exibe abas:

**Inscritos**: Grid de cards com avatar circular, nome dos membros da entry, badge de nivel. Contador total no topo.

**Grupos**: Se modalidade tem grupos, cards por grupo (A, B, C) com entries dentro. Tabela de classificacao com V/D/Pts.

**Chaveamento**: Bracket visual em CSS Grid com conectores SVG. Rounds em colunas, confrontos empilhados verticalmente. Fotos dos atletas, nomes abreviados, placar se finalizado. Vencedor destacado em verde (#2BFF88). Fallback em modo tabela para telas pequenas.

**Jogos/Resultados**: Lista de partidas como cards. Entry A vs Entry B, placar, status badge. Organizador ve botao "Lancar resultado" em cada partida.

**Top 4 e Premiacao**: Cards grandes para posicoes 1-4 com emoji de medalha, fotos, nomes, pontos bonus (+80, +50, +30, +10). Premiacao em R$ se cadastrada.

**Parceiros**: Faixa horizontal com logos das empresas parceiras do torneio. Link para marketplace.

### 4.3 Acoes do Organizador (dentro da mesma tela)

Detectadas via `tournament.organizer_id === user.id` ou `is_admin`:

1. **Gerar chaveamento** - Dialog com selecao de formato, quantidade de grupos, botao "Gerar automaticamente"
2. **Lancar resultado** - Dialog por partida com campos de placar e selecao de vencedor. Ao salvar, avanca vencedor no bracket automaticamente
3. **Finalizar modalidade** - Define Top 4, aplica bonus de pontos, atualiza status

---

## 5. Bracket Visual (CSS Grid + SVG)

Inspirado na imagem de referencia:

- Fundo escuro (#050708)
- Cards dos confrontos com gradiente sutil (borda #2BFF88 para vencedor)
- Conectores SVG brancos/cinza entre rounds
- Layout responsivo: horizontal em desktop, scroll horizontal em mobile
- Cada round e uma coluna CSS Grid
- Confrontos centralizados verticalmente com espacamento proporcional

```text
ROUND 1        ROUND 2        FINAL
[A vs B] ──┐
            ├── [W1 vs W2] ──┐
[C vs D] ──┘                  ├── [CAMPEAO]
[E vs F] ──┐                  │
            ├── [W3 vs W4] ──┘
[G vs H] ──┘
```

---

## 6. Detalhes Tecnicos

### Migracao SQL
- Criar 7 novas tabelas com RLS
- Criar funcao auxiliar `is_modality_tournament_owner` para simplificar politicas
- Manter tabelas antigas (`match_results`) intactas para compatibilidade

### Animacoes (framer-motion)
- Transicao entre lista de modalidades e detalhe: fade + slideY
- Skeleton loaders durante carregamento
- Badges com cores por status

### Dados
- Pagina publica (sem exigir login para visualizar)
- Organizador precisa estar logado para acoes de gestao
- Perfis dos membros carregados em batch via `profiles` table

### Compatibilidade
- Pagina antiga de Brackets sera substituida
- Pagina de Results sera absorvida (funcionalidade movida para aba "Jogos/Resultados")
- Links no admin (`AdminTournaments.tsx`) continuarao funcionando pois a rota e a mesma

---

## 7. Arquivos Modificados/Criados

**Criados (novos):**
- `src/components/brackets/ModalityCard.tsx`
- `src/components/brackets/ModalityDetail.tsx`
- `src/components/brackets/TabEntries.tsx`
- `src/components/brackets/TabGroups.tsx`
- `src/components/brackets/TabBracketView.tsx`
- `src/components/brackets/BracketConnector.tsx`
- `src/components/brackets/TabMatches.tsx`
- `src/components/brackets/TabPlacements.tsx`
- `src/components/brackets/TabPartners.tsx`
- `src/components/brackets/GenerateBracketDialog.tsx`
- `src/components/brackets/ScoreEntryDialog.tsx`

**Modificados:**
- `src/pages/Brackets.tsx` - reescrita completa
- `src/App.tsx` - manter rota existente (nenhuma mudanca necessaria)
- Migracao SQL para novas tabelas

