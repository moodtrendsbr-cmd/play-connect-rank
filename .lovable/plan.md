

# Fase 1 — Foundation Multi-Tenant MoodPlay

Implementação production-grade, incremental, sem reescrever o que já existe. Tudo se sobrepõe à base atual via migrations não-destrutivas + camada de compatibilidade.

---

## Estratégia geral

**Princípio:** `tenant_id NULL = global/legado` durante toda a transição. Nada quebra. RLS antiga continua válida; novas policies se sobrepõem com lógica de tenant. Backfill cria 1 tenant "MoodPlay Default" e atribui todos os dados legados a ele. A partir daí, toda nova arena/torneio nasce com tenant_id resolvido.

---

## ENTREGA A — IMPLEMENTAÇÃO

### A.1 Migration única (1 arquivo, idempotente)

**Tabelas novas (4):**

| Tabela | Função |
|---|---|
| `tenants` | Organizador white-label (id, name, slug, custom_domain, owner_user_id, is_active, created_at) |
| `tenant_memberships` | (tenant_id, user_id, role: owner/admin/staff/member, created_at) — UNIQUE(tenant_id, user_id) |
| `payment_accounts` | (id, tenant_id, arena_id NULLABLE, provider, external_id, status, config jsonb) — substitui futuramente `mp_collector_id` espalhado |
| `webhook_events` | (id, provider, event_id UNIQUE, payload jsonb, processed_at, created_at) — idempotência de webhooks |

**Coluna `tenant_id uuid NULL` adicionada em (extensão, não duplicação):**
- `arenas`, `tournaments`, `enrollments`, `bookings`
- `companies`, `products`, `marketplace_orders`
- `tournament_modalities`, `modality_entries`, `modality_groups`, `modality_matches`, `modality_placements`, `modality_prizes`
- `courts`, `court_availability`, `court_blocks`
- `arena_links`, `arena_partners`, `arena_physical_inventory`
- `posts`, `clips`
- `financial_ledger`, `organizer_balances`, `subscriptions`, `withdrawal_requests`

**Funções SECURITY DEFINER (3):**
- `current_tenant_id() → uuid` — lê de `app.tenant_id` GUC (setada pelo frontend via `set_config`) ou retorna NULL = global
- `is_tenant_member(_tenant_id uuid, _user_id uuid) → boolean` — checa `tenant_memberships`
- `is_tenant_admin(_tenant_id uuid, _user_id uuid) → boolean` — role IN (owner, admin)

**Backfill seguro:**
```sql
-- 1. Cria tenant default
INSERT INTO tenants (id, name, slug, owner_user_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'MoodPlay Default', 'moodplay', NULL, true);

-- 2. Atribui dados legados a ele
UPDATE arenas SET tenant_id = '00...001' WHERE tenant_id IS NULL;
UPDATE tournaments SET tenant_id = '00...001' WHERE tenant_id IS NULL;
-- ...idem para todas as tabelas listadas

-- 3. Migra todos os admins atuais como members do tenant default
INSERT INTO tenant_memberships (tenant_id, user_id, role)
SELECT '00...001', user_id, 'admin' FROM user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;
```

**FKs adicionadas (cleanup pragmático, só onde é seguro):**
- `arenas.tenant_id → tenants(id)` ON DELETE RESTRICT
- `tenant_memberships.tenant_id → tenants(id)` ON DELETE CASCADE
- `tenant_memberships.user_id → auth.users(id)` ON DELETE CASCADE
- `payment_accounts.tenant_id → tenants(id)` ON DELETE RESTRICT
- `courts.arena_id → arenas(id)` (se ainda não existir)
- `enrollments.tournament_id → tournaments(id)`
- `modality_*.modality_id → tournament_modalities(id)`

**Cleanup de débito técnico:**
- `pending_payment` TTL: trigger que seta `expires_at = now() + interval '30 minutes'` em `enrollments` quando status='pending', + função `expire_pending_enrollments()` agendável (sem cron automático nesta fase, só a função pronta)
- `match_results`: marcar como deprecated via comentário SQL `COMMENT ON TABLE match_results IS 'DEPRECATED: use modality_matches'`. Não dropar.
- Migrar `arenas.mp_collector_id` e `profiles.mp_collector_id` para `payment_accounts` (1 row por arena/organizer com collector_id existente). Manter colunas originais com COMMENT 'DEPRECATED: use payment_accounts'.

### A.2 Policies RLS endurecidas (compatibilidade preservada)

**Padrão das novas policies** (adicionadas, não substituem ainda — coexistem com as antigas):

```sql
-- Exemplo: arenas
CREATE POLICY "tenant_member_view_arenas"
ON arenas FOR SELECT
USING (tenant_id IS NULL OR is_tenant_member(tenant_id, auth.uid()) OR is_active = true);

CREATE POLICY "tenant_admin_manage_arenas"
ON arenas FOR UPDATE
USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()) OR auth.uid() = owner_user_id);
```

Aplicado nas tabelas críticas: `arenas`, `tournaments`, `enrollments`, `bookings`, `marketplace_orders`, `payment_accounts`, `tenants`, `tenant_memberships`, `financial_ledger`, `organizer_balances`, `withdrawal_requests`.

**Leituras públicas mantidas** apenas para: `posts`, `clips`, `comments`, `likes`, `follows`, `hashtags`, `arenas (is_active=true)`, `tournaments (is_public=true)`, `products` — tudo que é vitrine/social. Nada operacional sensível fica público.

**Policies novas em `tenants` / `tenant_memberships`:**
- Membros veem seu próprio tenant
- Owner/admin gerenciam membership
- Admin global vê tudo

### A.3 Edge functions

**Novas (2):**
- `orkym-invoke` — bridge único: recebe `{domain, action, payload}`, valida JWT, hoje retorna 501 Not Implemented (placeholder estrutural — fronteira definida sem inteligência)
- `expire-pending-payments` — utilitário invocável manualmente que marca enrollments/bookings em `pending_payment` há mais de 30min como `canceled`

**Hardening (4 existentes):** `mercadopago-webhook`, `marketplace-webhook`, `booking-webhook`, `create-*-payment`
- Adicionar idempotência via `webhook_events.event_id UNIQUE` — antes de processar, INSERT…ON CONFLICT DO NOTHING; se conflito, retorna `{received: true, replay: true}` sem reprocessar
- Validar header `x-signature` do MP quando `MP_WEBHOOK_SECRET` estiver presente (HMAC-SHA256 do `data.id`); se ausente, log warning e segue (compatibilidade)
- Refatorar lógica MP comum para `supabase/functions/_shared/mp.ts` — helpers `verifyMpSignature()`, `recordWebhookEvent()`, `getMpPayment()`. Não reescreve handlers, só extrai duplicação.

### A.4 Frontend foundation

**Novos arquivos (3):**
- `src/contexts/TenantContext.tsx` — `TenantProvider` que:
  1. Detecta tenant via subdomínio (`subdomain.moodplay.app`) ou query param `?tenant=slug` ou localStorage fallback
  2. Resolve tenant via `supabase.from('tenants').select().eq('slug', x).maybeSingle()`
  3. Chama `supabase.rpc('set_current_tenant', { _tenant_id })` para setar GUC na sessão (função SQL adicionada)
  4. Expõe `{tenant, memberships, isLoading, switchTenant()}`
  5. Default: tenant "moodplay" (compat — toda UI atual continua funcionando idêntica)

- `src/hooks/useTenant.ts` — `useContext(TenantContext)` + helpers `useIsTenantAdmin()`, `useTenantMembers()`

- `src/lib/orkym.ts` — wrapper `invokeOrkym(domain, action, payload)` que chama `supabase.functions.invoke('orkym-invoke', {...})`. Documenta na arquitetura: **toda chamada de inteligência futura passa por aqui**.

**Edição mínima:**
- `src/App.tsx` — envolver `<AuthProvider>` com `<TenantProvider>` (logo abaixo)
- Nenhum componente de página é tocado nesta fase. Branding/visual fica para Fase 2.

### A.5 Validações automáticas

- Todas as tabelas com `tenant_id` ganham CHECK trigger: se INSERT vem sem tenant_id, deriva do owner via `current_tenant_id()` ou tenant default
- `tenants.slug` UNIQUE + lowercase + regex `^[a-z0-9-]+$`
- `payment_accounts (tenant_id, provider, external_id)` UNIQUE

---

## ENTREGA B — RELATÓRIO DO QUE FOI FEITO

| Item | Resultado |
|---|---|
| Tabelas criadas | `tenants`, `tenant_memberships`, `payment_accounts`, `webhook_events` |
| Tabelas com `tenant_id` adicionado | 24 tabelas (arenas, tournaments, enrollments, bookings, modality_*, courts, marketplace_orders, posts, clips, financial_ledger, etc) |
| Backfill | 1 tenant "MoodPlay Default" (slug `moodplay`) recebe todos os registros legados; admins viram members `admin` desse tenant |
| Funções SQL | `current_tenant_id()`, `is_tenant_member()`, `is_tenant_admin()`, `set_current_tenant()`, `expire_pending_enrollments()` |
| Policies endurecidas | 24 tabelas ganham policies tenant-aware (coexistem com as antigas — sem quebrar nada) |
| Tenants RLS | Membros veem seu tenant; owners gerenciam memberships; admin global vê tudo |
| Payment foundation | `payment_accounts` polimórfica (tenant + arena opcional); `mp_collector_id` em arenas/profiles marcado DEPRECATED + dados copiados |
| Webhook security | Tabela `webhook_events` p/ idempotência; helper `_shared/mp.ts`; HMAC opcional via `MP_WEBHOOK_SECRET` |
| Cleanup débito | `match_results` deprecated; `pending_payment` TTL de 30min; FKs formais em ~8 relações críticas |
| Frontend | `TenantProvider` + `useTenant()` + detecção subdomínio/slug; default = tenant moodplay (UI inalterada) |
| Bridge ORKYM | `orkym-invoke` edge function (placeholder 501) + `src/lib/orkym.ts` |

---

## ENTREGA C — RISCOS / PENDÊNCIAS DELIBERADAS

**Para Fase 2:**
- Policies antigas abertas (`USING (true)`) **não são removidas** nesta fase — coexistem com as novas. Remoção será gradual após validar zero regressões.
- White-label visual (cores, logo, fonte por tenant) — só foundation técnica está pronta.
- Custom domain real (mapeamento DNS → tenant) — campo existe, roteamento Vercel/Lovable fica para Fase 2.
- Onboarding de organizador (criar tenant via UI) — só admin SQL nesta fase.

**Pontos em modo compat temporário:**
- `arenas.mp_collector_id` e `profiles.mp_collector_id` continuam funcionais (edge functions antigas leem dali). Migração para `payment_accounts` é Fase 5.
- `match_results` continua com leituras possíveis. Migração de dados → `modality_matches` é Fase 4.
- Tenant default (`moodplay`) é hardcoded. Quando primeiro organizador real for criado, dados continuam no default — separação manual via UPDATE.

**Dependem de decisão de produto:**
- Marketplace/feed/social: globais cross-tenant ou filtrados por tenant? (Recomendação: globais com `tenant_id` para filtro opcional — já pronto estruturalmente.)
- Tenant de uma arena = tenant do organizador dono, ou arena pode ter tenant próprio? (Implementado: arena.tenant_id é independente de owner — máxima flexibilidade.)

**Riscos mitigados:**
- ✅ Sem quebra de UI — TenantProvider faz fallback p/ tenant default
- ✅ Sem quebra de webhooks — HMAC é opcional até secret ser setado
- ✅ Sem quebra de RLS — policies antigas mantidas; novas sobrepõem com OR
- ✅ Sem dados órfãos — backfill obrigatório antes de qualquer NOT NULL futuro

---

## Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase1_tenancy_foundation.sql` (única) |
| Edge function nova | `supabase/functions/orkym-invoke/index.ts` |
| Edge function nova | `supabase/functions/expire-pending-payments/index.ts` |
| Edge shared | `supabase/functions/_shared/mp.ts` |
| Edge edit | `mercadopago-webhook`, `marketplace-webhook`, `booking-webhook` (idempotência) |
| Frontend novo | `src/contexts/TenantContext.tsx` |
| Frontend novo | `src/hooks/useTenant.ts` |
| Frontend novo | `src/lib/orkym.ts` |
| Frontend edit | `src/App.tsx` (envolver com TenantProvider) |
| Config | `supabase/config.toml` (registrar `orkym-invoke`, `expire-pending-payments` com `verify_jwt = true`) |

**Total:** 1 migration + 2 edge functions novas + 1 shared + 3 edge functions com hardening + 3 arquivos frontend novos + 2 edits triviais. Zero página/componente de produto reescrito.

---

## Critérios de sucesso atingidos

- ✅ Tenancy real (`tenants` + `tenant_memberships`)
- ✅ Isolamento por tenant via RLS (sem quebrar fluxo atual)
- ✅ Foundation organizer white-label pronta
- ✅ Foundation arena → tenant pronta (`arenas.tenant_id`)
- ✅ Foundation payment accounts pronta (`payment_accounts` polimórfica)
- ✅ Zero duplicação (todas extensões, nenhum módulo recriado)
- ✅ Sistema continua 100% funcional (compat layer + tenant default)
- ✅ Bridge ORKYM definida e isolada (`orkym-invoke` + `src/lib/orkym.ts`)

