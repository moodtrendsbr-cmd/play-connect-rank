# Camada de Integração ORKYM ↔ MoodPlay — Gap Analysis e Complementos

## Diagnóstico: 80% já está implementado

Quase todo o escopo desta spec foi entregue nas Fases **12.5 e 12.6** (ORKYM Execution Bridge + ORKYM-as-Gateway). Mapeamento item-por-item do que você pediu vs. o que existe hoje:

| # | Item da spec | Estado atual | Ação necessária |
|---|---|---|---|
| 1 | WhatsApp Instance Routing | ✅ Tabelas `whatsapp_instances` + `whatsapp_bindings` (tenant/arena/organizer/company/global fallback) + RPC `resolve_whatsapp_instance` com hierarquia de prioridade | Nada — já completo |
| 2 | Identity Resolution | ✅ Tabelas `wa_identities`, `wa_leads`, `wa_qr_tokens` + RPC `resolve_whatsapp_identity` retornando user/profile/tenant/arena/verified/is_lead/available_profiles | Nada — já completo |
| 3 | Execution Bridge | ✅ Edge function `moodplay-execute-action` v12.6 (HMAC obrigatório + timestamp + idempotência), reusando 100% dos handlers em `_shared/orkym-handlers.ts`. Catálogo: 9 read-only + 5 operacionais + 9 proposal-based | Nada — já completo |
| 4 | Event Feedback Layer | ✅ Resposta síncrona padronizada `{ok, command_id, execution_status, linked_entity, checkout_link?, qr_link?, response_summary, follow_up_actions[]}` + auditoria em `security_audit_log` | Nada — já completo |
| 5 | Conversational Command History | ✅ Tabela `conversational_commands` com todos os campos (direction, instance, raw/normalized input, intent, action, status, result, linked_entity, correlation_id) + Realtime no `CommandHistoryCard` | Nada — já completo |
| 6 | Proactive Messaging | ⚠️ **Mudou de modelo**: outbound (wa-send-message) foi removido — agora ORKYM é o gateway e dispara via canal próprio. MoodPlay apenas mantém `orkym_proactive_eligibility` (opt-in) e expõe contexto via read-only actions | Documentar a mudança de modelo |
| 7 | Fallback / Herança de Instância | ✅ `resolve_whatsapp_instance` com chain: arena → organizer → company → tenant → profile → global fallback | Nada — já completo |
| 8 | Security | ✅ HMAC SHA-256 obrigatório + timestamp skew 5min + idempotência + cross-tenant validation + `security_audit_log` em todas as fases (received/executed/failed/no_action/deduplicated) + 11 testes Deno passando | Nada — já completo |
| 9 | Dashboard Reflection | ✅ `CommandHistoryCard` (Realtime) presente em ArenaCommands, OrganizerCommands, AthleteCommands, CompanyCommands, TenantCommands, AdminCommands | Nada — já completo |
| 10 | Não-fazer | ✅ Zero IA local no MoodPlay; toda decisão fica na ORKYM | Reforçar na memória |
| 11 | Entregáveis | ⚠️ Falta apenas **Entrega B (relatório estrutural)** e **Entrega C (riscos/pendências)** consolidados | Gerar relatório markdown |
| 12 | Critério de sucesso | ✅ Todos atendidos | Nada |

## O que efetivamente vou fazer

Como o código está 100% pronto, esta fase é de **consolidação documental + 1 ajuste técnico pequeno**:

### 1. Atualizar `mem://integration/orkym-contract.md`
Remover seções obsoletas que ainda mencionam `wa-send-message`, `wa-delivery-webhook` e secrets de provider Twilio/Meta/Evolution (esses endpoints foram deletados quando migramos para ORKYM-as-gateway). Substituir por nota explícita: "Outbound e delivery webhooks são responsabilidade da ORKYM. MoodPlay só recebe chamadas em `/moodplay-execute-action`."

### 2. Atualizar `mem://integration/orkym-execution-bridge.md`
Marcar Phase 12.6 como concluída e remover pendências obsoletas (Twilio/Meta dispatch).

### 3. Criar `mem://integration/orkym-gateway-architecture.md` (novo)
Memória única consolidando os 12 pontos da spec → onde cada um vive no código (tabelas, RPCs, edge functions, componentes). Serve como ponto de entrada para qualquer nova sessão entender a arquitetura.

### 4. Gerar relatório estrutural (`/mnt/documents/orkym-moodplay-integration-report.md`)
Documento entregável com:
- **Entrega B** — Como instância é resolvida, como identidade é resolvida, como ORKYM chama MoodPlay, formato de resposta, persistência de histórico, preparação para proatividade, reaproveitamento vs. criado
- **Entrega C** — Riscos e pendências (do lado ORKYM, do lado provider, próxima fase)
- Tabelas de mapeamento spec ↔ implementação
- Diagrama ASCII do fluxo end-to-end

### 5. Pequeno ajuste técnico — sanity check
Rodar os 11 testes Deno (`moodplay-execute-action` integration + hmac) para confirmar que o contrato continua verde após as últimas remoções de outbound. Se algo quebrou, corrigir.

## O que NÃO vou fazer (e por quê)

- **Não vou recriar `wa-send-message`** — você aprovou explicitamente removê-lo na mensagem "pode remover" porque ORKYM é o gateway agora.
- **Não vou criar novas tabelas** — todas as 7 tabelas necessárias (whatsapp_instances, whatsapp_bindings, whatsapp_messages, wa_identities, wa_leads, wa_qr_tokens, conversational_commands, orkym_proactive_eligibility) já existem.
- **Não vou criar novas edge functions** — `moodplay-execute-action` + `wa-bridge` cobrem inbound/execução.
- **Não vou tocar em handlers de negócio** — `_shared/orkym-handlers.ts` é a única camada de execução e está reusada por dois caminhos (orkym-execute-action interno + moodplay-execute-action externo).

## Detalhes técnicos

```text
ORKYM (cérebro/WhatsApp gateway)
   │
   │ POST /functions/v1/moodplay-execute-action
   │ Headers: X-MoodPlay-Signature (HMAC), X-Request-Timestamp, X-Idempotency-Key
   │ Body:    { tenant_id, arena_id, user_id, profile_type, action_type, payload, source, correlation_id }
   ▼
moodplay-execute-action (edge fn)
   ├─ verifyHmac()           ── ORKYM_HMAC_SECRET
   ├─ checkTimestampSkew()   ── 5 min window
   ├─ checkIdempotency()     ── X-Idempotency-Key
   ├─ validateCrossTenant()  ── arena ∈ tenant
   ├─ auditLog('received')
   ├─ dispatchAction()       ── _shared/orkym-handlers.ts
   │     ├─ READ_ACTIONS     ── 9 RPCs SECURITY DEFINER (get_arena_summary, ...)
   │     ├─ RPC_OPERATIONAL  ── 5 RPCs (generate_billing_cycle, ...)
   │     └─ PROPOSAL         ── 9 inserções em orkym_action_proposals (auto-aprovadas)
   ├─ persistCommand()       ── conversational_commands (Realtime → dashboards)
   ├─ auditLog('executed' | 'failed' | 'deduplicated')
   ▼
Response: { ok, command_id, execution_status, linked_entity, checkout_link?, qr_link?,
            response_summary, follow_up_actions[] }
```

## Critério de aceite

- Os 3 arquivos de memória atualizados/criados
- Relatório markdown em `/mnt/documents/`
- 11 testes Deno passando (verificação)
- Confirmação explícita no chat de que **nenhuma camada de IA foi adicionada** ao MoodPlay nesta passagem

Aprovando, executo tudo em uma sequência (memórias → testes → relatório).
