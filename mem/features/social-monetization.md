---
name: social-monetization
description: Phase M — Unified Social Monetization Engine reusing ad_campaigns, featured_listings, sponsored_posts, tournament_sponsorships
type: feature
---

# Social Monetization Engine

Native, contextual, anti-spam monetization layered on existing infrastructure. **No parallel system. No local AI. No banners.**

## Five monetization types — all unified under `ad_campaigns.kind`
| Kind | target_type | target_id |
|---|---|---|
| `tournament_boost` | tournament | tournaments.id |
| `company_boost`    | company    | companies.id |
| `product_boost`    | product    | products.id |
| `feed_ads`         | slot       | (uses ad_placements + ad_slots) |
| `tournament_sponsorship` | (kept on `tournament_sponsorships` table — unchanged) |

## Schema additions (M-1)
- `ad_campaigns.boost_level int (1–3)` and `duration_days int`.
- Validation trigger `trg_ad_campaigns_validate_kind` enforces kind ↔ target_type and boost_level range.
- New table `boost_pricing(boost_level PK, duration_days, price_brl, display_name, description, active)`. Seed:
  - level 1 → R$ 19 / 3 days (Boost Básico)
  - level 2 → R$ 49 / 7 days (Boost Premium)
  - level 3 → R$ 129 / 15 days (Boost Spotlight)

## Purchase flow (M-4) — IMPLEMENTED
1. Owner clicks **Impulsionar** in `OrganizerDashboard` (tournaments) or `MyCompany` (company header / per-product).
2. `PromoteCampaignDialog` (3 steps: tier → payer → PIX) calls `purchase_boost(_kind, _target_type, _target_id, _boost_level, _company_id?)` → creates `ad_campaigns` row with `status='pending'`.
3. Dialog invokes edge function `create-boost-payment` (PIX via Mercado Pago, **no split** — boost is 100% MoodPlay revenue). It inserts `financial_transactions` (`source_type='boost'`, `source_id=campaign_id`, `total_amount`, `payment_provider='mercadopago'`, `payment_reference=mp_id`).
4. `mercadopago-webhook` parses `external_reference={source_type:'boost', campaign_id}` and flips the financial_transactions row to `paid` → `trg_boost_activate_on_paid` activates the campaign automatically (start=now, end=now+duration).
5. `source_type='boost'` is allowed by the financial_transactions CHECK constraint (added in migration `20260429194602`).
6. RLS: company owners can read their own boost transactions; admins read all.

## Feed integration (M-2, M-3)
- View `feed_unified_v` (security_invoker) UNIONs:
  - active boost campaigns (priority_score = 50 + boost_level*15)
  - sponsored_posts (priority_score = 40)
- Hook `useFeedUnified(limit)` enriches with company_name/logo.
- `Feed.tsx` injects **at most one promo every 5 organic posts**, rotating through `promoItems` ordered by `priority_score`. Variants:
  - tournament_boost → `BoostedTournamentCard.tsx`
  - product_boost → `BoostedProductCard.tsx`
  - company_boost / sponsored_post → existing `SponsoredPostCard.tsx`
- `<AdSlot code="feed.inline" />` remains as fallback (feed_ads kind via ad_placements).

## Anti-spam (M-8)
- DB function `feed_should_inject_promo(_user_id, _last_n)` — returns false when user has ≥10 ad impressions in the last hour. `Feed.tsx` reads it once per session and gates promo injection.

## Metrics (M-6)
- View `boost_performance_v` aggregates impressions/clicks per campaign (joins `ad_events`).
- Dashboards reuse existing `useRevenueKpis` + `RevenueDashboardPanel`.

## ORKYM integration (M-7)
- ORKYM remains the decision-maker. Triggers (`tournament_low_enrollment`, `product_low_views`) belong in `orkym_triggers_queue`, populated by `orkym-cron-tick`. **No local AI.**

## Hard rules
- Cap: ≤ 1 sponsored item per 5 organic; ≤ 10 promo impressions/hour/user.
- Activation only via paid trigger — never manually flip `ad_campaigns.status` from client code.
- All 5 kinds share `ad_campaigns` — never create parallel monetization tables.
- Track impressions/clicks via existing `ad_record_event` RPC (slot_id may be NULL for boost-driven items).
