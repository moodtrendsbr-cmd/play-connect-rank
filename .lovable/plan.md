# Social Monetization Engine

Reuses 100% of existing infrastructure. No parallel system, no new AI. Five monetization types unified into ONE feed ranking pipeline.

## What's already in place (do NOT rebuild)
- `ad_campaigns` (kind, target_type, target_id, priority, status, starts_at/ends_at) + `ad_slots` (codes: `feed.inline`, `home.hero`, `marketplace.featured`, `tournaments.list_top`, `arena.banner`) + `ad_placements` + `ad_events` + view `ads_public` + `AdSlot.tsx`.
- `featured_listings` + `featured_pricing` + `featured_active_v` + auto-approval trigger on `financial_transactions.status='paid'` + `FeaturedBadge` + `useFeaturedSet`.
- `tournament_sponsorships` (tournament_id, company_id, plan_id, logo_url, message, link, views/clicks_count, payment_id, status).
- `financial_transactions` + `transaction_splits` + `orkym_revenue_attribution` (revenue auto-attributed by paid trigger).
- `social_feed` + `social_feed_public_v2` + `SocialActivityFeed`.
- `Feed.tsx` already injects `<AdSlot code="feed.inline" />` and sponsored posts every 5 organic posts.

## Gaps this plan closes

### M-1 — Unify campaign kinds (DB)
Single migration extending `ad_campaigns.kind` allowed values to: `tournament_boost`, `company_boost`, `product_boost`, `feed_ads`, `tournament_sponsorship`. Use existing `target_type`/`target_id` (no new columns):
- tournament_boost → target_type='tournament', target_id=tournament_id
- company_boost   → target_type='company',    target_id=company_id
- product_boost   → target_type='product',    target_id=product_id
- feed_ads        → target_type='slot',       target_id=null (uses ad_placements)
- tournament_sponsorship → kept on `tournament_sponsorships` table (already exists)

Add `boost_level int default 1` (1–3) to `ad_campaigns` (only new column needed). Validation trigger (not CHECK) ensures kind+target_type consistency.

### M-2 — Unified Feed Ranking View
Create `feed_unified_v` (security_invoker) that UNIONs:
1. Organic posts from `posts` (type='organic', priority_score = recency_decay)
2. Social events from `social_feed_public_v2` (already public)
3. Sponsored posts (existing `sponsored_posts`, type='sponsored', score += boost_level*10)
4. Boosted tournaments via `ad_campaigns` where kind='tournament_boost' and active (type='boost', score += boost_level*15)
5. Boosted companies/products (same shape)

Columns: `item_type, item_id, occurred_at, type ('organic'|'sponsored'|'boost'), campaign_id, company_id, target_type, target_id, priority_score, payload`.

Anti-spam enforced client-side via injection rule: **max 1 sponsored every 5–7 organic items** (already implemented in `Feed.tsx` modulo 5 — keep it, just extend source).

### M-3 — Feed integration (Frontend)
Update `Feed.tsx`:
- Replace direct `sponsored_posts` query with single fetch from `feed_unified_v` for promoted items, ordered by `priority_score`.
- Keep organic post fetch as-is.
- Reuse existing 1-every-5 injection rule; pull next promoted item from queue (rotates: tournament boost → product → company → sponsored post → ad slot).
- `<AdSlot code="feed.inline" />` stays for fallback.
- Render variants:
  - tournament_boost → new `BoostedTournamentCard.tsx`
  - product_boost → new `BoostedProductCard.tsx`
  - company_boost → reuse `SponsoredPostCard.tsx`
  - feed_ads → existing `AdSlot`
  - tournament_sponsorship → badge "Patrocinado por X" on existing tournament card variant

### M-4 — Owner promotion flows (Frontend)
Add "Promover" buttons (reusing `PromoteFeaturedDialog` pattern, but for ad_campaigns):
- New `PromoteCampaignDialog.tsx` — selects boost_level (1/2/3), duration (3/7/15 days), shows price from new `boost_pricing` table (3 rows seed: lvl1=R$19/3d, lvl2=R$49/7d, lvl3=R$129/15d). Calls `purchase_boost(_kind, _target_type, _target_id, _boost_level, _duration_days)` RPC.
- Wire into:
  - Organizer dashboard (`OrganizerDashboard.tsx`) → tournament_boost
  - MyCompany products list → product_boost (already has Promover for featured; add second action "Boost Feed")
  - MyCompany header → company_boost
  - Sponsor flow already covered by existing `SponsorTournamentDialog` (no change)

### M-5 — Auto-activation + revenue attribution (DB)
Extend the existing `trg_featured_activate_on_paid` pattern with a sibling trigger `trg_boost_activate_on_paid`:
- When `financial_transactions.status='paid' AND source_type='boost'`, find the pending `ad_campaigns` row (created via `purchase_boost`) and flip status='active', set starts_at=now(), ends_at=now()+duration.
- `orkym_revenue_attribution` already auto-fills via existing trigger when paid (no change).
- `transaction_splits` already wired (no change).

### M-6 — Dashboards (light reuse, no new components where possible)
Reuse `useRevenueKpis`:
- Organizer: extend `orkym_revenue_kpis_tenant` to expose `boost_views`, `boost_clicks`, `enrollments_from_boost` (computed from `ad_events` joined to enrollments via attribution_window). New SQL view `boost_performance_v` per campaign.
- Company: same view filtered by company_id (impressions/clicks/conversions already in `ad_events`).
- Tenant/Admin: aggregate from `boost_performance_v`. Add tile to `RevenueDashboardPanel`.

### M-7 — ORKYM suggestions (no new AI)
Add 2 deterministic triggers to `orkym_triggers_queue` populated by existing `orkym-cron-tick`:
- `tournament_low_enrollment` → fires when tournament has <30% capacity and starts in <7d → ORKYM suggests boost.
- `product_low_views` → fires when product has <10 views in 7d and company plan supports ads → ORKYM suggests boost.
ORKYM remains the decision-maker; we only enqueue + provide `memory_context`. No local AI.

### M-8 — Anti-spam guardrails (DB function)
`feed_should_inject_promo(_user_id, _last_n_items)` returns boolean — checks user-level ratio in last 50 items shown (logged via `ad_events` viewer_id). Caps at 20% sponsored. Called by `Feed.tsx` before each injection.

## Files to touch

```text
supabase/migrations/<new>.sql        # boost_level col, kind expansion, boost_pricing,
                                     # purchase_boost RPC, activation trigger,
                                     # feed_unified_v, boost_performance_v,
                                     # feed_should_inject_promo()
src/components/featured/PromoteCampaignDialog.tsx   # NEW
src/components/feed/BoostedTournamentCard.tsx       # NEW
src/components/feed/BoostedProductCard.tsx          # NEW
src/hooks/useFeedUnified.ts                         # NEW (queries feed_unified_v)
src/pages/Feed.tsx                                  # use unified hook + injection rule
src/pages/MyCompany.tsx                             # add "Boost Feed" action
src/pages/organizer/OrganizerDashboard.tsx          # add Promover button per tournament
src/components/revenue/RevenueDashboardPanel.tsx    # add Boost ROI tile
supabase/functions/orkym-cron-tick/index.ts         # enqueue boost suggestion triggers
mem/features/social-monetization.md                 # NEW memory file
mem/index.md                                        # register new memory
```

## What is explicitly NOT done (per spec)
- No bidding, no auction, no advanced targeting, no local AI/recommendation, no heavy analytics, no banners.

## Tests (Vitest + manual)
1. Organizer purchases tournament_boost → financial_transactions paid → ad_campaigns activated → tournament appears in feed_unified_v with elevated score.
2. Company creates product_boost → product surfaces in Feed at correct interval (≤1 every 5).
3. Anti-spam: with 100 items, sponsored ratio ≤ 20%.
4. ad_events impression/click logged via existing `ad_record_event` RPC.
5. transaction_splits row created on paid boost.
6. orkym_revenue_attribution row created with attribution_type='reactive' (or 'proactive' if from ORKYM trigger).
7. ORKYM cron enqueues `tournament_low_enrollment` for an under-filled tournament.

## Memory updates
Create `mem/features/social-monetization.md` documenting unified ad_campaigns kinds, feed_unified_v contract, anti-spam cap (20%), boost_pricing tiers, and the rule "ORKYM decides — we only enqueue triggers." Add Core line to index: `Monetization unified via ad_campaigns kinds; feed cap 20% sponsored; activation via paid trigger.`
