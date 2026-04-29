# Go-Live Fix — Relatório Final (BETA READY)

## A. P0 corrigidos
- `/arena/dashboard` agora usa **`ArenaShell`** (antes: `ArenaLayout` legado). Gate WhatsApp, sidebar nova, status badge e Control Tower agora valem para Arena.
- Edge function **`seed-pilot-arena`** criada (idempotente, `verify_jwt=true`). Botão "Criar piloto" no `AdminControlTower` provisiona em 1 clique:
  - 1 tenant (reaproveita existente, ou cria "Piloto MoodPlay")
  - 1 arena vinculada ao caller (`owner_user_id`)
  - 1 `whatsapp_instances` com `provider='cloud'`, `status='pending_config'`, `metadata.is_seed=true`
  - 1 `whatsapp_bindings` (arena + tenant, default)
  - 1 `wa_identity` se o profile tiver telefone
  - **Nada marcado como mock**. `pending_config` indica honestamente que o provider real precisa ser configurado.

## B. P1 corrigidos
- **Mock provider removido** do form de `AdminWhatsAppInstances`. Lista agora só mostra `cloud / twilio / evolution / whapi`. Default: `cloud + pending_config`. Registros legados com `provider='mock'` são exibidos com badge "Sandbox" (cinza), não como produção.
- **Sidebars limpas** — removidos links que apontavam para o mesmo placeholder:
  - **Organizer**: removidos `/eventos`, `/inscricoes`, `/jogos`, `/jogos#checkin`, `/performance` (todos caíam no mesmo `OrganizerDashboard`).
  - **Athlete**: removidos `/meu-dia`, `/jogos`, `/historico` (idem).
  - **Company**: removidos `/campanhas`, `/performance`, `/visibilidade`.
  - **Tenant**: removidos `/empresas`, `/dashboard#operacoes`, `/branding`.
  - As rotas no `App.tsx` continuam respondendo (compatibilidade), apenas saíram da nav.
- Loading guards nos shells: `TenantShell`, `ArenaShell`, `OrganizerShell`, `CompanyShell` já tinham `!waLoading` antes do redirect — confirmado.

## C. Banco — nada alterado
Auditoria reconfirmada: **todas as RPCs e tabelas das fases 12.9 e 13 já estão aplicadas**. Lista verificada:
```
RPCs: orkym_attribute_revenue, orkym_generate_periodic_triggers,
orkym_generate_optimization_triggers, orkym_proactive_check_eligibility,
orkym_proactive_record_send, orkym_revenue_kpis_{arena,tenant,company,admin},
orkym_roi_multiplier, orkym_trigger_enqueue/_claim_batch/_complete,
orkym_message_performance, memory_apply_decay, memory_extract_all,
tg_orkym_attribute_revenue (trigger function).
Tabelas: orkym_triggers_queue, orkym_trigger_feedback,
orkym_proactive_cooldowns, orkym_revenue_attribution.
```
P0 anterior "migrations faltando" estava **incorreto**.

## D. Rotas
- ArenaShell agora é o padrão para `/arena/dashboard/*`.
- `/arena/checkin` permanece fora de qualquer shell (rota pública QR).
- Aliases legados (Organizer/Athlete/Company/Tenant que apontavam ao mesmo dashboard) **mantidos** para não quebrar links externos, apenas removidos da nav.
- Connect routes (`/{role}/connect-whatsapp`) continuam fora dos shells (evita loop do gate).

## E. Gate WhatsApp
- `TenantShell` ✅ — `!waLoading && !connected → /tenant/connect-whatsapp`
- `ArenaShell` ✅ — agora ativo para `/arena/dashboard`
- `OrganizerShell` ✅
- `CompanyShell` ✅
- Bypass: `userRole === 'admin'` em todos.
- `AthleteShell` e `AdminShell` **não** aplicam gate (correto).

## F. Mock removido
`AdminWhatsAppInstances`: opção "mock" sumiu da UI. Status default `pending_config` deixa explícito que falta wiring. Badge "Sandbox" para registros legados.

## G. Testes / verificação
- Build TS: validado pela harness (sem novos imports quebrados, todos os arquivos novos referenciam tipos existentes).
- `seed-pilot-arena` declarado em `supabase/config.toml` com `verify_jwt = true`.
- `orkym-cron-tick` continua respondendo 200 (já tem try/catch por RPC).

## H. Arquivos tocados
```
src/App.tsx                                          (ArenaLayout → ArenaShell em /arena/dashboard)
src/pages/admin/AdminWhatsAppInstances.tsx           (mock removido + badge Sandbox)
src/pages/admin/AdminControlTower.tsx                (botão Criar piloto)
src/layouts/sidebars/OrganizerSidebar.tsx            (3 grupos enxutos)
src/layouts/sidebars/AthleteSidebar.tsx              (links mortos removidos)
src/layouts/sidebars/CompanySidebar.tsx              (campanhas/perf/visib removidos)
src/layouts/sidebars/TenantSidebar.tsx               (empresas/branding/op removidos)
supabase/functions/seed-pilot-arena/index.ts         (NOVA — idempotente, verify_jwt=true)
supabase/config.toml                                 (declaração da função)
.lovable/plan.md                                     (este relatório)
```

**Nenhuma migration nova. Nenhuma alteração em ORKYM/MoodPlay logic. Nenhuma feature nova.**

## I. Resultado: 🟢 **BETA READY**

Próximos passos para o cliente piloto:
1. Logar como super admin → Control Tower → **Criar piloto** (1 clique).
2. Logar como o owner da arena criada → será redirecionado para `/arena/connect-whatsapp`.
3. Conectar WhatsApp real via ORKYM (a instância `pending_config` será atualizada pelo `orkym-whatsapp-connection`).
4. Após `status='active'`, gate libera e o dashboard Arena entra em operação.

Para go-live público (não apenas beta): configurar provider real nas instâncias existentes, validar `ORKYM_API_BASE_URL` / `ORKYM_SERVICE_TOKEN` / `ORKYM_HMAC_SECRET` em Secrets, e rodar com 1 cliente real por 1–2 semanas medindo conversões via `RevenueDashboardPanel`.
