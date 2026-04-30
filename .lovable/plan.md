
# Plano — Control Tower Proativa via WhatsApp

## Objetivo
Quando o sistema detectar uma oportunidade (baixa inscrição, horário ocioso, atleta inativo, baixa conversão, oportunidade de venda, ranking/streak, performance de campanha), enviar via WhatsApp **uma única mensagem** no formato observação + sugestão + pergunta. Se o usuário responder afirmativamente em 1 palavra (sim/pode/ok/manda/faz), o sistema **executa a ação real automaticamente** e responde com confirmação humana. Sem expor ORKYM/IA/termos técnicos.

## Diagnóstico — o que já existe vs o que falta

Já existe (não tocar):
- `orkym_triggers_queue` + `growth_generate_opportunity_triggers` (cron 15 min) gerando oportunidades.
- `orkym-proactive-process` puxa fila, checa elegibilidade/cooldown via `orkym_proactive_check_eligibility`, dispara `wa-send-message`, registra feedback em `orkym_trigger_feedback`.
- `wa-bridge` recebe inbound, identifica usuário, e já registra feedback `responded` quando há mensagem outbound recente vinculada a um trigger (linhas 325–350).

O que falta para fechar o loop:
1. **Hoje a mensagem é decidida pelo ORKYM externo** (linhas 144–202 de `orkym-proactive-process`) — quando o ORKYM não responde, o trigger é marcado `skipped`, e nada chega ao usuário. O usuário pediu mensagens determinísticas no formato 1 insight + 1 ação. Vamos gerar a mensagem **localmente** a partir de templates por `trigger_type`, sem depender do ORKYM externo.
2. **Hoje o reply afirmativo** ("sim/pode") cai no `wa-bridge` e é encaminhado a `orkym-invoke/interpret_natural_command` (linhas 382–471), que pode falhar ou interpretar errado. Vamos interceptar **antes**: se houver outbound proativo recente com `pending_action`, e o texto for afirmativo, executar a ação direto via o handler já criado em `_shared/orkym-handlers.ts` (Phase H wiring). Sem round-trip externo, sem ambiguidade.
3. **Cap de 2 mensagens/dia por perfil**: hoje a elegibilidade tem cooldown por trigger_type, mas não um cap diário absoluto por usuário. Vamos adicionar uma checagem antes do envio: contar `conversational_commands` outbound proativos das últimas 24h para o `user_id` e bloquear se ≥2.

## Implementação

### 1. Templates determinísticos (1 insight + 1 ação + 1 pergunta)

Novo módulo `supabase/functions/_shared/proactive-templates.ts` exporta:

```ts
export interface ProactiveTemplate {
  message: (ctx: TemplateCtx) => string;          // texto humano completo
  action_type: OrkymGrowthActionType;             // tournament_boost, fill_idle_slots, ...
  build_payload: (ctx: TemplateCtx) => Record<string, unknown>;
}
```

Mapa por `trigger_type`:

| trigger_type | Mensagem (resumo) | action_type ao confirmar |
|---|---|---|
| `tournament_low_enrollment` | "Percebi que seu torneio "{name}" ainda está com poucas inscrições. Posso ajudar a atrair mais jogadores agora. Quer que eu faça isso?" | `tournament_boost` |
| `idle_court_slot` | "Você tem horário disponível {when} ainda sem reservas. Posso divulgar para quem costuma jogar nesse dia. Quer que eu faça?" | `fill_idle_slots` |
| `inactive_athlete` | "{name} não aparece há {n} dias. Posso enviar um convite para ele(a) voltar. Quer?" | `reactivation_message` |
| `low_message_performance` | "Sua última campanha está com baixa resposta. Posso impulsionar agora pra mais gente ver. Quer?" | `create_campaign` |
| `top_product` | "Seu produto "{title}" está vendendo bem. Posso divulgar pra ampliar as vendas. Quer?" | `product_boost` |
| `relevant_tournament` | "Tem um torneio que combina com você: {name}. Quer que eu faça sua inscrição agora?" | `send_proactive_message` (athlete-side: encaminha link)|
| `near_rank_up` | "Você está perto de subir no ranking. Faltam {n} pontos. Quer dicas pra acelerar?" | `send_proactive_message` |
| `revenue_drop` (admin/tenant) | "Sua receita esta semana caiu {pct}%. Posso ativar uma divulgação pra recuperar. Quer?" | `create_campaign` |

Mensagem termina com a pergunta exata em uma linha; o valor textual de confirmação nunca aparece no corpo (deixa o reply naturalmente curto).

### 2. Substituir a etapa "ORKYM decision" por geração local

Em `supabase/functions/orkym-proactive-process/index.ts`:

- Remover/desabilitar a chamada a `orkym-invoke proactive/decide` (linhas 144–202) e gerar `message` + `pending_action` localmente via `proactive-templates.ts`.
- Antes de enviar, aplicar **cap diário por usuário**: `SELECT count(*) FROM conversational_commands WHERE user_id = ? AND direction='outbound' AND initiated_by='orkym' AND created_at > now() - interval '24 hours'` → se ≥2, marcar trigger `skipped` reason `daily_cap`.
- Embutir o `pending_action` no row outbound: usar campo `parsed_intent` (jsonb já existe) com `{ pending_action: { action_type, entity_type, entity_id, payload, expires_at } }`.
- A `linked_entity_type='trigger'` + `linked_entity_id=t.id` já é gravada → continua sendo o pareamento outbound↔trigger.

### 3. Interceptar reply afirmativo no `wa-bridge`

Em `supabase/functions/wa-bridge/index.ts`, **antes** do bloco que chama ORKYM (linha 382):

1. Detectar afirmação simples por regex normalizado (lowercase, sem acento):
   ```
   /^\s*(sim|s|pode|ok|okay|manda|faz|fazer|claro|beleza|bora|vamos|👍|✅)\s*[!.]*\s*$/
   ```
2. Buscar último outbound proativo das últimas 6h para esse `user_id`/`phone` que tenha `parsed_intent.pending_action` não consumida (status outbound != 'pending_action_consumed'), via:
   ```sql
   SELECT id, parsed_intent, linked_entity_id, tenant_id, arena_id
   FROM conversational_commands
   WHERE direction='outbound' AND initiated_by='orkym'
     AND user_id = $1 AND parsed_intent->'pending_action' IS NOT NULL
     AND created_at > now() - interval '6 hours'
     AND status <> 'pending_action_consumed'
   ORDER BY created_at DESC LIMIT 1
   ```
3. Se encontrado → invocar **`control-tower-execute`** com `{ scope, recommendation }` montado a partir de `pending_action`. Reusa toda a lógica de Phase H (kill-switch, budget, idempotência, dispatch via `_shared/orkym-handlers.ts`).
4. Atualizar a outbound original com `status='pending_action_consumed'` para impedir re-execução; registrar feedback `accepted` em `orkym_trigger_feedback`.
5. Responder no inbound com confirmação humana mapeada por `action_type` (mesma copy de `controlTowerCopy.ts`, mas em frase completa):
   - `tournament_boost` → "Perfeito. Já estou divulgando seu torneio. Você deve começar a receber mais inscrições em breve."
   - `fill_idle_slots` → "Combinado. Já estou avisando quem costuma jogar nesse horário."
   - `reactivation_message` → "Pode deixar. Já estou enviando o convite."
   - `create_campaign`/`product_boost` → "Show. Já estou impulsionando agora."
   - fallback → "Pronto, já estou cuidando disso."
6. Se a ação falhar/for bloqueada (kill-switch/budget): "Tudo bem, vou tentar de novo mais tarde." (sem detalhes técnicos).
7. **Importante**: o status check do enum `conversational_commands_status_check` precisa aceitar `'pending_action_consumed'`. Migration: `ALTER TABLE conversational_commands DROP CONSTRAINT … ADD CONSTRAINT … CHECK (status IN (..., 'pending_action_consumed'))`.

Resposta negativa explícita ("não/n/nope") → marcar outbound como `pending_action_consumed`, feedback `declined`, responder "Sem problema. Quando quiser, é só me chamar."

Outras respostas (texto livre) → cair no fluxo ORKYM atual (nenhuma mudança).

### 4. Templates de confirmação (humano, sem jargão)

Novo módulo `supabase/functions/_shared/confirmation-templates.ts` mapeia `action_type` → frase completa. Reutiliza tom do `controlTowerCopy.ts` mas em sentença finalizada.

### 5. Guardrails reforçados

Manter intactos:
- `orkym_proactive_check_eligibility` (cooldown, opt-in).
- Kill-switch + budget no `control-tower-execute`.
- Dedup `dedup_key` da fila.

Adicionar:
- Cap diário 2 msg/24h por `user_id` (item 2 acima).
- TTL de 6h para `pending_action`: replies depois disso voltam ao fluxo ORKYM normal.

### 6. Memória / observabilidade

- `orkym_trigger_feedback.event` ganha valores `accepted` e `declined` (já é texto livre — sem mudança de schema).
- Logar `arena_operational_events('proactive_action.executed' | 'proactive_action.declined')` para o admin.

## Arquivos afetados

```text
supabase/functions/_shared/proactive-templates.ts        (NOVO)
supabase/functions/_shared/confirmation-templates.ts     (NOVO)
supabase/functions/orkym-proactive-process/index.ts      (gera msg local + cap diário; remove ORKYM round-trip)
supabase/functions/wa-bridge/index.ts                    (intercepta afirmação/negação ANTES do ORKYM)
supabase/migrations/<ts>_pending_action_status.sql       (adiciona 'pending_action_consumed' ao check de status)
mem/features/proactive-ops.md                            (atualizar — agora deterministic local templates)
mem/features/control-tower-ai.md                         (ligar com loop WhatsApp)
mem/index.md                                             (atualizar Core)
```

Sem mudanças de schema além do enum de status (uma constraint).

## Detalhes técnicos importantes

- **Por que NÃO depender mais do ORKYM externo para o conteúdo da mensagem**: usuário pediu formato fixo (observação + sugestão + pergunta) e respostas humanas previsíveis. Templates determinísticos garantem 100% de cobertura mesmo com ORKYM offline. ORKYM continua dono do canal WhatsApp via `wa-send-message` — só não decide mais o texto desses insights proativos.
- **Sem IA local**: templates são strings com placeholders `{name}/{when}/{n}`. Nenhuma decisão dinâmica.
- **Idempotência**: o `pending_action_consumed` impede duplo execute se o usuário responder duas vezes. O `dedup_key` em `control-tower-execute` (já implementado) é segunda barreira.
- **Privacidade**: nenhum log expõe ORKYM/IA. Todas as respostas são humanas-naturais.
- **Athlete-side `relevant_tournament`/`near_rank_up`**: `action_type=send_proactive_message` na verdade só registra/encaminha — não dispara campanha. Mantém o atleta no controle.

## Critérios de sucesso (testes manuais)

1. Trigger `tournament_low_enrollment` é gerado → usuário recebe **uma** msg "Percebi que seu torneio … Quer que eu faça isso?".
2. Usuário responde "sim" → `control-tower-execute` cria `ad_campaigns(tournament_highlight)` + queue `relevant_tournament` → usuário recebe "Perfeito. Já estou divulgando…" em <3 s.
3. Usuário responde "não" → outbound marcada consumida, recebe "Sem problema. Quando quiser, é só me chamar." Nenhuma campanha criada.
4. Usuário responde "vai um açaí" → cai no fluxo ORKYM (nenhum impacto).
5. Usuário recebe 2ª msg no mesmo dia → 3ª é bloqueada (`daily_cap`), feedback `skipped`.
6. Kill-switch ativo → ação bloqueada após "sim", reply é "Tudo bem, vou tentar de novo mais tarde."
7. Reply "sim" 7h depois da msg original → TTL expirado, cai no ORKYM.

## Não-objetivos

- Não criar IA local nem reasoning local.
- Não expor ORKYM/IA/termos técnicos em nenhum texto enviado.
- Não criar painel de configuração para o usuário.
- Não permitir múltiplas sugestões na mesma mensagem.
