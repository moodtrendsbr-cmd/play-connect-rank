# Go-Live Fix — BLOCKED → BETA READY

## Audit re-check (correções importantes)

A auditoria anterior listou as RPCs das fases 12.9 e 13 como **ausentes**. Validado agora no banco:

```text
RPCs presentes: orkym_attribute_revenue, orkym_generate_periodic_triggers,
orkym_generate_optimization_triggers, orkym_proactive_check_eligibility,
orkym_proactive_record_send, orkym_revenue_kpis_{arena,tenant,company,admin},
orkym_roi_multiplier, orkym_trigger_enqueue, orkym_trigger_claim_batch,
orkym_trigger_complete, orkym_message_performance, memory_apply_decay,
memory_extract_all, tg_orkym_attribute_revenue (trigger fn).
Tabelas: orkym_triggers_queue, orkym_trigger_feedback, orkym_proactive_cooldowns,
orkym_revenue_attribution — todas existem.
```

**Conclusão:** P0 "migrations faltando" **não procede**. As migrations de 12.9 e 13 já estão aplicadas. O cron `orkym-cron-tick` já chama todas as RPCs corretas com try/catch (não quebra). O P0 real é **falta de seed + ArenaShell não ativada + mock visível**.

## Estado atual do banco

| Tabela | Linhas |
|---|---|
| tenants | 1 |
| arenas | 0 |
| whatsapp_instances | 0 |
| whatsapp_bindings | 0 |
| wa_identities | 0 |

Sem arena e sem instance, **TenantShell / ArenaShell / OrganizerShell / CompanyShell** redirecionam todos para `/connect-whatsapp` em loop visual e dashboards ficam vazios. Esse é o bloqueador real.

## Escopo deste passo

Apenas: ativar gates, seed mínimo seguro, ocultar mock, ajustar rotas-alias e sidebars. **Zero feature nova, zero schema, zero lógica ORKYM.**

---

## Mudanças

### 1. Ativar ArenaShell como padrão (P0)

`src/App.tsx`: hoje `/arena/dashboard` usa o legado `ArenaLayout`. Trocar para `ArenaShell`, mantendo as mesmas rotas filhas (todas as páginas Arena* já existem).

```text
- <Route path="/arena/dashboard" element={<ArenaLayout />}>
+ <Route path="/arena/dashboard" element={<ArenaShell />}>
```

`/arena/checkin` permanece **fora** do shell (já está). Manter `ArenaLayout` importado para compatibilidade, mas removê-lo das rotas — qualquer link interno antigo continua entrando pelo Shell sem quebrar (rotas filhas idênticas).

Resultado: gate WhatsApp, sidebar nova, Control Tower e badge de status passam a valer para Arena.

### 2. Seed mínimo seguro (P0)

Estender `supabase/functions/seed-test-data/index.ts` (já existe) com um modo `pilot=true` e um botão no painel admin que cria:

- 1 arena (vinculada ao único tenant existente, owner = caller user_id)
- 1 `whatsapp_instances` com `provider='cloud'`, `status='pending_config'`, `metadata={ is_seed: true, sandbox: true }`
- 1 `whatsapp_bindings` (tenant + arena, `is_default=true`)
- 1 `wa_identity` opcional (telefone do caller, `metadata.is_seed=true`)
- 1 turma + 1 aluno + 1 matrícula + 1 cobrança (todos com `metadata.is_seed=true` quando a coluna existir)

Tudo idempotente (chequeia existência antes). **Nada marcado como "mock" — usa `pending_config` para indicar que o provider real precisa ser configurado.**

Botão "Criar piloto" adicionado em `src/pages/admin/AdminControlTower.tsx`.

### 3. Remover mock visível em produção (P1)

`src/pages/admin/AdminWhatsAppInstances.tsx`:

- Remover `mock` da lista de providers do `<Select>` (manter apenas `cloud`, `whapi`, etc.).
- Default do form: `provider: 'cloud'`, `status: 'pending_config'`.
- Se algum registro existente já tem `provider='mock'`, exibe badge cinza **"Sandbox"** (não como produção).

### 4. WhatsApp Connection Gate — sanity (P1)

Já existe em `TenantShell`, `ArenaShell` (após passo 1), `OrganizerShell`, `CompanyShell`, com bypass para super admin. Confirmar comportamento adicionando uma única melhoria:

- `useWhatsAppConnectionStatus` retorna `connected=false` enquanto `loading`. Garantir que o gate **não** redireciona enquanto `waLoading=true` (já faz no Tenant/Arena, conferir Organizer/Company e alinhar).

Sem mudanças em edge functions / ORKYM logic.

### 5. Rotas-alias e sidebars com link morto (P1)

Em `src/App.tsx`, vários paths apontam ao mesmo componente (ex.: `/organizer/dashboard/{eventos,inscricoes,jogos,performance}` → todos `OrganizerDashboard`; `/athlete/{meu-dia,jogos,historico}` → todos `AthleteDashboard`; `/company/{campanhas,performance,visibilidade}` → todos `CompanyDashboard`; `/tenant/{overview,empresas,branding}` → reusa `OrganizerSettings/Arenas`).

Em vez de criar páginas novas, ajustar as **sidebars** (`src/layouts/sidebars/{Organizer,Athlete,Company,Tenant}Sidebar.tsx`):

- Itens com página real → manter.
- Itens cuja rota cai num placeholder → **remover do menu** ou marcar com pill "Em breve" (cinza, `disabled`, sem `to`).
- Anchors quebrados tipo `#checkin` em links que não levam à seção certa → trocar por rota concreta existente ou remover hash.

As rotas no `App.tsx` continuam respondendo (compatibilidade), mas não são destacadas na nav.

### 6. Empty states em dashboards financeiros e revenue (P1)

`src/components/revenue/RevenueDashboardPanel.tsx` e cards filhos: já usam `useRevenueKpis`. Validar que, quando `data` é vazio, exibem texto "Sem receita registrada ainda" em vez de números zero crus que parecem dado real. Mesma checagem em `ArenaFinance` / `OrganizerFinance` / `TenantDashboard` para gráficos sem registros.

### 7. Validação final (sem novos testes)

Após as mudanças, executar e confirmar:

```text
- build TS passa
- /arena/dashboard renderiza ArenaShell + sidebar nova
- após criar piloto e conectar (status pending_config aceita), gate libera
- AdminWhatsAppInstances não mostra opção "mock"
- sidebars sem link morto
- orkym-cron-tick continua respondendo 200 (já tem try/catch em cada RPC)
```

## Arquivos tocados

```text
src/App.tsx                                          (1 troca: ArenaLayout → ArenaShell)
src/pages/admin/AdminWhatsAppInstances.tsx           (remove mock)
src/pages/admin/AdminControlTower.tsx                (botão Criar Piloto)
src/layouts/OrganizerShell.tsx                       (loading guard no gate)
src/layouts/CompanyShell.tsx                         (loading guard no gate)
src/layouts/sidebars/OrganizerSidebar.tsx            (limpa links mortos)
src/layouts/sidebars/AthleteSidebar.tsx              (limpa links mortos)
src/layouts/sidebars/CompanySidebar.tsx              (limpa links mortos)
src/layouts/sidebars/TenantSidebar.tsx               (limpa links mortos)
src/components/revenue/*.tsx                         (empty state)
supabase/functions/seed-test-data/index.ts           (modo pilot, idempotente)
.lovable/plan.md                                     (relatório final)
```

**Nenhuma migration nova.** **Nenhuma edge function nova.** **Nenhuma alteração em ORKYM/MoodPlay logic.**

## Relatório final esperado

A ser escrito em `.lovable/plan.md` ao concluir, listando:

A. P0 corrigidos (ArenaShell ativa, seed piloto disponível)
B. P1 corrigidos (mock oculto, sidebars limpas, loading guards, empty states)
C. Banco: nenhuma alteração (RPCs já existiam)
D. Rotas: ArenaShell padrão, aliases mantidos, links mortos removidos da nav
E. Gate WA: validado nos 4 shells
F. Mock removido do AdminWhatsAppInstances
G. Build TS verificado
H. **Resultado: BETA READY** — pronto para 1 cliente piloto rodar com WhatsApp real conectado

---

Aprovar para eu executar exatamente este escopo.
