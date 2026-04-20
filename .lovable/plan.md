

# Fase 2.5 — Public Data Audit + Tenant Privacy Hardening

Hardening cirúrgico. Sem rebuild. Sem quebrar fluxos. Foco real: **vazamento de PII e dados administrativos via SELECTs abertos**, não em fechar descoberta legítima.

---

## 1. Auditoria — classificação oficial

| Tabela | Policy SELECT atual | PII/Admin exposta? | Classificação | Ação |
|---|---|---|---|---|
| **profiles** | `true` | whatsapp, mp_collector_id | **CRÍTICA** | Trocar por VIEW pública + bloquear base |
| **arenas** | `is_active=true` | contact_email, contact_whatsapp, address, zip_code, mp_collector_id, mp_connected | **CRÍTICA** | Trocar por VIEW pública + manter SELECT base só p/ owner/tenant_admin/admin |
| **companies** | `status='approved'` | email, phone, whatsapp, cnpj, address, zip_code | **CRÍTICA** | Trocar por VIEW pública + base só p/ owner/admin |
| **tenant_settings** | `true` | support_email, support_phone, metadata, status | **CRÍTICA** | Trocar por VIEW pública + base só p/ tenant_admin/admin |
| **tenant_domains** | `true` | verification_token | **CRÍTICA** | Bloquear base + RPC `resolve_tenant_by_host()` |
| **tournaments** | `is_public OR organizer_id=auth.uid()` | address, zip_code | **SEMI-SENSÍVEL** | Manter (endereço de evento público é parte do produto). Apenas confirmar. |
| **arena_links / arena_partners** | `is_active=true` | nenhuma | PÚBLICA LEGÍTIMA | Manter |
| **arena_physical_inventory** | `true` | nenhuma | PÚBLICA LEGÍTIMA | Manter (vitrine de mídia) |
| **athlete_sponsors** | `true` | nenhuma | PÚBLICA LEGÍTIMA | Manter |
| **clips, posts, post_media, post_hashtags, comments, likes, follows, profile_highlights, mentions** | `true` (próprias) | nenhuma | PÚBLICA LEGÍTIMA (rede social) | Manter |
| **hashtags, hashtag_searches** | `true` | nenhuma | PÚBLICA LEGÍTIMA | Manter |
| **modality_entries/groups/matches/placements/prizes/*_members** | `true` | nenhuma | PÚBLICA LEGÍTIMA (chaveamento) | Manter |
| **courts, court_availability** | `true` | nenhuma | PÚBLICA LEGÍTIMA (descoberta de slots) | Manter |
| **company_plans, tournament_sponsor_plans** | `true` | nenhuma | PÚBLICA LEGÍTIMA (catálogo) | Manter |
| **tournament_modalities, tournament_partners, tournament_sponsorships, tournament_match_pool** | `true` | nenhuma | PÚBLICA LEGÍTIMA | Manter |
| **products** | `status='approved'` AND empresa aprovada | nenhuma | PÚBLICA LEGÍTIMA | Manter |
| **match_results** | tournament.is_public | nenhuma | PÚBLICA LEGÍTIMA (deprecated) | Manter |
| **tenants** | `is_active=true` | nenhuma sensível (id, name, slug) | PÚBLICA LEGÍTIMA | Manter — necessário p/ resolução tenant |
| **bookings, enrollments, marketplace_orders, payment_accounts, financial_ledger, organizer_balances, withdrawal_requests, subscriptions, court_blocks, webhook_events** | já restritas | — | PRIVADA OPERACIONAL | OK (Fase 1/2) |
| **tenant_memberships, user_roles, messages, match_***  | já restritas | — | PRIVADA | OK |
| **sponsored_posts, sponsorship_giveaways** | a verificar | — | a confirmar | Auditar e hardenizar se necessário |

**Conclusão:** o vazamento real está concentrado em **5 tabelas** (profiles, arenas, companies, tenant_settings, tenant_domains). O resto é descoberta legítima ou já está privado.

---

## 2. Estratégia oficial: VIEW pública + tabela base trancada

Padrão único, replicável:

```sql
-- 1. View segura (apenas campos públicos)
CREATE VIEW public.profiles_public WITH (security_invoker = on) AS
  SELECT user_id, full_name, avatar_url, bio, city, state, team, created_at
  FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. Tabela base: SELECT só para o próprio usuário + admin
DROP POLICY "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Owner view full profile" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
```

Replicado em 5 tabelas críticas com colunas distintas:

| View | Campos públicos | Campos retidos só para owner/admin |
|---|---|---|
| `profiles_public` | user_id, full_name, avatar_url, bio, city, state, team, role-display | whatsapp, mp_collector_id, instagram/tiktok privados se houver |
| `arenas_public` | id, name, slug, city, state, cover_image_url, description, rules, is_active | contact_email, contact_whatsapp, address, zip_code, mp_collector_id, mp_connected |
| `companies_public` | id, name, logo_url, description, category, city, state, plan, status | email, phone, whatsapp, cnpj, address, zip_code, billing_status, plan_id |
| `tenant_settings_public` | tenant_id, display_name, logo_url, favicon_url, primary_color, secondary_color, default_locale, timezone | support_email, support_phone, legal_name, status, metadata |
| `tenant_domains_public` | (nenhuma — bloqueada) | tudo via RPC controlada |

Para `tenant_domains` adicional: **RPC `resolve_tenant_by_host(host text) → uuid`** (SECURITY DEFINER) que retorna apenas `tenant_id` se `verification_status='verified'`. A tabela base fica privada (apenas tenant_admin gerencia).

---

## 3. Migração das views (auditoria de uso)

Antes de trocar policies, varremos o frontend:
- `from("profiles")` → `from("profiles_public")` em leituras públicas; manter `profiles` quando usuário lê seu próprio perfil (autenticado)
- `from("arenas")` → `from("arenas_public")` em descoberta; `arenas` quando owner/admin gerencia
- `from("companies")` → `from("companies_public")` em vitrine; `companies` quando owner gerencia
- `from("tenant_settings")` → `from("tenant_settings_public")` no `TenantContext` (branding); `tenant_settings` no `OrganizerSettings` (admin)
- `from("tenant_domains")` no `TenantContext` → substituir por `supabase.rpc("resolve_tenant_by_host", { host })`; `OrganizerDomains` continua usando tabela base (admin)

Edge functions: revisar `_shared/mp.ts`, `create-payment`, `create-booking-payment`, `marketplace-webhook` — leituras que usam service role NÃO são afetadas por RLS, mas **validações de tenant_id explícitas** são adicionadas onde leem dados sob ação do usuário.

---

## 4. Hardening adicional (sem quebrar)

**Token de verificação de domínio:** `tenant_domains.verification_token` nunca pode aparecer em SELECT público. Garantido pela RPC + SELECT base restrito a tenant_admin.

**`mp_collector_id` em arenas/profiles:** continua nas tabelas base (DEPRECATED, lidas apenas via service role nas edge functions). View pública NÃO inclui esses campos. Risco de vazamento eliminado.

**Enumeração:** todas as tabelas críticas passam a exigir filtro explícito por id (já é o caso via REST). Sem `SELECT *` público em base.

**Anti-recursão:** todas as views usam `WITH (security_invoker = on)` — respeitam RLS do invocador, sem virar bypass.

**Edge functions tenant validation:**
- `create-payment`, `create-booking-payment`: já chamam `resolveCollectorId` (Fase 2). Adicionar verificação de que `tournament.tenant_id` ou `arena.tenant_id` corresponde ao recurso solicitado pelo usuário autenticado.
- `expire-pending-payments`: adicionar limite por tenant quando invocada com `tenant_id` (opcional).
- `orkym-invoke`: já valida JWT; adicionar log estruturado.

**Audit log mínimo:** nova tabela `security_audit_log` (id, user_id, tenant_id, action, resource_type, resource_id, ip, created_at). Apenas admins leem. Inserts feitos por trigger leve em mudanças sensíveis (membership add/remove, payment_account create/update, tenant_domain insert/delete). Sem inflar — só eventos administrativos.

---

## 5. Storage buckets (warning do linter)

5 buckets públicos (`tournament-images`, `post-images`, `company-images`, `tournament-files`, `arena-images`) permitem listagem de objetos. Hardening: política `storage.objects` SELECT restrita a `bucket_id IN (...)` mantém leitura por path direto, mas remove listagem cega. Implementação: política que exige `name IS NOT NULL` na leitura individual, sem permitir `LIST` sem prefix de owner. Mantém compat (URLs públicas continuam funcionando) e fecha enumeração.

---

## 6. Migração — arquivo único, idempotente

`supabase/migrations/<ts>_phase2_5_privacy_hardening.sql`:

1. CREATE 5 views `*_public` com `security_invoker=on` + GRANT SELECT
2. DROP + CREATE policies SELECT base nas 5 tabelas críticas
3. CREATE FUNCTION `resolve_tenant_by_host(text) RETURNS uuid` SECURITY DEFINER
4. CREATE TABLE `security_audit_log` + RLS (admin only) + 3 triggers leves
5. Storage policies hardening (anti-list)
6. Auditoria de policies em `sponsored_posts`, `sponsorship_giveaways` — endurecer se abertas

---

## 7. Frontend — substituições mínimas

Arquivos afetados (leitura pública → view):

| Arquivo | Mudança |
|---|---|
| `src/contexts/TenantContext.tsx` | `tenant_settings` → `tenant_settings_public` (leitura); `tenant_domains` → RPC `resolve_tenant_by_host` |
| `src/pages/UserProfile.tsx`, `Profile.tsx`, `ProfileHeader.tsx`, `FriendSuggestions.tsx`, `feed/*` | `profiles` (leitura de outros) → `profiles_public` |
| `src/pages/arenas/ArenasList.tsx`, `ArenaPublic.tsx`, `ArenaBooking.tsx` | `arenas` (leitura pública) → `arenas_public` |
| `src/pages/Marketplace.tsx`, `MarketplaceCompany.tsx`, `MarketplaceProduct.tsx` | `companies` (leitura pública) → `companies_public` |
| `src/integrations/supabase/types.ts` | regenerado automaticamente — inclui as views |

**Não tocados:** `OrganizerSettings`, `OrganizerDomains`, `MyCompany`, telas de admin, edição própria do perfil — todas autenticadas, leem a tabela base com policy de owner/admin.

---

## 8. Riscos / Pendências (Fase 3+)

- Refator visual de branding via CSS vars (Fase 3)
- Remoção definitiva de policies legadas redundantes em `arenas`/`companies` após validação de produção (auditoria 30 dias)
- Migração definitiva de `profiles.mp_collector_id` p/ `payment_accounts` (Fase 5 — split)
- DNS automation (Fase 3)
- Rate limiting nas edge functions (Fase 3)
- Audit log expandido (queries sensíveis) — só base nesta fase

**Compat preservada:**
- Todas as URLs públicas de storage continuam funcionando
- Toda UI de descoberta continua funcionando (lê via view)
- Owner/tenant_admin/admin têm acesso completo via base (UI de gestão inalterada)
- `tenant_domains` resolve via RPC (TenantContext atualizado)

---

## 9. Critérios de sucesso

- ✅ Nenhuma tabela com PII tem SELECT `USING (true)`
- ✅ `mp_collector_id`, `verification_token`, `support_email`, `cnpj`, `whatsapp` privados nunca expostos por leitura pública
- ✅ Descoberta pública preservada via views (sem mudança de UX)
- ✅ `tenant_domains` não enumerável; resolução por host via RPC
- ✅ Admin/tenant_admin/owner mantêm acesso completo
- ✅ Storage buckets sem listagem cega
- ✅ Audit log foundation pronta
- ✅ Zero IA local; ORKYM continua único bridge
- ✅ Sistema 100% funcional

---

## 10. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Migration | `supabase/migrations/<ts>_phase2_5_privacy_hardening.sql` |
| Frontend edit | `src/contexts/TenantContext.tsx` |
| Frontend edit | ~8 telas (Profile, UserProfile, ProfileHeader, FriendSuggestions, ArenasList, ArenaPublic, ArenaBooking, Marketplace, MarketplaceCompany, MarketplaceProduct) — apenas trocar nome da tabela em `from()` |
| Edge edit | `_shared/mp.ts`, `create-payment`, `create-booking-payment` (validação tenant) |
| Memory update | `mem://constraints/data-visibility` (atualizar com views oficiais) |

**Total:** 1 migration + ~10 edits triviais frontend + 3 edge edits leves. Zero módulo reescrito.

