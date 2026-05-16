## Tournament Pilot Validation Sprint

Corrigir bloqueadores P0/P1 da Central do Torneio para validar um piloto real ponta a ponta. Sem features novas, sem ORKYM, sem gamificação, sem social.

---

### 1. Guard real em `/tournaments/:id/manage` (P1)

`ManageTournament.tsx` hoje passa `canManage={true}` hardcoded.

- Criar helper `useTournamentPermission(tournamentId)` em `src/hooks/useTournamentPermission.ts` que retorna `{ canManage, canView, loading }`.
- `canManage = true` se:
  - `userRole === "admin"`
  - `tournament.organizer_id === user.id`
  - `tournament.arena_id` pertence a arena cujo `owner_user_id = user.id`
  - usuário é `owner|admin` em `tenant_members` do `tournament.tenant_id`
- Se `canView` mas não `canManage` → renderizar fallback amigável ("Você está vendo como atleta. Apenas o organizador pode gerenciar.") com link para a página pública.
- Propagar `canManage` real para `TabInscritos`, `TabGroups`, `TabMatches`, `TabBracketView`, `TabPlacements`, `TabCheckin`, edição e botão "Próxima ação".

### 2. Inscrições órfãs / incompletas (P0)

Refatorar `TabInscritos.tsx`:

- Particionar `rows` em `completas` (tem `modality_id` ou `entry_id`) e `incompletas` (sem `modality_id`).
- Renderizar duas seções com header próprio:
  - **Inscrições incompletas** — copy: "Estas inscrições foram pagas, mas ainda precisam de categoria." Cada linha tem ações:
    - 0 categorias no torneio → mostrar CTA "Crie uma categoria antes de organizar os inscritos."
    - 1 categoria → botão "Vincular automaticamente" (UPDATE `enrollments.modality_id` → dispara trigger `trg_enrollments_create_entry_modality`).
    - ≥2 categorias → Select de categorias + botão "Vincular".
    - "Arquivar" (UPDATE `archived_at = now()`).
  - **Inscrições completas** — lista atual com filtros.
- Filtrar `rows` por `archived_at IS NULL` na query.
- Garantir que sorteio/grupos só consideram entries (já é o caso via `modality_entries`).

### 3. Backfill seguro (P0)

Verificar/reescrever RPC `backfill_orphan_enrollments()` para que sempre retorne 4 buckets sem falhar silenciosamente:
- `auto_linked` (1 modality → vinculado)
- `needs_category_review` (≥2)
- `unrecoverable_no_category` (0)
- `test_or_smoke` (nome match `[SMOKE]%|%seed%|%test%`, ignora vinculação)

Retorno JSON: `{ ok, auto_linked: [...], needs_review: [...], unrecoverable: [...], test_items: [...], counts: {...} }`.

`AdminInternalTools` já chama isso; ajustar UI para mostrar relatório completo após execução.

### 4. Stage correction (P1)

`src/lib/tournamentStage.ts` — `deriveStage`:
- **Remover** o gatilho `paidCount >= maxSlots * 0.8`.
- Avançar para `"checkin"` apenas se: `i.hasEntries === true` **e** (`status === 'checkin'` OU já existem `paidCount > 0`).
- Avançar para `"groups"` apenas se `hasGroups`.
- Mantém demais regras.

Atualizar `nextActionFor` para o estado `open` quando há órfãos → hint "Organize as inscrições incompletas antes de avançar."

Adicionar `hasOrphans: boolean` a `StageInputs` e popular em `ManageTournament` (count de enrollments paid com `modality_id IS NULL AND archived_at IS NULL`).

### 5. Smoke real grupo → final → pódio (P0)

Edge function nova `supabase/functions/smoke-tournament-flow/index.ts` (admin-only via JWT + `has_role('admin')`):

1. Cria torneio `[SMOKE] flow <ts>`, 1 modality (singles, 4 slots, eliminação simples).
2. Cria 4 enrollments `paid` com `modality_id` → confere entries/members criados pelo trigger.
3. Chama `generate-bracket` para criar 2 semis + 1 final.
4. Registra placar das semis → confere `winner_entry_id` e que `trg_matches_advance` populou os slots da final.
5. Registra placar da final → confere `modality_placements` (pos 1 + 2).
6. Retorna `{ ok: true|false, step, tournament_id, summary: { enrollments, entries, members, matches, placements } }`.

Botão escondido atrás de feature flag em `/admin/internal-tools` (env `VITE_ENABLE_SMOKE_TOURNAMENT` ou flag local). Nunca no Admin público.

### 6. Resumo da Central (P1)

Substituir TabsContent "resumo" por novo `TabResumo.tsx`:

- **Próximos 3 jogos**: query `modality_matches` `status != 'finished'` ORDER BY `scheduled_at` LIMIT 3.
- **Cards de status**: completas, incompletas, sem check-in, jogos pendentes de resultado.
- **CTAs condicionais**: 
  - sem categoria → "Criar categoria" (abre Editar configurações).
  - tem órfãos → "Organizar inscrições incompletas" (tab inscritos).
  - sem matches mas com grupos → "Gerar jogos".
- Etapa atual e próxima ação real (reusa `stageInfo`).

### 7. QR individual do atleta (P1)

Novo componente `src/components/tournament/AthleteCheckinQR.tsx`:
- Recebe `enrollmentId`; busca `checkin_token`.
- Gera QR com URL `/tournament-checkin/{token}` (rota pública já existente em `PublicCheckin` / `TournamentCheckinScan`).
- Exibe copy "Meu QR de check-in — Apresente na entrada do torneio."
- **Não** mostra o token em texto.

Integrar em:
- `MyNextMatchCard` (collapsible "Ver meu QR").
- `Profile.tsx` (na seção do torneio ativo).
- `TournamentDetail.tsx` quando logado e inscrito.
- `TabCheckin` (modo atleta — visualização individual ao clicar na própria linha; gerentes continuam vendo a lista).

### 8. Check-in (P1)

`TabCheckin` — adicionar contadores: presentes / pendentes / pagamento pendente / inscrição incompleta. Confirmar idempotência:
- Se `checked_in_at IS NOT NULL`, retornar success sem update.
- Migration: trigger `BEFORE UPDATE OF checked_in_at` que ignora se já preenchido (no-op + raise notice).

### 9. Avisar jogadores (P1)

Em `TabMatches`: para cada match futuro com `entry_a/entry_b` definidos, botão "Avisar jogadores":
- Resolve `user_id` via `modality_entry_members` → `profiles.whatsapp`.
- Abre `https://wa.me/<phone>?text=<mensagem>` em nova aba (uma por jogador via `window.open` em sequência, com fallback de copiar texto).
- Mensagem: "Seu jogo começa em breve. Confira horário e quadra: <link torneio>".
- Nada de ORKYM/IA.

### 10. Double elimination (P1)

`tournament_modalities.bracket_format` pode ser `double_elimination`.
- Em `CreateTournament` / `EditTournamentForm`: remover opção "double elimination" do select (ou marcar `disabled` + label "Em breve").
- Em `TabBracketView`: se formato for `double_elimination`, mostrar EmptyState "Formato em desenvolvimento — use eliminação simples".

### 11. Testes obrigatórios

Após smoke rodar com sucesso, executar via `supabase--read_query` as 5 queries do briefing e anexar resultados ao relatório final. Critério: 4 atletas completos, jogos criados, winners avançando, pódio gerado.

### 12. Relatório final

Resposta em chat após implementação, contendo:
- Guards: arquivos editados, casos cobertos.
- Órfãos: nova UI, screenshots conceituais.
- Backfill: assinatura nova, contagens.
- Stage: regra antiga vs nova.
- Smoke: nome da function, fluxo executado, output JSON.
- QR: locais integrados.
- Resumo: novos blocos.
- Double elim: tratamento.
- 5 queries com resultados reais.
- `tsc` limpo.

---

### Arquivos novos
- `src/hooks/useTournamentPermission.ts`
- `src/components/tournament/TabResumo.tsx`
- `src/components/tournament/AthleteCheckinQR.tsx`
- `supabase/functions/smoke-tournament-flow/index.ts`

### Arquivos editados
- `src/pages/ManageTournament.tsx`
- `src/components/tournament/TabInscritos.tsx`
- `src/components/tournament/TabCheckin.tsx`
- `src/components/brackets/TabMatches.tsx`
- `src/components/brackets/TabBracketView.tsx`
- `src/components/athlete/MyNextMatchCard.tsx`
- `src/pages/Profile.tsx`
- `src/pages/TournamentDetail.tsx`
- `src/pages/CreateTournament.tsx`
- `src/components/tournament/EditTournamentForm.tsx`
- `src/lib/tournamentStage.ts`
- `src/pages/admin/AdminInternalTools.tsx`

### Migrations
- Reescrita de `backfill_orphan_enrollments()` (idempotente, retorno completo).
- Trigger idempotência `checked_in_at`.

### Out of scope
- Sem ORKYM, sem IA, sem mudanças de gamificação/social/feed, sem refatores fora dessa lista, sem novo backend de matchmaking, sem mudar regras de pagamento.
