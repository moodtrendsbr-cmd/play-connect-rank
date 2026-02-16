
# Admin Sponsorship Analytics, Gifts & Plans Management

## Overview
Expand the admin panel with 3 new dedicated pages for sponsorship operations, plus enhance the existing sponsorships page. All pages use existing database tables -- only one small schema change needed.

---

## 1. Database Migration

Add `admin_notes` column to `sponsorship_giveaways` table (currently missing from schema):

```text
ALTER TABLE sponsorship_giveaways ADD COLUMN admin_notes text;
```

This enables admins to attach internal notes to giveaway items.

---

## 2. New Admin Pages

### 2.1 `/admin/analytics` - Sponsorship Analytics Dashboard
- Cards: Sponsorship revenue (sum of plan prices for active sponsorships), active sponsorships count, active companies count, total views, total clicks, CTR
- Revenue by city (aggregated from tournament_sponsorships joined with tournaments)
- Top tournaments by views
- Top companies by performance (clicks)
- Simple bar charts using Recharts (already installed)
- Filters: period (this month / last 30 days / all time)

### 2.2 `/admin/gifts` - Giveaway Operations Queue
- List all `sponsorship_giveaways` with joins to `tournament_sponsorships -> tournaments, companies`
- Status filter tabs: all / pending / contact_needed / in_transit / delivered / closed
- Each card shows: company name, tournament, item type, quantity, deadline, contact info, addresses
- Actions: Update status dropdown, Add admin note (textarea), Mark as contacted
- Color-coded status badges

### 2.3 `/admin/plans` - Dedicated Plans Management
- Extract the Plans tab from AdminSponsorships into its own full page
- Same CRUD functionality but with more space for editing
- Real-time save with immediate feedback

---

## 3. Enhanced Existing Page

### `/admin/sponsorships` - Remove Plans Tab
- Keep only the sponsorships list (remove the plans tab since it moves to `/admin/plans`)
- Add views/clicks columns to each sponsorship card
- Add placement indicators (which placements are active based on plan)

---

## 4. Routes & Navigation

### New routes in App.tsx:
```text
/admin/analytics -> AdminAnalytics
/admin/gifts -> AdminGifts  
/admin/plans -> AdminPlans
```

### Updated AdminLayout sidebar:
Add new items to the navigation groups:
- "Analytics" under main nav (with BarChart3 icon)
- "Brindes" under Marketplace group (with Gift icon)
- "Planos" under Marketplace group (with Layers icon)

---

## 5. Files

### New:
- `src/pages/admin/AdminAnalytics.tsx` -- analytics dashboard with charts
- `src/pages/admin/AdminGifts.tsx` -- giveaway operations queue
- `src/pages/admin/AdminPlans.tsx` -- dedicated plans management

### Modified:
- `src/App.tsx` -- 3 new admin routes
- `src/pages/admin/AdminLayout.tsx` -- 3 new sidebar items
- `src/pages/admin/AdminSponsorships.tsx` -- remove plans tab, add metrics columns
- SQL migration for `admin_notes` column

---

## Technical Details

### Analytics Data Queries:
- Revenue: `tournament_sponsorships` (status=active) joined with `tournament_sponsor_plans` (price)
- Views/Clicks: aggregated from `tournament_sponsorships.views_count` and `clicks_count`
- By city: join with `tournaments` table for city grouping
- Charts: Recharts BarChart and PieChart components

### Gifts Queue Flow:
```text
pending -> contact_needed -> in_transit -> delivered -> closed
```
Each transition is an UPDATE on `sponsorship_giveaways.status` with optional `admin_notes` append.

### Plans Page:
Extracted from existing AdminSponsorships plans tab -- same form, same CRUD logic, just in its own dedicated page with full width.
