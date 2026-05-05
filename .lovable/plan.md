# Correção do fluxo de inscrição em torneios

## Diagnóstico (validado no banco)

- Trigger `trg_enrollments_create_entry` está correto e ativo. Faz early-return quando `modality_id IS NULL` ou `status <> 'paid'`. Nenhum bug nele.
- Coluna `enrollments.modality_id` existe.
- **22/22 enrollments `paid` no banco têm `modality_id = NULL` e `entry_id = NULL`.** Nenhum entry/member foi criado.
- Causas raiz por ponto de entrada:
  1. `Payment.tsx` (UI web): **já passa `modality_id` corretamente** no insert (linha 208) e bloqueia checkout sem categoria. Esse caminho está OK — desde que o torneio tenha `tournament_modalities`.
  2. RPC `public.enroll_athlete_in_tournament(_tournament_id, _modality_id)`: **aceita `_modality_id` mas NÃO usa no INSERT.** Por isso toda inscrição via WhatsApp/ORKYM (`moodplay-execute-action` chama essa RPC) entra com `modality_id=NULL`.
  3. `smoke-test-payment`: cria torneio sem modalidade e enrollment sem `modality_id`. Por isso o teste sempre passou “verde” em ftx/activity/attribution mas falhou em entry/member sem ser detectado.
  4. `CreateTournament.tsx`: cria modalities a partir de `slot_config`, mas não bloqueia salvar com `slot_config` vazio. Tornei criados antes da feature ficaram com 0 modalities.
- Webhook `mercadopago-webhook` apenas faz `update enrollments set status='paid'` — preserva `modality_id` (correto, não toca a coluna).

## Mudanças

### 1. RPC `enroll_athlete_in_tournament` (migration)

Recriar para:
- Persistir `_modality_id` no INSERT.
- Retornar erro `modality_required` se torneio tem ≥1 modality e `_modality_id` é NULL.
- Validar que `_modality_id` pertence ao `_tournament_id`.
- Permitir múltiplas inscrições do mesmo user em modalities diferentes (trocar UNIQUE check de `(tournament_id,user_id)` para `(tournament_id,user_id,modality_id)`).
- Retornar `modality_id` no JSON.

### 2. `moodplay-execute-action` (edge function)

- Em `enroll_in_tournament`: se payload não tem `modality_id`, antes de chamar a RPC consultar `tournament_modalities` do torneio:
  - 0 modalities → retornar erro estruturado `tournament_has_no_categories`.
  - 1 modality → auto-selecionar.
  - ≥2 modalities → retornar `requires_category_choice` + lista (ORKYM já sabe pedir confirmação multi-turn).
- Encaminhar `modality_id` resolvido para a RPC.

### 3. `smoke-test-payment` (edge function)

Reescrever para refletir o fluxo real e falhar honestamente:
1. Criar tournament.
2. Criar **1 `tournament_modality`**.
3. Inserir enrollment `pending` **com `modality_id`**.
4. Update para `paid`.
5. Esperar 600ms.
6. Reler enrollment + checar:
   - `enrollment.modality_id NOT NULL`
   - `enrollment.entry_id NOT NULL`
   - 1 row em `modality_entries` para esse `modality_id`
   - 1 row em `modality_entry_members` ligado ao entry
   - `financial_transactions` paid para o source
   - `athlete_activities` para o user
   - `orkym_revenue_attribution` para a enrollment
7. Se qualquer item falhar: retornar `ok:false` com a lista exata de checks falhos. Sem falso positivo.

### 4. `CreateTournament.tsx`

- Bloquear submit se `slotConfig.length === 0` com toast: “Adicione ao menos uma categoria.”
- Se o INSERT em `tournament_modalities` falhar, **deletar o torneio recém-criado** (rollback manual) em vez de deixar torneio inscricionável sem categoria.

### 5. Guard de inscrição em `Payment.tsx`

Já existe (linha 168). Reforçar texto: redirecionar para o torneio quando `modalities.length === 0` em vez de só mostrar toast.

### 6. Backfill (RPC admin-only + botão)

Migration cria `public.backfill_orphan_enrollments()` SECURITY DEFINER, restrita a `has_role(auth.uid(),'admin')`:
- Para cada enrollment `paid` com `modality_id IS NULL`:
  - Se o tournament tem exatamente 1 modality → seta `modality_id` (UPDATE dispara `trg_enrollments_create_entry_ins`? Não — esse trigger é AFTER UPDATE OF status. Solução: o trigger atual roda em UPDATE; basta garantir que dispara em UPDATE de `modality_id` também. Adicionar `OR UPDATE OF modality_id` na definição do trigger).
  - Se tem 0 modalities → deixar como está, retornar contagem em `skipped_no_modality`.
  - Se tem ≥2 → marcar `enrollments.checkin_method = 'needs_category_review'` (campo existente) ou criar coluna leve. Plano: usar campo `payment_id` não — usar nova coluna boolean `needs_category_review` (migration adiciona).
- Retorna `{linked, skipped_no_modality, needs_review}`.
- Botão no `AdminControlTower` chama a RPC e mostra resultado.

### 7. Trigger ajuste

Migration: recriar trigger para também acionar em `UPDATE OF modality_id` (além de status), para que o backfill crie o entry sem precisar de update artificial em status.

## Verificação final

Após deploy + backfill, rodar:
```sql
SELECT id, status, modality_id, entry_id FROM enrollments ORDER BY created_at DESC LIMIT 5;
SELECT id, modality_id FROM modality_entries ORDER BY created_at DESC LIMIT 5;
SELECT * FROM modality_entry_members ORDER BY created_at DESC LIMIT 5;
```
E rodar `smoke-test-payment`. Critério de sucesso: enrollment paid mais recente tem `modality_id` e `entry_id`, entry e member existem, smoke retorna `ok:true`.

## Fora de escopo

- Bracket double-elimination losers routing.
- Refactor `slot_config` × `tournament_modalities`.
- Backfill das 78 entries seed sem members (não bloqueia o fluxo novo).

## Arquivos tocados

- `supabase/migrations/<novo>.sql` — RPC `enroll_athlete_in_tournament`, trigger update, RPC `backfill_orphan_enrollments`, coluna `needs_category_review`.
- `supabase/functions/smoke-test-payment/index.ts`
- `supabase/functions/moodplay-execute-action/index.ts`
- `src/pages/CreateTournament.tsx`
- `src/pages/Payment.tsx` (guard reforçado)
- `src/pages/admin/AdminControlTower.tsx` (botão backfill)
