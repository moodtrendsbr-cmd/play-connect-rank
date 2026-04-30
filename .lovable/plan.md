
# Plano — Control Tower: 1 clique → execução real

## Objetivo
Cada botão da Control Tower precisa, em um único clique, disparar um fluxo real (campanha, destaque no feed, mensagem segmentada) e devolver feedback humano simples (Iniciando / Em andamento / Concluído). Sem modais, sem parâmetros, sem termos técnicos.

## Diagnóstico do estado atual
- O botão já chama `invokeOrkym('growth','decide', …)`, que vai ao ORKYM externo. Quando ele responde com propostas em modo `auto`, `orkym-invoke` despacha automaticamente em `orkym-execute-action` → `dispatchAction` (`supabase/functions/_shared/orkym-handlers.ts`).
- **Lacuna principal:** `dispatchAction` só conhece os action_types antigos (`create_followup`, `propose_promotion`, etc.). Os action_types de growth listados em `src/lib/orkym.ts` (`tournament_boost`, `fill_idle_slots`, `reactivation_message`, `send_proactive_message`, `create_campaign`, `recommend_product`, `upsell_plan`, `company_boost`, `product_boost`) caem no `default` → `unknown_action_type`. Resultado: o clique não materializa nada.
- Falta também um caminho determinístico para quando o ORKYM externo não retornar propostas (ex.: `actions_proposed === 0` mostra hoje "Tudo já está sob controle", o que é incorreto se a recomendação ainda existe).

## O que será feito

### 1. Mapa interno action_type → execution_flow (backend)
Estender `supabase/functions/_shared/orkym-handlers.ts` com 6 handlers de growth, todos reusando tabelas/RPCs já existentes — zero IA local, zero novas engines:

| action_type | Fluxo executado |
|---|---|
| `tournament_boost` | `INSERT ad_campaigns(kind='tournament_boost', status='active', target_type='tournament', target_id=…)` + enfileira `orkym_triggers_queue` (`relevant_tournament`) para base segmentada do tenant/arena |
| `fill_idle_slots` | Detecta `court_slots` ociosos próximos (24–72 h) e enfileira `idle_court_slot` triggers para usuários com `favorite_arena_id` ou histórico de booking; cria `ad_campaigns(kind='company_boost', target_type='arena')` |
| `reactivation_message` | Seleciona `profiles` inativos (≥30 d sem `athlete_activities`) escopados por arena/tenant e enfileira `inactive_athlete` triggers |
| `send_proactive_message` | Enfileira um `orkym_triggers_queue` com payload já vindo do recommendation (`entity_id` do alvo) |
| `create_campaign` / `product_boost` | `INSERT ad_campaigns(kind='product_boost'/'feed_ads', status='active', target_id=produto)` |
| `recommend_product` / `upsell_plan` | Enfileira `top_product` / `relevant_tournament` triggers para usuários relevantes do tenant |
| `company_boost` | `INSERT ad_campaigns(kind='company_boost', status='active', target_id=company_id)` |

Todos retornam `{ ok, result: { campaign_id?, queued?: n, ... } }` e usam o `proposed_payload` do proposal para entity_id/target_id.

### 2. Garantir caminho de execução mesmo sem proposta vinda do ORKYM
Quando o usuário clica e a recomendação já tem `action_type` + `entity_*` definidos pela `control_tower_summary`, não deveríamos depender da resposta do ORKYM externo para materializar a ação. Vamos:

- Fazer o `executeRec` chamar `invokeOrkym('growth','decide', …)` (mantém log/quota/orçamento), **e** se a resposta vier `actions_proposed === 0` ou `degraded`, criar localmente uma `orkym_action_proposals` em modo `auto` com o `action_type` + payload da recomendação e chamar `orkym-execute-action` direto.
- Isto será encapsulado numa nova função interna `ensureActionExecuted(rec)` no backend (nova edge function fina `control-tower-execute` ou ramo dentro de `orkym-execute-action`). Decisão: adicionar **um endpoint novo `control-tower-execute`** que recebe `{ scope, recommendation }`, valida permissão, respeita kill-switch/cooldown/budget e roteia para `orkym-execute-action` (modo auto). Mais simples e isola a UX da Control Tower.

### 3. Guardrails (sem mostrar nada ao usuário)
Antes de executar, `control-tower-execute` consulta:
- `autonomy_kill_switches` (já usado em `orkym-execute-action`).
- `orkym_proactive_check_eligibility` (cooldown/opt-in para fluxos que enviam mensagens).
- `growth_budgets` (já existe em Phase G — verificar saldo do mês para o tenant; bloqueia se zerado).
- `orkym_check_quota` (auto_actions).

Se algum bloqueio acionar, retorna `{ ok: true, status: 'blocked', reason }` e a UI mostra apenas "Tudo já está sob controle por agora." — sem detalhes.

### 4. Logs e atribuição de receita
Cada execução grava:
- `orkym_action_proposals` (com `status='executed'`, `auto_executed=true`, `metadata.source='control_tower'`).
- `orkym_revenue_attribution` quando o fluxo subsequente gerar `financial_transactions` paid (já automático via trigger existente — não precisa código novo).
- `arena_operational_events` (`event_type='control_tower.action_executed'`).

### 5. UI — feedback 100% humano
`src/components/control-tower/ControlTowerAIPanel.tsx`:
- Trocar a chamada direta `invokeOrkym('growth','decide')` por `supabase.functions.invoke('control-tower-execute', { body: { scope, recommendation } })`.
- Estados visíveis: `Iniciando…` → `Em andamento…` (após 800 ms se ainda em flight) → `Concluído` (com `CheckCircle2` verde).
- Toasts usam exclusivamente `controlTowerCopy.feedback` ("Estamos atraindo mais jogadores", etc.).
- Caso bloqueado → toast neutro "Tudo já está sob controle por agora." sem expor reason.
- Após `done`, chamar `refresh()` da Control Tower para refletir impacto (alertas/score atualizados).
- Garantir desativação dupla do botão durante run e marcação `done` persistente até próximo `refresh`.

### 6. Reflexo de impacto
- A `control_tower_summary` RPC já lê `tournaments`, `bookings`, `financial_transactions`, `xp_events`, `orkym_triggers_queue`. Após execução, o próximo `refresh()` recalcula health_score/alerts naturalmente.
- Adicionar no card uma micro-faixa "Última ação: X concluída há N min" lida de `orkym_action_proposals` mais recente da scope (sem expor action_type — usar copy humanizada).

## Arquivos afetados

```text
supabase/functions/_shared/orkym-handlers.ts        (+6 case branches de growth)
supabase/functions/control-tower-execute/index.ts   (NOVO — orquestrador 1-clique)
supabase/config.toml                                (registra função, verify_jwt = true)
src/components/control-tower/ControlTowerAIPanel.tsx (troca invocação + estados)
src/lib/controlTowerCopy.ts                         (adiciona "Em andamento…" e blocked copy)
src/hooks/useControlTowerSummary.ts                 (expor last_action humanizado opcional)
mem/features/control-tower-ai.md                    (documentar 1-click execution)
```

Nenhuma mudança de schema é necessária — todas as tabelas (`ad_campaigns`, `orkym_triggers_queue`, `orkym_action_proposals`, `growth_budgets`, `autonomy_kill_switches`) já existem.

## Detalhes técnicos relevantes
- `control-tower-execute` valida JWT, resolve tenant/arena a partir do `scope` e do RLS do usuário (`is_tenant_admin`/`is_arena_owner`). Sem permissão → `403`.
- Idempotência: `dedup_key = sha256(scope|action_type|entity_id|YYYYMMDDHH)` → impede duplo clique disparar duas campanhas.
- Cooldown: cada `action_type` tem cooldown mínimo (1 h por padrão) lido de `autonomy_policies` se existir, senão hardcoded fallback.
- Budget: para `tournament_boost`, `product_boost`, `company_boost`, `create_campaign`, descontar custo simbólico de `growth_budgets.monthly_remaining` (já implementado em Phase G — apenas reusar RPC existente).
- Kill-switch: reutiliza a mesma query CSV que `orkym-execute-action` faz em runtime.

## Critérios de sucesso (testes manuais)
1. Clicar "Divulgar torneio" → aparece campanha em `ad_campaigns` + triggers em fila → toast "Estamos divulgando seu torneio agora" → `done` em <3 s.
2. Clicar "Preencher horário" → `idle_court_slot` triggers gerados para alvos relevantes; nenhuma se base vazia → toast neutro.
3. Clicar "Trazer cliente de volta" → `inactive_athlete` triggers enfileirados.
4. Clicar "Aumentar vendas" → `ad_campaigns(kind='product_boost')` ativa.
5. Kill-switch ligado → clique não cria nada, toast neutro.
6. Sem dados na arena → não quebra; toast "Tudo já está sob controle por agora."
7. Health score / alertas atualizam no refresh seguinte.

## Não-objetivos
- Não criar IA local nem reasoning local (decisão fica no ORKYM externo quando responde; quando não responde, fallback é determinístico baseado no action_type da recomendação que o próprio backend ORKYM/RPC já produziu).
- Não expor "ORKYM", "IA", "decisão", "configuração" em nenhum lugar da UI.
- Não pedir parâmetros, não abrir modal, não exigir confirmação.
