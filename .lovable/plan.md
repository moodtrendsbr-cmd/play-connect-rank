## Finalizar Tournament Pilot Validation Sprint

Concluir os 3 itens pendentes para encerrar a sprint e validar piloto real.

---

### 1. Edge function `smoke-tournament-flow` (P0)

Nova função admin-only em `supabase/functions/smoke-tournament-flow/index.ts`:

- Valida JWT + `has_role('admin')`.
- Cria torneio `[SMOKE] flow <timestamp>` + 1 modality (singles, 4 slots, eliminação simples).
- Cria 4 enrollments `paid` já com `modality_id` → confere entries/members criados pelos triggers.
- Invoca `generate-bracket` → confere 2 semis + 1 final.
- Registra placar das semis → confere `winner_entry_id` + avanço para final via `trg_matches_advance`.
- Registra placar da final → confere `modality_placements` (pos 1 e 2).
- Retorna `{ ok, step, tournament_id, summary: { enrollments, entries, members, matches, placements } }`.
- Marca o torneio com flag interna (nome `[SMOKE]`) para ser ignorado pelo backfill.

Adicionar botão "Rodar smoke do fluxo completo" em `AdminInternalTools.tsx`, atrás da flag `VITE_ENABLE_INTERNAL_TOOLS` já existente. Mostrar resultado em card com checklist por etapa.

### 2. Integrar `AthleteCheckinQR` nas telas do atleta (P1)

Componente já existe. Falta plugar em:

- **`MyNextMatchCard.tsx`**: collapsible "Ver meu QR de check-in" quando o atleta tem inscrição paga no torneio atual.
- **`Profile.tsx`**: na seção do torneio ativo do atleta (próximo torneio inscrito).
- **`TournamentDetail.tsx`**: quando logado, inscrito e pago.
- **`TabCheckin.tsx`**: modo individual — atleta logado vê o próprio QR ao identificar a própria linha; gerentes seguem com a lista.

Copy: "Meu QR de check-in — apresente na entrada do torneio." Nunca mostrar o token em texto.

### 3. Validação final ponta a ponta (P0)

Após smoke rodar com sucesso, executar via `supabase--read_query` as 5 queries do briefing original e anexar resultados no relatório:

1. enrollments × entries × members do torneio smoke
2. matches gerados e status
3. winners avançando para final
4. `modality_placements` final
5. resumo `tournament_stage` esperado

Critério de aprovação: 4 atletas completos, 3 jogos, 1 campeão, pódio com 2 posições.

### 4. Relatório final em chat

- Function criada + saída do smoke.
- Locais onde o QR foi plugado.
- 5 queries com resultados reais.
- `tsc` limpo.

---

### Arquivos novos
- `supabase/functions/smoke-tournament-flow/index.ts`

### Arquivos editados
- `src/pages/admin/AdminInternalTools.tsx`
- `src/components/athlete/MyNextMatchCard.tsx`
- `src/pages/Profile.tsx`
- `src/pages/TournamentDetail.tsx`
- `src/components/tournament/TabCheckin.tsx`

### Out of scope
Sem ORKYM, sem IA, sem mudanças de gamificação/social/feed, sem novo backend de matchmaking, sem mudar regras de pagamento.
