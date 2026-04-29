---
name: featured-listings
description: Phase G-3 — Destaques pagos com auto-aprovação e kill-switch admin global/por categoria
type: feature
---

## G-3 (Featured Listings) — entregue

**Tabelas:**
- `featured_pricing(tier PK, display_name, price_brl, duration_days, description, active)` — seed: basic R$29/7d, premium R$79/15d, spotlight R$199/30d.
- `featured_listings(id, entity_type, entity_id, tier FK, status, starts_at, ends_at, paid_amount, payment_transaction_id, created_by, created_at, updated_at)` — entity_type CHECK in (tournament|product|company|arena|sponsored_post). status CHECK in (pending|active|paused|expired|killed).
- `featured_kill_switch(entity_type PK, enabled, reason, toggled_by, toggled_at)` — entity_type aceita '*' para kill global.

**View pública:**
- `featured_active_v` (security_invoker=on) — JOIN listings + pricing, filtra status=active, dentro do período, e respeita kill-switch (entity_type específico OU '*').

**Funções DEFINER:**
- `purchase_featured(_entity_type, _entity_id, _tier)` — cria registro pending; auth required. EXECUTE: authenticated.
- `toggle_featured_kill_switch(_entity_type, _enabled, _reason)` — apenas has_role('admin'). EXECUTE: authenticated (validado dentro).
- `admin_kill_featured_listing(_featured_id, _reason)` — apenas admin; muda status→killed.

**Trigger auto-aprovação:**
- `trg_featured_activate_on_paid` em `financial_transactions` AFTER INSERT/UPDATE OF status. Quando `source_type='featured' AND status='paid'`, atualiza listing pendente: status→active, starts_at=now(), ends_at=now()+duration_days.

**RLS:**
- listings: leitura pública para active/expired/killed; dono lê todos próprios; dono pode UPDATE em active/paused (pausar/retomar); admin tem ALL.
- kill_switch: leitura pública; admin escreve.
- pricing: leitura pública (active=true).

**UI:**
- `src/pages/admin/AdminFeaturedListings.tsx` — kill-switch global + por categoria; lista de destaques com filtro active/all/killed; botão "Encerrar" por linha.
- `src/components/featured/FeaturedBadge.tsx` — pill por entidade lendo `featured_active_v` (1 query). Tiers: basic=verde Star, premium=dourado Sparkles, spotlight=laranja Crown.
- `src/hooks/useFeaturedSet.ts` — para listas: retorna Set<entity_id> + tierMap (maior tier prevalece) por entity_type, sem N+1.

**Rota:** `/admin/featured-listings` (no AdminLayout, grupo Financeiro).

**Fluxo de compra (a integrar em telas de owner — produto/torneio/empresa/arena):**
1. Cliente chama `supabase.rpc('purchase_featured', {...})` → recebe `featured_id` + price + days.
2. Cliente abre checkout MP (create-payment) com `source_type='featured'`, `source_id=featured_id`.
3. Webhook MP grava `financial_transactions.status='paid'` → trigger ativa listing automaticamente.

## G-4 (Integração) — entregue
- `src/components/featured/PromoteFeaturedDialog.tsx` — diálogo reutilizável que lista `featured_pricing` ativos e chama `purchase_featured` RPC. Próximo passo (não bloqueante): redirecionar para checkout MP com `source_type='featured'`, `source_id=featured_id`.
- **Marketplace** (`src/pages/Marketplace.tsx`): usa `useFeaturedSet('product')` para ordenar destaques no topo + renderiza `<FeaturedBadge />` no card.
- **Tournaments** (`src/pages/Tournaments.tsx`): usa `useFeaturedSet('tournament')`, sort por destaque, badge no header do card.
- **MyCompany** (`src/pages/MyCompany.tsx`): botão "Promover" em cada produto aprovado abre `PromoteFeaturedDialog`.

## Pendências (G-5+)
- Botões "Promover" nos dashboards de Organizador (torneios), Arena, Sponsor.
- Conectar `purchase_featured.featured_id` ao fluxo de checkout MP (source_type=featured).
- Edge function periódica para marcar listings expirados (status→expired quando ends_at < now()) — opcional, view já filtra.
