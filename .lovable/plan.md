

# Fase 2 — Organizer White-Label + Security Hardening

Evolução incremental sobre a foundation da Fase 1. Sem rebuild, sem inteligência local, sem duplicação. Tudo coexiste com a base atual via tenant default `moodplay`.

---

## Ordem de execução (conforme aprovado)

1. Auditoria + classificação de risco das policies abertas
2. Hardening RLS das tabelas críticas
3. `tenant_settings` (white-label foundation)
4. Onboarding + admin foundation do tenant
5. Consolidação organizador → arenas
6. Domain resolution foundation (`tenant_domains`)
7. Evolução `payment_accounts` com fallback
8. Relatório final

---

## 1. Auditoria de policies abertas — classificação

| Tabela | Policy aberta atual | Risco | Decisão Fase 2 |
|---|---|---|---|
| `arenas` | `Public view active arenas (is_active=true)` | **Baixo** | Manter — descoberta pública legítima |
| `arena_links` / `arena_partners` / `arena_physical_inventory` | `Public view (is_active=true / true)` | **Baixo** | Manter — vitrine pública |
| `clips` / `comments` / `likes` / `follows` / `mentions` (view) | `Anyone view` | **Baixo** | Manter — rede social |
| `hashtags` / `hashtag_searches` | `Anyone view` | **Baixo** | Manter |
| `courts` / `court_availability` / `court_blocks` | `Public view (true)` | **Médio** | Restringir blocks a owner+admin (vaza ocupação interna). Courts/availability seguem públicos (descoberta de slots). |
| `athlete_sponsors` | `Public view (true)` | **Médio** | Manter — exposição de patrocínio é pública por natureza |
| `match_results` (deprecated) | `Public view via tournaments.is_public` | **Baixo** | Manter (deprecated, será removida na Fase 4) |
| `modality_entries` / `modality_groups` / `modality_matches` / `modality_placements` / `modality_*_members` | `Public view (true)` | **Baixo** | Manter — chaveamento público é parte do produto |
| `marketplace_orders` | `Buyer/Company/Admin view` | **OK** | Já segura — só endurecer com `tenant_id` (não mexer em USING aberto pois não existe) |
| `enrollments` | Tem `View enrollments` por user/payer/owner | **OK** | Já segura |
| `bookings` | Tem por user_id + arena_owner | **OK** | Já segura |
| `financial_ledger` | Admin + tenant_admin | **OK** | Já segura |

**Conclusão:** o risco real de vazamento operacional já está coberto. O único endurecimento crítico é em `court_blocks` (revela bloqueios internos da arena).

---

## 2. Hardening RLS — Migração

```sql
-- Restringir court_blocks: blocos são informação operacional interna
DROP POLICY "Public view blocks" ON court_blocks;
CREATE POLICY "Owner/admin view blocks" ON court_blocks FOR SELECT
  USING (is_arena_owner(get_arena_id_from_court(court_id), auth.uid())
         OR is_admin(auth.uid())
         OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid())));

-- Adicionar policies tenant-aware faltantes em tabelas operacionais
-- (UPDATE/DELETE para tenant_admin onde só existe SELECT)
CREATE POLICY "tenant_admin_manage_arenas_delete" ON arenas FOR DELETE
  USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "tenant_admin_view_orders_full" ON marketplace_orders FOR UPDATE
  USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));

-- Garantir que enrollments/bookings tenant-aware existam para UPDATE também
CREATE POLICY "tenant_admin_update_enrollments" ON enrollments FOR UPDATE
  USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "tenant_admin_update_bookings" ON bookings FOR UPDATE
  USING (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()));
```

**Princípio:** não removemos policies abertas legítimas (vitrine, social, chaveamento). Só endurecemos onde há vazamento real (court_blocks) e adicionamos capacidade administrativa via tenant.

---

## 3. `tenant_settings` (white-label foundation)

```sql
CREATE TABLE public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  legal_name text,
  support_email text,
  support_phone text,
  primary_color text DEFAULT '#2BFF88',
  secondary_color text DEFAULT '#050708',
  logo_url text,
  favicon_url text,
  default_locale text NOT NULL DEFAULT 'pt-BR',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: público para leitura (necessário para branding em domínio próprio)
-- Escrita só para tenant owner/admin
CREATE POLICY "Public read tenant_settings" ON tenant_settings FOR SELECT USING (true);
CREATE POLICY "Tenant admin manage settings" ON tenant_settings FOR ALL
  USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));

-- Backfill: 1 row para tenant default moodplay
INSERT INTO tenant_settings (tenant_id, display_name, primary_color, secondary_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'MoodPlay', '#2BFF88', '#050708')
ON CONFLICT DO NOTHING;
```

---

## 4. `tenant_domains` (domain resolution foundation)

```sql
CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'subdomain' CHECK (kind IN ('subdomain','custom')),
  is_primary boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed')),
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX tenant_domains_one_primary ON tenant_domains(tenant_id) WHERE is_primary;

-- RLS público para leitura (resolver tenant pelo host) + admin para escrita
CREATE POLICY "Public read domains" ON tenant_domains FOR SELECT USING (true);
CREATE POLICY "Tenant admin manage domains" ON tenant_domains FOR ALL
  USING (is_tenant_admin(tenant_id, auth.uid()) OR is_admin(auth.uid()));

-- Backfill default
INSERT INTO tenant_domains (tenant_id, domain, kind, is_primary, verification_status, verified_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'play-connect-rank.lovable.app', 'subdomain', true, 'verified', now())
ON CONFLICT DO NOTHING;
```

`TenantContext` ganha lookup adicional: `from('tenant_domains').select('tenant_id').eq('domain', host).eq('verification_status','verified').maybeSingle()` antes do fallback de slug.

---

## 5. Organizador → arenas (consolidação)

Análise: `arenas.tenant_id` já existe (Fase 1). Falta apenas:

```sql
-- Trigger: ao criar arena, herdar tenant do owner se não fornecido
CREATE OR REPLACE FUNCTION set_arena_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant FROM tenant_memberships
      WHERE user_id = NEW.owner_user_id ORDER BY created_at LIMIT 1;
    NEW.tenant_id := COALESCE(v_tenant, '00000000-0000-0000-0000-000000000001');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER arenas_set_tenant BEFORE INSERT ON arenas
  FOR EACH ROW EXECUTE FUNCTION set_arena_tenant_default();
```

Mesmo padrão para `tournaments`, `bookings`, `enrollments`, `marketplace_orders`, `companies`, `posts`, `clips`, `courts` (8 triggers análogos).

---

## 6. Onboarding + admin foundation

### Backend: RPC seguro
```sql
CREATE OR REPLACE FUNCTION create_organizer_tenant(
  _name text, _slug text, _display_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO tenants (name, slug, owner_user_id, is_active)
    VALUES (_name, lower(_slug), v_user, true) RETURNING id INTO v_tenant;
  INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES (v_tenant, v_user, 'owner');
  INSERT INTO tenant_settings (tenant_id, display_name) VALUES (v_tenant, COALESCE(_display_name, _name));
  RETURN v_tenant;
END $$;
```

### Frontend novo (4 arquivos pequenos):
- `src/pages/organizer/OrganizerOnboarding.tsx` — formulário (nome, slug, display_name) → chama RPC → redireciona p/ admin do tenant
- `src/pages/organizer/OrganizerLayout.tsx` — layout sidebar minimal (Configurações, Membros, Arenas, Domínios)
- `src/pages/organizer/OrganizerSettings.tsx` — edita `tenant_settings` (cores, logo, support, locale)
- `src/pages/organizer/OrganizerMembers.tsx` — lista `tenant_memberships`, adiciona/remove/altera papel (owner/admin/staff/member)

Rotas:
- `/organizer/onboarding` (qualquer user autenticado)
- `/organizer` (owner/admin do tenant atual) → redireciona p/ `/organizer/settings`
- `/organizer/settings`, `/organizer/members`, `/organizer/arenas`, `/organizer/domains`

Guard: usa `useIsTenantAdmin()` da Fase 1.

---

## 7. Payment accounts evolution (compatibilidade)

**Estratégia:** não quebrar nada. Adicionar fonte canônica + fallback.

### Backend helper (já existe `_shared/mp.ts`):
```typescript
// supabase/functions/_shared/mp.ts — adicionar:
export async function resolveCollectorId(supabase, opts: {
  tenantId?: string, arenaId?: string, organizerId?: string
}): Promise<string | null> {
  // 1. payment_accounts (fonte canônica)
  if (opts.tenantId || opts.arenaId) {
    const q = supabase.from('payment_accounts').select('external_id').eq('provider','mercadopago').eq('status','active');
    if (opts.arenaId) q.eq('arena_id', opts.arenaId);
    else if (opts.tenantId) q.eq('tenant_id', opts.tenantId).is('arena_id', null);
    const { data } = await q.maybeSingle();
    if (data?.external_id) return data.external_id;
  }
  // 2. fallback legado
  if (opts.arenaId) {
    const { data } = await supabase.from('arenas').select('mp_collector_id, mp_connected').eq('id', opts.arenaId).maybeSingle();
    if (data?.mp_connected && data?.mp_collector_id) return data.mp_collector_id;
  }
  if (opts.organizerId) {
    const { data } = await supabase.from('profiles').select('mp_collector_id').eq('user_id', opts.organizerId).maybeSingle();
    return data?.mp_collector_id ?? null;
  }
  return null;
}
```

### Trigger de sincronização:
```sql
-- Quando arenas.mp_collector_id muda, sincronizar payment_accounts
CREATE OR REPLACE FUNCTION sync_arena_payment_account() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mp_collector_id IS NOT NULL AND NEW.mp_connected THEN
    INSERT INTO payment_accounts (tenant_id, arena_id, provider, external_id, status)
    VALUES (NEW.tenant_id, NEW.id, 'mercadopago', NEW.mp_collector_id, 'active')
    ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET status='active', updated_at=now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER arenas_sync_payment AFTER INSERT OR UPDATE OF mp_collector_id, mp_connected
  ON arenas FOR EACH ROW EXECUTE FUNCTION sync_arena_payment_account();
```

### Edge functions: refator mínimo
- `create-payment/index.ts` e `create-booking-payment/index.ts` passam a chamar `resolveCollectorId()` em vez de query direta. **Comportamento idêntico** se nenhum payment_account existir (cai no legado).

### Frontend: `src/pages/organizer/OrganizerPayment.tsx` (nova rota `/organizer/payment`)
- Lista `payment_accounts` do tenant
- Permite adicionar/editar `external_id` (collector_id MP)

---

## 8. Frontend tenant awareness evolution

`TenantContext.tsx` ganha:
1. Lookup por host em `tenant_domains` antes do slug
2. Carrega `tenant_settings` junto com `tenants`
3. Aplica branding via CSS vars no `<html>`:
```typescript
useEffect(() => {
  if (settings) {
    document.documentElement.style.setProperty('--brand-primary', settings.primary_color);
    document.documentElement.style.setProperty('--brand-secondary', settings.secondary_color);
  }
}, [settings]);
```
4. Expõe `settings` no contexto.

`useTenant()` retorna `{ tenant, settings, memberships, ... }`.

**Não muda visual existente** — os tokens do design system continuam dominantes; brand vars ficam disponíveis para uso opt-in em fases futuras.

---

## 9. Governança pública vs privada (política explícita)

Documentado em `mem://constraints/data-visibility`:

| Categoria | Política | Tabelas |
|---|---|---|
| **Público global** | Qualquer um lê | `posts`, `clips`, `comments`, `likes`, `follows`, `hashtags`, `mentions` (próprias), `tenant_settings`, `tenant_domains` |
| **Público com flag** | Lê se `is_active=true` ou `is_public=true` | `arenas`, `tournaments`, `products`, `companies (status=approved)`, `arena_links`, `arena_partners`, `match_results` (via tournament.is_public) |
| **Público de modalidade** | Chaveamento é parte do produto | `modality_entries/groups/matches/placements/*_members`, `courts`, `court_availability` |
| **Privado operacional** | Owner + tenant admin + admin global | `enrollments`, `bookings`, `marketplace_orders`, `payment_accounts`, `webhook_events`, `court_blocks`, `financial_ledger`, `organizer_balances`, `withdrawal_requests` |
| **Privado de membership** | Só membros do tenant | `tenant_memberships` |
| **Privado de conversação** | Só participantes | `messages`, `match_messages`, `match_conversations`, `match_pairs`, `match_pair_members` |

---

## Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration única | `supabase/migrations/<ts>_phase2_white_label.sql` |
| Edge shared edit | `supabase/functions/_shared/mp.ts` (+ `resolveCollectorId`) |
| Edge edit | `create-payment/index.ts`, `create-booking-payment/index.ts` (usar helper) |
| Frontend novo | `src/pages/organizer/OrganizerOnboarding.tsx` |
| Frontend novo | `src/pages/organizer/OrganizerLayout.tsx` |
| Frontend novo | `src/pages/organizer/OrganizerSettings.tsx` |
| Frontend novo | `src/pages/organizer/OrganizerMembers.tsx` |
| Frontend novo | `src/pages/organizer/OrganizerArenas.tsx` (lista arenas do tenant) |
| Frontend novo | `src/pages/organizer/OrganizerDomains.tsx` |
| Frontend novo | `src/pages/organizer/OrganizerPayment.tsx` |
| Frontend edit | `src/contexts/TenantContext.tsx` (+host lookup, +settings, +CSS vars) |
| Frontend edit | `src/hooks/useTenant.ts` (+ settings) |
| Frontend edit | `src/App.tsx` (+ rotas /organizer/*) |
| Memory novo | `mem://constraints/data-visibility` |

**Total:** 1 migration + 2 edge edits + 7 arquivos frontend novos + 3 edits triviais. Nenhum módulo de produto reescrito.

---

## ENTREGA C — Riscos / Pendências deliberadas

**Para Fase 3+:**
- Branding visual completo (aplicar `--brand-primary` em todo o design system)
- DNS automation real (verificação via DNS TXT record)
- Billing/cobrança self-service do organizador
- Gestão completa de arenas (alunos/aulas/professores) — Fase 3
- Split 3-vias completo — Fase 5
- Migração definitiva fora de `mp_collector_id` legado — Fase 5
- Remoção de `match_results` — Fase 4

**Compat temporário mantido:**
- Policies abertas de descoberta (`is_active=true`) permanecem — são parte do produto
- `mp_collector_id` em `arenas` e `profiles` continua funcional via fallback
- Tenant default `moodplay` recebe todos os dados sem tenant explícito

**Decisões de produto pendentes:**
- Tenant atual quando user pertence a múltiplos: priorizar membership mais recente? Adicionar switcher?
- Onboarding cria tenant ao primeiro login de um role "organizer"? Ou exige ação manual? (Plano: ação manual via `/organizer/onboarding`)

**Critérios de sucesso:**
- ✅ `tenant_settings` oficial existe
- ✅ Onboarding estrutural funcional via `/organizer/onboarding`
- ✅ Admin foundation com 6 telas mínimas
- ✅ Organizador → arenas via trigger automático
- ✅ Domain resolution preparado (`tenant_domains`)
- ✅ `payment_accounts` é fonte canônica com fallback
- ✅ Hardening RLS sem quebra (court_blocks fechado)
- ✅ Zero IA local
- ✅ Sistema 100% funcional (tenant default cobre legado)

