
# 🔍 Auditoria de Go Live — MoodPlay

> Diagnóstico apenas. Nada será alterado no código, banco, edge functions ou RLS.

---

## 1. Resumo Executivo

O MoodPlay é um produto **funcionalmente ambicioso** com forte estrutura por perfis (Athlete, Organizer, Arena, Tenant Admin, Company, Super Admin), shells separados, gating WhatsApp, e camadas de ORKYM (Memory, Proactive Ops, Revenue Attribution).

Porém a auditoria revelou **um bloqueador crítico de produção (P0)** e várias inconsistências relevantes (P1) que tornam **inviável o go live em produção pago hoje**, mas viável um **beta fechado, controlado, com Super Admin como único operador real**.

**Status geral: 🔴 BLOCKED para produção aberta · 🟡 PASS WITH FIXES para beta fechado.**

---

## 2. Status Geral por Perfil

| Perfil | Status | Bloqueador principal |
|---|---|---|
| Super Admin | 🟡 PASS WITH FIXES | Phase 12.9/13 RPCs ausentes no DB |
| Tenant Admin | 🔴 BLOCKED | Sem dados (0 tenants utilizáveis), rotas-alias quebradas |
| Arena | 🔴 BLOCKED | 0 arenas no DB, ArenaShell não usado nas rotas reais |
| Organizer | 🟡 PASS WITH FIXES | 4 rotas distintas renderizam o mesmo componente |
| Athlete | 🟡 PASS WITH FIXES | 3 rotas distintas renderizam o mesmo componente |
| Company | 🟡 PASS WITH FIXES | 3 rotas distintas renderizam o mesmo componente |

---

## 3. 🚨 Problemas P0 — Bloqueiam Go Live

### P0-1 — Migrations das Fases 12.9 e 13 NÃO foram aplicadas no banco
A migration declara 15+ funções (`orkym_attribute_revenue`, `orkym_proactive_check_eligibility`, `orkym_revenue_kpis_arena/tenant/company/admin`, `orkym_message_performance`, `orkym_trigger_enqueue`, `orkym_trigger_claim_batch`, `orkym_trigger_complete`, `orkym_proactive_record_send`, `orkym_generate_periodic_triggers`, `orkym_generate_optimization_triggers`, `orkym_roi_multiplier`, `tg_orkym_attribute_revenue`, `trg_proactive_subscription/attendance/order`).

**Verificado via `pg_proc`**: nenhuma dessas funções existe no DB. Apenas as funções da Fase 12.5 (`orkym_action_approve`, `orkym_check_quota`, `orkym_get_tenant_tier`, etc.) estão presentes. **Zero triggers de attribution/proactive registrados em `information_schema.triggers`.**

Consequências:
- `RevenueDashboardPanel` (usado em Arena/Tenant/Company/Admin Dashboards) chamará RPCs inexistentes → erro RPC 404 ou retorno vazio.
- `useOrkymTriggers` lerá tabela vazia.
- `orkym-proactive-process` falhará ao chamar `orkym_trigger_claim_batch`.
- `orkym-cron-tick` falhará ao chamar `orkym_generate_periodic_triggers` e `orkym_generate_optimization_triggers`.
- `wa-bridge` feedback loop (`orkym_trigger_feedback`) sem trigger source → tabela ficará vazia.
- Edge function `wa-send-message` não tem fallback se `ORKYM_API_BASE_URL` / `ORKYM_SERVICE_TOKEN` / `ORKYM_HMAC_SECRET` não estão configurados (verificar Secrets).

### P0-2 — Banco em estado vazio para validação de fluxos
- `arenas`: **0 registros**
- `whatsapp_instances`: **0**
- `wa_identities`: **0**
- `financial_transactions`: **0**
- `orkym_triggers_queue`: **0**
- `conversational_memory`: **0**

Sem arena, ArenaShell redireciona para `/feed`. Sem WA instances, todo gate WhatsApp dos shells (Tenant/Arena/Organizer/Company) **bloqueia 100% dos usuários não-admin** indefinidamente em `/connect-whatsapp`. Não dá para vender beta sem ao menos 1 cliente seedado.

### P0-3 — `ArenaShell` está implementado mas NÃO está em uso
`src/App.tsx` ainda usa o legado `ArenaLayout` em `/arena/dashboard/*`. O `ArenaShell` (com gate WhatsApp + sidebar nova) foi criado mas só é importado, nunca rotado. Resultado: Phase 13 connection gate **não bloqueia arenas** — qualquer arena owner entra direto no dashboard sem WhatsApp conectado, divergindo da política declarada na Core memory.

---

## 4. ⚠️ Problemas P1 — Corrigir Antes de Vender

### P1-1 — Rotas-alias renderizando o MESMO componente (UX quebrada)
- **Organizer**: `/organizer/dashboard`, `/eventos`, `/inscricoes`, `/jogos`, `/performance` → todas renderizam `<OrganizerDashboard />`. Sidebar promete páginas distintas; usuário vai clicar e ver a mesma tela.
- **Athlete**: `/athlete/dashboard`, `/meu-dia`, `/jogos`, `/historico` → todas renderizam `<AthleteDashboard />`.
- **Company**: `/company/dashboard`, `/campanhas`, `/performance`, `/visibilidade` → todas renderizam `<CompanyDashboard />`.
- **Tenant**: `/tenant/empresas` renderiza `<OrganizerArenas />` (página de arenas, não empresas). `/tenant/branding` renderiza `<OrganizerSettings />` (settings, não branding). `/tenant/overview` idem.

Itens da sidebar têm rota válida mas conteúdo inexistente para a feature anunciada.

### P1-2 — Atalho de Check-in do Organizer aponta para hash inexistente
`OrganizerSidebar`: `/organizer/dashboard/jogos#checkin`. Não há `id="checkin"` em `OrganizerDashboard.tsx` — `scroll-mt-20` espera anchor que provavelmente não existe.

### P1-3 — Gate WhatsApp obrigatório com 0 instâncias = lock-out total
TenantShell, ArenaShell (não-rotado), OrganizerShell, CompanyShell todos redirecionam para `/connect-whatsapp` se não-admin e não-conectado. Como `whatsapp_instances` está vazio e a integração ORKYM depende de secrets externos não verificáveis aqui, **nenhum usuário comum consegue usar o app**. Apenas Super Admin (bypass) funciona.

### P1-4 — `ConnectWhatsApp` dispatcher pode redirecionar para `/` em loop
Se um usuário autenticado **sem** tenant membership, sem arena, sem company e sem role `organizer` cair em `/connect-whatsapp`, o dispatcher manda para `/`. Em `/` (Index), se ele for redirecionado para shell, volta a cair em `/connect-whatsapp`. Loop sutil para perfil "atleta puro" — mas atleta não tem gate, então ok. Risco real: usuário que perdeu vínculo (ex.: arena deletada).

### P1-5 — Hardcodes & mocks visíveis no Admin
- `AdminWhatsAppInstances.tsx`: provider default = `"mock"`, opção `Mock (dev)` exposta na UI de produção.
- `AdminSplitRules.tsx`: texto literal "Fallback hardcoded (platform=10%)" — denuncia regra fixa, mas se a regra for de fato hard-coded fora do DB (a auditar em código de split), é P1 financeiro.

### P1-6 — `RevenueDashboardPanel` em 4 dashboards quebrados
Como as RPCs `orkym_revenue_kpis_*` não existem (P0-1), os 4 dashboards principais mostrarão erro ou cards zerados sem contexto. Visual fica "vazio sem motivo claro" em produção.

### P1-7 — `TenantContext` chama `set_current_tenant` GUC sem garantia de uso
Hook seta GUC por sessão para RLS-aware, mas RLS de tabelas multi-tenant atuais usa `is_tenant_admin(tenant_id, auth.uid())` direto, não `current_setting`. O GUC vira no-op e mascara intenção; risco de manutenção.

---

## 5. 🟢 P2 — Pode Corrigir Depois

- **P2-1** — `AdminLayout` (legado) coexiste com `AdminShell` (novo); `AdminShell` é importado mas nunca rotado. Consolidar.
- **P2-2** — `OrganizerLayout` (legado em `/organizer`) coexiste com `OrganizerShell` (`/organizer/dashboard`). Mantém duas IAs simultâneas.
- **P2-3** — Sidebar do Tenant tem entrada "Eventos" → `/tenant/dashboard#operacoes` (anchor; aceitável, mas frágil).
- **P2-4** — `AthleteShell` sem header com nome do atleta (sempre "MoodPlay").
- **P2-5** — `ArenaShell` header sempre mostra "MoodPlay" em vez do nome da arena (vs `ArenaLayout` legado, que mostra `arena.name`).
- **P2-6** — `Dashboard.tsx` (rota `/dashboard`) ainda existe sem shell e sem guard explícito; fallback histórico.
- **P2-7** — `AdminDashboard` mistura "Receita Canônica" + "Receita Mood (Comissões)" + "Receita Marketplace" — três métricas de receita sem hierarquia clara.

---

## 6. 🔵 P3 — Melhorias Futuras

- Consolidar 6 sidebars em um sistema declarativo único.
- Mostrar empty states ricos quando tabelas estão vazias (hoje só renderiza zero/`—`).
- `TenantWhatsAppRouting` carece de explicação de impacto antes de criar binding.
- Dark mode é o único modo suportado (Core memory) — confirmar que nenhum componente shadcn assumiu light tokens.

---

## 7. Auditoria por Eixo

### 7.1 Rotas (App.tsx — 334 linhas, 6 árvores de routing paralelas)
- **Quebradas/órfãs**: nenhuma rota 404 dura, mas várias **renderizam o componente errado** (ver P1-1).
- **Aliases legados ainda ativos**: `/dashboard`, `/admin` (AdminLayout), `/organizer/*` (OrganizerLayout), `/arena/dashboard/*` (ArenaLayout), `/sponsor/*`. **Nenhum redirect para os novos shells** — coexistência permanente.
- **Conexão WhatsApp**: rotas fora de shells ✅ (correto p/ evitar loop).
- **Phase 11.1 promete deprecação progressiva via redirects** — não foi feita.

### 7.2 Permissões / RLS
- **Banco saudável**: 0 tabelas com RLS habilitada **e** 0 policies. Todas têm policy.
- Helpers `is_admin`, `is_tenant_admin`, `is_arena_owner`, `is_company_owner` existem ✅.
- Policies de Phase 12.8/12.9/13 usam essas helpers corretamente, isolando por escopo. ✅
- **Risco**: como tabelas Phase 12.9/13 estão vazias e os triggers de attribution não foram criados, **ninguém valida o fluxo end-to-end de RLS em produção**.

### 7.3 Multi-Tenant
- Único tenant existente: `MoodPlay Default` (`00000000-...0001`).
- `resolve_tenant_by_host` retorna `null` para o domínio do preview ✅ (esperado), e cai no slug `moodplay`.
- **0 arenas**, **3 companies**, **7 user_roles** — base mínima para Super Admin auditar, **insuficiente** para validar isolamento entre tenants reais.

### 7.4 WhatsApp / ORKYM
- **Tabelas de identidade vazias.**
- `wa-send-message` depende de 4 envs: `ORKYM_API_BASE_URL`, `ORKYM_SERVICE_TOKEN`, `ORKYM_HMAC_SECRET`, `ORKYM_INTERNAL_TOKEN`. Se alguma faltar, function não envia (e nem loga erro útil).
- `orkym-cron-tick` referencia `orkym_generate_periodic_triggers` que **não existe** no DB → cron falha silenciosamente desde 12.9.
- Memory layer (`conversational_memory`) presente, vazio.

### 7.5 Financeiro
- Tabelas presentes ✅.
- `financial_transactions` vazia → trigger de attribution nunca disparou (e mesmo se disparasse, não existe no DB).
- `RevenueDashboardPanel` mostra zeros ou erro.
- `AdminFinances`, `AdminAdjustments`, `AdminSplitRules` lêem de tabelas reais — funcional mas sem dados de teste.

### 7.6 UX / UI
- Dashboards principais bem estruturados (helpers `SectionHeader`, `KpiCard`, `ShortcutLink`) ✅.
- Padrão visual consistente: dark theme, accent verde, Bebas Neue + Inter.
- **Problema sistêmico**: cards de receita/triggers/memory sem dados → sensação de produto vazio, sem empty states explicativos.
- Mobile: 1013×549 atual está em desktop; sidebars usam `collapsible="icon"` (ok).

### 7.7 Dados Mockados
- Apenas **2 ocorrências reais**:
  1. `AdminWhatsAppInstances` — opção `"mock"` exposta como provider default (P1).
  2. `AdminSplitRules` — texto "Fallback hardcoded (platform=10%)" (auditar lógica de split em código).
- Nenhum lorem/dummy/TODO/FIXME no front. ✅

### 7.8 Performance
- Dashboards usam `Promise.all` para queries paralelas ✅.
- `useEffect` sem cleanup em vários dashboards — risco de setState após unmount.
- TenantDashboard faz ~10 queries ao montar; aceitável.
- Nenhum realtime ativo encontrado nos dashboards (correto).

### 7.9 Erros Técnicos
- TypeScript types regenerados após cada migration ✅.
- 1 console error na sessão atual: `Unknown message type: RESET_BLANK_CHECK` — externa (lovable.js), ignorar.
- Edge function `orkym-cron-tick` última atividade há ~50 min, log diz `shutdown` + `booted` = idle/timer.

---

## 8. Recomendação Final

### ❌ NÃO ir para produção aberta hoje
- Migrations P0 ausentes quebram dashboards de receita em **todos os 4 perfis pagantes**.
- Gate WhatsApp obrigatório + zero instâncias = produto inutilizável fora do Super Admin.

### ⚠️ Beta fechado é viável SE (e somente se):
1. Re-aplicar migrations Phase 12.9 e 13 (validar via `\df orkym_*` e `pg_trigger`).
2. Configurar ORKYM secrets (`ORKYM_API_BASE_URL`, `ORKYM_SERVICE_TOKEN`, `ORKYM_HMAC_SECRET`, `ORKYM_INTERNAL_TOKEN`).
3. Seedar ao menos 1 arena + 1 whatsapp_instance + 1 wa_identity ligada ao primeiro cliente piloto.
4. Trocar `/arena/dashboard` para usar `ArenaShell` (ou desabilitar gate WA na rota legada).
5. Resolver as 4 famílias de rotas-alias renderizando o mesmo componente (ou marcar como "em breve" honestamente).
6. Esconder opção `provider=mock` no Admin em produção.

### 🟢 Pode auditar / vender showcase ao Super Admin agora
- AdminControlTower, AdminDashboard, AdminFinances, AdminUsers, AdminTournaments funcionam.
- Layouts de Athlete/Organizer/Tenant/Company são navegáveis (com bypass admin).

---

## 9. Próximos Passos Sugeridos (sem implementar ainda)

1. **Imediato (P0)** — Diagnosticar por que migrations 20260429014856 / 20260429021449 / 20260429021541 não criaram funções no DB. Confirmar via Lovable Cloud history se rodaram com erro.
2. **Antes do beta (P1)** — Corrigir aliases de rota e gate WhatsApp em ambiente sem instâncias.
3. **Antes de vender (P1+P2)** — Consolidar layouts legados, esconder opções "mock", popular empty states.
4. **Pós-beta (P3)** — Refator de sidebars, redirects de deprecação, hierarquia financeira clara.

---

**Conclusão honesta:** o produto tem **arquitetura sofisticada** (memory, proactive ops, revenue attribution), mas **as últimas 3 fases não chegaram ao banco**. Visualmente está pronto; operacionalmente, metade da cadeia ORKYM está desconectada. Fix de migrations + seed mínimo + ajuste de aliases destravam beta fechado em horas.
