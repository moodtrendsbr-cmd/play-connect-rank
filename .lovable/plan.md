# Reparo estrutural do módulo de torneios

Objetivo: deixar o fluxo **pagamento → categoria → chaveamento → jogos → resultado → pódio** funcionando ponta a ponta, com automações no servidor e sem criar features novas.

---

## 1. Inscrição vincula categoria automaticamente

Hoje `enrollments.modality_id` está sempre `NULL` (0/28 inscrições reais). O atleta paga mas não entra em nenhum chaveamento.

Mudanças:
- **Payment.tsx**: passar a exigir seleção de categoria (modality) já existente em `tournament_modalities` antes do checkout. Um seletor por atleta (em torneios com 1 categoria, auto-seleciona). Se não houver modalidades, bloquear checkout com mensagem clara para o organizador.
- Salvar `modality_id` ao criar a `enrollment` (pendente).
- **Trigger no DB** `trg_enrollments_create_entry` em `enrollments AFTER UPDATE OF status`:
  - quando `status` vira `paid` e `modality_id IS NOT NULL`:
    - cria `modality_entries` (name = `athlete_name` ou perfil; tenant_id propagado)
    - cria `modality_entry_members(entry_id, user_id)` quando `user_id` existir
    - guarda o `entry_id` no enrollment (nova coluna `entry_id uuid` em `enrollments`, FK para `modality_entries`).
  - idempotente: se já existe entry vinculada, não recria.
- **Backfill**: para inscrições já `paid` com `modality_id` definida no novo fluxo, o trigger roda em UPDATE — para histórico antigo (28 atuais sem modality), nada é feito (não temos como adivinhar a categoria).

Critério: 1 enrollment paga = 1 `modality_entry` + (quando aplicável) 1 `modality_entry_members`.

---

## 2. Criar torneio gera modalidades reais

Hoje `CreateTournament` salva tudo em `tournaments.slot_config` (jsonb) e nunca cria linhas em `tournament_modalities`. Por isso quase todo torneio fica sem categoria.

Mudanças em `CreateTournament.tsx`:
- Após `insert` no `tournaments`, fazer `insert` em `tournament_modalities` uma linha por item de `slot_config`, com:
  - `tournament_id`, `tenant_id`
  - `name` = `"{type} {gender} {category}"` (ex: "Dupla Masculina Iniciante")
  - `type` = mapeado (`Duplas`→`dupla`, `Trios`→`trio`, `Quartetos`→`quarteto`, `Individual`→`individual`)
  - `team_size` = 2/3/4/1
  - `gender`, `level` = category, `sport` = modality, `max_entries` = slots, `start_time` = parse do datetime
- Manter `slot_config` por compatibilidade, mas a fonte de verdade passa a ser `tournament_modalities`.
- A página `EditTournamentForm` ganha sincronização equivalente quando o organizador edita slots (criar/atualizar/remover modalidades correspondentes).

---

## 3. Bracket server-side

Hoje `GenerateBracketDialog.tsx` gera chaves no cliente, com bugs em byes e double elimination.

Mudanças:
- Nova edge function `generate-bracket` (`verify_jwt = true`):
  - Input: `{ modality_id, format, num_groups? }`
  - Valida que o caller é dono do torneio (`is_modality_tournament_owner`) ou admin.
  - Lê `modality_entries` da modalidade.
  - Implementa corretamente:
    - **single_elimination com byes**: padding até a próxima potência de 2, byes distribuídos pelos seeds top; quem recebe bye avança como `winner_entry_id` na partida da R1 já marcada como `bye`/`finished`.
    - **double_elimination**: gera winners bracket completo + losers bracket espelhado com placeholders `null` em todas as rodadas, links entre fases via `source_match_id` (ver §4).
    - **round_robin** e **groups**: como hoje, mas server-side e idempotente.
  - Apaga matches/groups antigos e reinsere em transação (RPC com `security definer`).
- `GenerateBracketDialog.tsx` passa a chamar a edge function via `supabase.functions.invoke`.

Coluna nova em `modality_matches`:
- `source_a_match_id uuid` e `source_b_match_id uuid` (FK self) + `source_a_role text` (`winner|loser`), `source_b_role text` — usados no avanço automático.

---

## 4. Avanço automático de partidas

Hoje organizador grava placar mas a próxima partida fica vazia.

Mudanças:
- Trigger `trg_matches_advance` em `modality_matches AFTER UPDATE OF winner_entry_id`:
  - Se `winner_entry_id` foi setado, encontrar matches que tenham `source_a_match_id = NEW.id` ou `source_b_match_id = NEW.id`.
  - Preencher `entry_a_id`/`entry_b_id` com o vencedor (ou perdedor, no caso de losers bracket via `source_*_role = 'loser'`).
  - Idempotente: se já tem `entry_*_id` igual ao vencedor, não faz nada.
- Caso a partida não tenha `source_*` definido (formato round_robin/groups), o trigger é no-op.

---

## 5. Pódio automático

Hoje `modality_placements` tem 0 registros, mesmo com torneios concluídos.

Mudanças:
- Trigger `trg_matches_finalize_podium` em `modality_matches AFTER UPDATE OF winner_entry_id`:
  - Detecta a final (maior `round_number` da modalidade no winners bracket) e a semifinal (round anterior).
  - Quando final ganha vencedor: insere `position=1` (vencedor) e `position=2` (perdedor da final).
  - Quando ambas semifinais têm vencedor: insere `position=3` para os dois perdedores (ou `position=3` e `position=4` se houver disputa de 3º lugar; configurável via `tournament_modalities.rules_json.third_place_match`).
  - Conflito (`ON CONFLICT (modality_id, position) DO NOTHING`) para idempotência — adicionar UNIQUE(modality_id, position).
- Atualiza `tournament_modalities.status` para `finished` quando pódio completo.

---

## 6. Tela "Meu jogo" do atleta

Hoje o atleta não vê quando joga.

Mudanças:
- Em `AthleteDashboard.tsx`, no bloco "Meu Dia / Jogos", adicionar card **"Meu próximo jogo"** consumindo a RPC já existente `get_my_next_match` (não precisa criar).
- Mostrar: modalidade, adversário (via `modality_entries.name` + `modality_entry_members`/`profiles`), `scheduled_at`, quadra (`court_id`→nome), torneio.
- Listar também próximas 5 partidas via `list_today_matches` ou query equivalente filtrando por `entry` do usuário.
- Sem nova rota; reaproveita `/athlete/dashboard`.

---

## 7. QR individual do atleta

`enrollments.checkin_token` já existe e é gerado por default — só não é exposto na UI.

Mudanças:
- Em `AthleteDashboard.tsx`, quando houver enrollments `paid` em torneios futuros/em andamento, exibir botão "Meu QR de check-in" que abre dialog com QR (componente `QRGenerator` já existe) codificando a URL pública `/{base}/checkin?token={checkin_token}` (rota `PublicCheckin` já existe).
- Sem mudanças em backend — apenas SELECT do próprio enrollment (RLS já permite).

---

## Detalhes técnicos / arquivos tocados

**Migrations (schema):**
- `enrollments`: adicionar `entry_id uuid` (nullable, FK→`modality_entries(id) ON DELETE SET NULL`).
- `modality_matches`: adicionar `source_a_match_id`, `source_b_match_id` (uuid, FK self), `source_a_role`, `source_b_role` (text check `IN ('winner','loser')`).
- `modality_placements`: UNIQUE `(modality_id, position)`.
- Funções/triggers: `trg_enrollments_create_entry`, `trg_matches_advance`, `trg_matches_finalize_podium` (todos `SECURITY DEFINER`, `search_path = public`).
- Mantém todos triggers/políticas existentes (não mexe em `auth/storage/realtime`).

**Edge functions:**
- `supabase/functions/generate-bracket/index.ts` (novo, `verify_jwt = true`, valida ownership via `getClaims` + RPC).
- Atualizar `create-payment` e `mercadopago-webhook` apenas para garantir que `modality_id` já vem persistido na enrollment desde a criação (a transição para `paid` é o que dispara o trigger §1).

**Front-end:**
- `src/pages/CreateTournament.tsx`: após insert do torneio, criar modalidades.
- `src/components/tournament/EditTournamentForm.tsx`: sincronizar modalidades ao editar slots.
- `src/pages/Payment.tsx`: seletor de categoria por atleta + envio de `modality_id`.
- `src/components/brackets/GenerateBracketDialog.tsx`: usar edge function.
- `src/pages/athlete/AthleteDashboard.tsx`: card "Meu próximo jogo" + QR de check-in.

**Sem mudanças em:**
- ORKYM/MoodPlay (continuam consumindo via `orkym_enqueue_athlete_notification`, que já dispara em match_result/enrollment_paid).
- `src/integrations/supabase/{client,types}.ts` (regenerados automaticamente).

---

## Critério de sucesso (verificável)

1. Inscrição paga → `enrollments.entry_id NOT NULL` e `modality_entries` correspondente existe.
2. Torneio criado pela UI → `tournament_modalities` tem N linhas (= itens do `slot_config`).
3. "Gerar chave" cria todas as partidas no servidor; byes resolvidos; double elimination com winners + losers brackets coerentes.
4. Registrar resultado preenche automaticamente o slot da próxima fase.
5. Final concluída → `modality_placements` populado (1º, 2º, 3º).
6. Atleta vê "Meu próximo jogo" e tem QR pessoal de check-in no dashboard.
