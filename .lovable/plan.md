## Tournament Closure Validation Sprint

Validar e corrigir o fechamento completo de um torneio até campeão, pódio e reflexos no sistema. Sem features novas, sem novo bracket engine, sem refatoração.

---

### 1. Execução do smoke (evidência real)

- Rodar `smoke-tournament-flow` via `AdminInternalTools` (ou `supabase--curl_edge_functions`).
- Capturar saída JSON (`tournament_id`, summary, checklist por etapa).
- Critério: 4 enrollments paid, 4 entries, 8 members, 3 matches (2 semis + 1 final), 2 placements (1º e 2º).

### 2. Queries de evidência (`supabase--read_query`)

Executar no `tournament_id` retornado pelo smoke:

1. `modality_matches` — fase, status, winner_entry_id, score por round
2. `modality_placements` — position, entry_id (1º, 2º; 3º se aplicável)
3. `athlete_activities` — eventos `tournament.enrolled` e qualquer `match.*` / `tournament.won` gerado
4. `xp_events` + `athlete_xp.lifetime_xp` dos 4 atletas — confirmar bônus de match/campeão
5. `social_feed_public_v2` filtrado pelos profile_ids — confirmar evento de campeão no feed

### 3. Edge cases (apenas leitura/diagnóstico)

- WO (winner sem placar) — checar se `trg_matches_advance` ainda propaga
- Reescrita de placar pós-final — checar se `modality_placements` mantém integridade
- Bye em SE de 4 — confirmar comportamento atual
- 3º lugar em SE de 4 — verificar se trigger gera position 3 a partir dos perdedores das semis

### 4. Classificação 🟢/🟡/🔴

Por área, com evidência apontada:
- Avanço automático (semi → final)
- Finalização (winner_entry_id → status=finished)
- `modality_placements` (1º, 2º, 3º)
- Campeão exposto na Central (TabPlacements)
- Feed reflete campeão
- XP / ranking atualiza (`athlete_xp.lifetime_xp`)
- `get_my_next_match` zera pós-final
- `MyNextMatchCard` esconde corretamente
- Auto-refresh do TabPlacements

### 5. Correções (somente se a evidência apontar gap)

Aplicar apenas o que falhar nas queries, na menor cirurgia possível:

- **XP de campeão ausente** → ligar `trg_xp_from_match` ao evento certo (match concluído e/ou placement inserido) via migração mínima. Sem nova tabela.
- **3º lugar não gerado** → ajustar `trg_matches_finalize_podium` para inserir position 3 a partir dos perdedores das semis em SE.
- **Idempotência do pódio** → `ON CONFLICT (modality_id, position) DO UPDATE` em `modality_placements`.
- **Feed sem evento de campeão** → inserir `athlete_activities` tipo `tournament.won` via trigger em `modality_placements` (position=1), respeitando `social_feed_public_v2`.
- **TabPlacements sem auto-refresh** → adicionar canal realtime em `src/components/brackets/TabPlacements.tsx` ouvindo `modality_placements` por `modality_id`.
- **MyNextMatchCard persistindo pós-final** → garantir que `get_my_next_match` retorna null e o card oculta.

Cada correção:
- migração mínima OU patch frontend pontual
- re-rodar smoke
- re-rodar as 5 queries
- registrar antes/depois no relatório

### 6. Veredito final em chat

Responder objetivamente, com evidência colada:
1. Torneio termina sozinho?
2. Campeão gerado automaticamente?
3. Pódio funciona (1º, 2º, 3º quando aplicável)?
4. Feed reflete resultado?
5. Ranking/XP atualiza?
6. Algum passo manual/técnico restante?
7. Pronto para piloto real?

---

### Critério de sucesso

- Smoke 100% verde
- `modality_placements` populado e idempotente
- `athlete_xp.lifetime_xp` muda para os 4 atletas (com bônus para o campeão)
- `social_feed_public_v2` contém evento de campeão
- Central muda para "Encerrado" e mostra pódio sem refresh manual
- `get_my_next_match` retorna vazio após a final
- Build TypeScript limpo

### Out of scope

ORKYM, IA, gamificação nova, monetização, novo bracket engine, dupla eliminação, refator de UI, novos endpoints sociais.

### Arquivos potencialmente tocados (apenas se a evidência exigir)

- `supabase/migrations/<nova>.sql` — ajustes em `trg_matches_finalize_podium`, `trg_xp_from_match`, idempotência
- `src/components/brackets/TabPlacements.tsx` — realtime
- `src/components/athlete/MyNextMatchCard.tsx` — guarda pós-final

Nenhuma alteração será feita sem evidência prévia das queries.
