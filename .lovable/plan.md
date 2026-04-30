
# Plano — Insights Proativos via WhatsApp (10 insights + anti-spam + prioridade)

## Estado atual
- Já existe pipeline: `orkym_triggers_queue` → `orkym-proactive-process` (templates locais, cap 2/24h) → `wa-bridge` (interpreta sim/não → executa). Tudo da Phase H já entregue.
- Generators atuais cobrem **2 dos 10** insights:
  - `tournament_low_enrollment` / `low_enrollment` (mas thresholds não batem com a spec).
  - `inactive_athlete` (com 30 dias; spec pede 5+ dias).
- Faltam 8 generators e 8 templates de mensagem.
- Falta gap mínimo de **6h entre QUAISQUER duas msgs** ao mesmo usuário (hoje só temos cap diário 2/24h e cooldown por trigger_type).
- Falta seletor de **prioridade na claim** — hoje a fila pega na ordem (priority, scheduled_for) mas não consolida múltiplos triggers do mesmo usuário no mesmo tick.

## O que será feito

### 1. Migration única — generators + ajustes nos thresholds

Criar/substituir `growth_generate_opportunity_triggers()` para cobrir os 10 insights. Cada bloco enfileira com `dedup_key` por dia para evitar duplicidade.

| # | Insight | trigger_type | Condição (SQL) | Destino |
|---|---|---|---|---|
| 1 | Baixa inscrição | `tournament_low_enrollment` | `tournaments.status IN ('published','active') AND start_date BETWEEN now() AND now()+48h AND enrolled/capacity < 0.6` | organizer |
| 2 | Horário ocioso | `idle_court_slot` | janela horária com ocupação <40% nos últimos 3 dias (agregado por (arena_id, dow, hour) sobre `bookings`) | arena |
| 3 | Usuários inativos | `inactive_athlete` | usuário com pelo menos 1 booking/enrollment histórico, sem atividade nos últimos 5 dias e <14d (evita reincidência) | athlete |
| 4 | Aulas com vagas | `class_open_seats` | `arena_classes.is_active=true AND vagas_livres/capacity > 0.3` (próximas 7 dias) | arena |
| 5 | Perto de subir ranking | `near_rank_up` | atleta no top-10 da view `ranking_global`/`ranking_by_arena` com gap ≤30 pts pro próximo | athlete |
| 6 | Produto baixa visibilidade | `low_product_views` | produto ativo com <20 views/7d e nenhum boost ativo | company |
| 7 | Torneio cheio (expansão) | `tournament_high_demand` | inscritos/capacity > 0.9 e start_date > now() | organizer |
| 8 | Campanha fraca | `low_campaign_performance` | `ad_campaigns.status='active'` há >3d com CTR <2% **OU** conversão=0 | company/organizer (donos da campanha) |
| 9 | Arena baixa movimentação | `arena_low_activity` | bookings 7d / média da rede (mesmo tenant) < 0.5 | tenant |
| 10 | Alta demanda | `high_demand_signal` | buscas/reservas nos últimos 3d > 1.5× média da arena E ≥1 horário próximo esgotado | arena |

Detalhes de implementação:
- Janelas com `dedup_key` baseado em `to_char(now(),'YYYYMMDD')` para 1 disparo/dia/entidade.
- Para insights 2/4/9/10 que precisam de SQL pesado, materializar com CTEs e `LIMIT` defensivo (≤200 por bucket).
- Insight 5 depende das views `ranking_global`/`ranking_by_arena` já existentes (Phase G-4).
- Insight 8 lê `ad_campaigns.metrics` (jsonb) com `(metrics->>'ctr')::numeric`. Se a métrica não existir, ignora (não erra).
- Inserir também índice `idx_bookings_arena_starts_at` se não existir, pra suportar 2/4/9/10.

### 2. Função de elegibilidade reforçada — gap de 6h

Criar nova RPC `orkym_proactive_check_global_gap(_user_id)` chamada antes de enviar:
```sql
SELECT EXISTS (
  SELECT 1 FROM conversational_commands
   WHERE user_id = _user_id
     AND direction = 'outbound' AND initiated_by = 'orkym'
     AND created_at > now() - interval '6 hours'
);
```
- Em `orkym-proactive-process`, antes do daily-cap, checar este gap. Se `true` → marcar trigger `skipped` com `reason='global_gap_6h'` e re-agendar para `now()+6h` (em vez de descartar; assim o insight não some).

### 3. Seletor de prioridade dentro do tick

Em `orkym-proactive-process`, depois de `claim_batch`, agrupar por `user_id` e manter **somente o trigger de maior prioridade** dessa lista (na ordem da spec). Os demais voltam para a fila com `status='pending'` e `scheduled_for=now()+6h`.

Ordem (em ENUM no código TS, não em SQL):
```
tournament_low_enrollment > idle_court_slot > inactive_athlete > class_open_seats >
low_campaign_performance > low_product_views > near_rank_up >
tournament_high_demand > arena_low_activity > high_demand_signal
```

### 4. Templates de mensagem (texto exato da spec)

Atualizar `_shared/proactive-templates.ts` adicionando os 8 novos types com as frases textuais da spec (1 obs + 1 sug + 1 pergunta) e seus respectivos `pending_action`:

| trigger_type | Mensagem (literal) | action_type |
|---|---|---|
| `tournament_low_enrollment` | "Seu torneio ainda está com poucas inscrições. Posso ajudar a atrair mais jogadores agora?" | `tournament_boost` |
| `idle_court_slot` | "Suas quadras estão ficando vazias nesse horário. Posso ajudar a atrair jogadores?" | `fill_idle_slots` |
| `inactive_athlete` | "Alguns jogadores não voltam há alguns dias. Posso ajudar a trazer eles de volta?" | `reactivation_message` |
| `class_open_seats` | "Você ainda tem vagas em algumas aulas. Posso ajudar a preencher essas turmas?" | `fill_idle_slots` (reuso, payload com `target='class'`) |
| `near_rank_up` | "Você está perto de subir no ranking. Quer jogar hoje para avançar?" | `send_proactive_message` |
| `low_product_views` | "Seu produto pode ter mais visibilidade. Posso destacar ele para mais jogadores?" | `product_boost` |
| `tournament_high_demand` | "Seu torneio está quase cheio. Quer abrir novas vagas ou criar uma nova edição?" | `send_proactive_message` (purpose=`expand_tournament`) |
| `low_campaign_performance` | "Sua campanha pode melhorar. Posso ajustar para trazer mais resultados?" | `create_campaign` (com flag `replace=true`) |
| `arena_low_activity` | "Uma das suas arenas está com pouca movimentação. Posso ajudar a atrair mais jogadores?" | `tournament_boost` (no nível do tenant) — *nota técnica: usaremos `create_campaign` que dispara feed_ads scoped à arena* |
| `high_demand_signal` | "Muita gente está procurando jogos agora. Podemos aproveitar isso para aumentar sua receita." | `create_campaign` |

Confirmação humana após execução: continua usando `confirmationFor()` já existente. Adicionaremos uma frase genérica para os novos action types que caem no fallback.

### 5. Cooldowns por trigger_type

Inserir cooldowns padrão em `orkym_proactive_cooldowns_defaults` (se a tabela existir; senão usamos a função `orkym_trigger_default_cooldown`). Spec implícita: "não repetir o mesmo insight em 24h" → cooldown = 24h para todos. Ajustar via constante no código TS de `orkym-proactive-process` se a função não tiver default por type.

### 6. Observabilidade

- Manter `orkym_trigger_feedback` (eventos `message_sent | accepted | declined | blocked | ignored`).
- Eventos `arena_operational_events('proactive_action.*')` já são gravados no `wa-bridge` (Phase H).
- Adicionar log estruturado em `orkym-proactive-process` para cada filtro: `reason: priority_lost | global_gap_6h | daily_cap | ineligible`.

## Arquivos afetados

```text
supabase/migrations/<ts>_proactive_insights_generators.sql   (substitui growth_generate_opportunity_triggers + cria orkym_proactive_check_global_gap)
supabase/functions/_shared/proactive-templates.ts            (8 templates novos + textos da spec)
supabase/functions/_shared/confirmation-templates.ts         (pequenos ajustes de fallback)
supabase/functions/orkym-proactive-process/index.ts          (gap 6h + dedup por user_id por tick + reschedule)
mem/features/proactive-ops.md                                (atualizar com 10 insights e regras)
mem/index.md                                                 (Core: 10 insights ativos, gap 6h, prioridade ordenada)
```

Sem novas tabelas. Reuso integral da fila e do dispatcher já implementados.

## Detalhes técnicos importantes

- **Índices**: a função generator depende de leituras frequentes em `bookings(arena_id, starts_at)`, `tournaments(start_date,status)`, `tournament_enrollments(tournament_id,status)`, `ad_campaigns(status,started_at)`, `arena_classes(starts_at,is_active)`. Conferir e criar os que faltarem (a maioria já existe pela Phase G).
- **Custo**: cron roda a cada 15 min; cada generator tem `LIMIT` interno e usa CTEs com agregações, não loops por linha. Carga aceitável.
- **Fail-soft**: cada bloco do generator é independente em `BEGIN EXCEPTION WHEN OTHERS THEN`-style (loga e continua) para que falha em um insight não derrube os outros.
- **Reuso de action_types**: a maioria mapeia para os handlers existentes em `_shared/orkym-handlers.ts`. Não precisamos criar handlers novos. Insight 7 (`expand_tournament`) e 5 (`tips`) usam `send_proactive_message` que apenas envia conteúdo — não exige novo backend.
- **Sem IA local**: thresholds e mensagens são fixos. Ranking de insights é uma constante TS.
- **Sem expor jargão**: nenhuma das frases novas menciona ORKYM, IA, sistema, painel, configuração.

## Critérios de sucesso (testes)

1. Cron tick → `growth_generate_opportunity_triggers()` retorna integer >0 com a fila populada de pelo menos 1 dos 10 types.
2. Usuário com 3 oportunidades simultâneas recebe **uma só** mensagem (a mais prioritária); as outras voltam pendentes.
3. Após enviar 1 mensagem, qualquer próxima dentro de 6h é bloqueada com `reason=global_gap_6h` e remarcada.
4. Mesma oportunidade gerada duas vezes no dia: a segunda é bloqueada por `dedup_key`.
5. Reply "sim" → action_type correto roda no `control-tower-execute`, `wa-bridge` responde com a frase correta.
6. Insight 8 (`low_campaign_performance`) só dispara para campanhas com `status='active'` há >3d.

## Não-objetivos
- Não alterar UI da Control Tower.
- Não criar novas tabelas.
- Não tocar em `orkym-invoke` nem em ORKYM externo.
- Não criar novos action_type backends — todos os 10 reusam handlers existentes.
- Não remover generators atuais que já cobrem outros casos (subscriptions due, top_product etc.) — apenas acrescentar/refinar.
