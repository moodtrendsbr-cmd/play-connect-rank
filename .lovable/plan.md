

# Modulo MATCH -- Matchmaking Esportivo por Torneio

## Resumo

Criar um sistema completo de matchmaking dentro de torneios, permitindo que atletas sem dupla/time encontrem parceiros, conversem via chat interno e se inscrevam juntos. Inclui marketplace de atletas, convites, formacao de parcerias e chat multi-membro.

---

## 1. Migracao SQL (1 migracao)

### Nova coluna em `tournaments`
- `match_enabled` (boolean, default false) -- organizador controla se match esta ativo

### Novas tabelas

**tournament_match_pool**
- id (uuid PK)
- tournament_id (uuid FK tournaments)
- user_id (uuid, NOT NULL)
- match_type (text: dupla, trio, quarteto, time)
- category (text: masc, fem, misto)
- level (text: iniciante, intermediario, avancado)
- position (text, nullable)
- availability (text, nullable)
- bio (text, nullable)
- status (text: looking, matched -- default looking)
- created_at (timestamptz)
- UNIQUE(tournament_id, user_id)

**match_requests**
- id (uuid PK)
- tournament_id (uuid FK tournaments)
- from_user_id (uuid)
- to_user_id (uuid)
- status (text: pending, accepted, rejected -- default pending)
- created_at (timestamptz)

**match_pairs**
- id (uuid PK)
- tournament_id (uuid FK tournaments)
- match_type (text)
- created_at (timestamptz)

**match_pair_members**
- id (uuid PK)
- pair_id (uuid FK match_pairs)
- user_id (uuid)

**match_conversations**
- id (uuid PK)
- pair_id (uuid FK match_pairs, nullable)
- tournament_id (uuid FK tournaments)
- created_at (timestamptz)

**match_conversation_members**
- id (uuid PK)
- conversation_id (uuid FK match_conversations)
- user_id (uuid)

**match_messages**
- id (uuid PK)
- conversation_id (uuid FK match_conversations)
- sender_id (uuid)
- content (text)
- created_at (timestamptz)
- read_at (timestamptz, nullable)

### RLS Policies

- **tournament_match_pool**: SELECT publico (para ver o marketplace), INSERT/UPDATE/DELETE pelo proprio user_id
- **match_requests**: SELECT/INSERT por participantes (from_user_id ou to_user_id), UPDATE por to_user_id (aceitar/recusar)
- **match_pairs / match_pair_members**: SELECT por membros do pair
- **match_conversations / match_conversation_members / match_messages**: SELECT/INSERT por membros da conversa

### Realtime
- Habilitar realtime em `match_messages` e `match_requests`

---

## 2. Pagina de Detalhe do Torneio (TournamentDetail.tsx)

Alteracoes:
- Substituir o botao unico de inscricao por dois botoes quando `match_enabled` for true:
  - "Tenho dupla/time" -- redireciona para `/payment/:id` (fluxo atual)
  - "Procurar parceiros" -- redireciona para `/tournaments/:id/match`
- Manter comportamento atual quando `match_enabled` for false

---

## 3. Pagina do Marketplace de Match

**Rota**: `/tournaments/:id/match`

**Arquivo**: `src/pages/TournamentMatch.tsx`

Funcionalidades:
- Verificar se usuario ja tem perfil no pool; se nao, exibir formulario de criacao de perfil
- Formulario: match_type, category, level, position, availability, bio
- Apos criar perfil, exibir lista de cards de outros atletas com status "looking"
- Filtros: match_type, level, position, category
- Cada card mostra: avatar, nome, categoria, nivel, posicao, botao "Convidar"
- Botao "Convidar" cria registro em match_requests
- Link para ver convites recebidos/enviados

---

## 4. Pagina de Convites

**Rota**: `/tournaments/:id/match/requests`

**Arquivo**: `src/pages/MatchRequests.tsx`

Funcionalidades:
- Duas abas: Recebidos / Enviados
- Recebidos: card com avatar + nome + botoes Aceitar / Recusar
- Enviados: card com avatar + nome + status (pendente/aceito/recusado)
- Ao aceitar:
  1. Atualizar request.status = "accepted"
  2. Criar match_pair + match_pair_members
  3. Atualizar ambos para status "matched" no pool
  4. Criar match_conversation + members
  5. Redirecionar para pagina do pair

---

## 5. Pagina da Parceria

**Rota**: `/tournaments/:id/match/pair`

**Arquivo**: `src/pages/MatchPair.tsx`

Funcionalidades:
- Exibir membros da parceria com avatar e nome
- Botao "Chat" que abre o chat da conversa
- Botao "Inscrever dupla/time" que redireciona para `/payment/:id`
- Info do torneio resumida

---

## 6. Chat do Match

**Rota**: `/tournaments/:id/match/chat/:conversationId`

**Arquivo**: `src/pages/MatchChat.tsx`

Funcionalidades:
- UI identica ao ChatView existente (estilo Instagram DM dark)
- Buscar mensagens de match_messages pela conversation_id
- Realtime via Supabase channel
- Enviar mensagens (texto)
- Indicador de leitura simples (read_at)
- Header com nomes dos membros da conversa

---

## 7. Rotas (App.tsx)

Adicionar dentro do bloco `<Route element={<AppLayout />}>`:

```text
/tournaments/:id/match          -> TournamentMatch
/tournaments/:id/match/requests -> MatchRequests
/tournaments/:id/match/pair     -> MatchPair
/tournaments/:id/match/chat/:conversationId -> MatchChat
```

---

## 8. Organizador -- Ativar/Desativar Match

No `ManageTournament.tsx` ou `CreateTournament.tsx`:
- Adicionar toggle/switch para `match_enabled`
- Salvar no update do torneio

---

## Arquivos a criar
- `src/pages/TournamentMatch.tsx`
- `src/pages/MatchRequests.tsx`
- `src/pages/MatchPair.tsx`
- `src/pages/MatchChat.tsx`

## Arquivos a editar
- `src/App.tsx` (novas rotas)
- `src/pages/TournamentDetail.tsx` (botoes de match)
- `src/pages/CreateTournament.tsx` (toggle match_enabled)
- Migracao SQL (nova)

## Regras de negocio implementadas
- Usuario so pode ter 1 perfil ativo por torneio (UNIQUE constraint)
- Matched nao aparece no pool (filtro status = "looking")
- Match so funciona se tournament.match_enabled = true
- Organizador controla ativacao via toggle

