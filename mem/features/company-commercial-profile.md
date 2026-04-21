---
name: Company Commercial Profile
description: Phase 11.6 — /company/* reorganized as a unified commercial/promotional hub (marketplace + ads + sponsorships) with Control Tower dashboard
type: feature
---

`/company/*` is the company's commercial profile inside MoodPlay, separate from `/admin/*` (technical admin) and legacy `/sponsor/*` (kept as alias).

## Structure
- `/company` → redirects to `/company/dashboard`
- `/company/dashboard` (CompanyDashboard) — 5 anchor blocks: Control Tower KPIs, Marketplace, Campanhas/Ads, Resultados, Visibilidade
- `/company/marketplace` · `/produtos` · `/pedidos` → reuse `MyCompany` (legacy monolith)
- `/company/campanhas` · `/performance` · `/visibilidade` → anchors on dashboard
- `/company/sponsor/torneios` · `/sponsor/resumo` → reuse `SponsorTournaments` and `SponsorDashboard` via `CompanySponsorBridge` (Outlet context provider)
- `/company/torneios-patrocinados` (legacy) → kept, also passes through bridge

## Sidebar groups
Control Tower · Marketplace · Campanhas · Performance · Visibilidade

## Data sources (no new tables)
- `companies` (owner_user_id) + `company_plans`
- `products` (company_id)
- `marketplace_orders` (filtered by product_id IN company products)
- `ad_campaigns` (company_id)
- `tournament_sponsorships` (company_id)

## Bug fix
`SponsorDashboard` and `SponsorTournaments` use `useOutletContext()` from `SponsorLayout`. Previous wiring of `/company/campanhas` mounted them without a context provider → silent error. Replaced with bridge or anchor on dashboard.

## Pending (Phase 11.7+)
- Split `/company/produtos` and `/pedidos` into dedicated pages (separate from monolith MyCompany)
- Allow company to create campaigns directly (today admin-only)
- WhatsApp alerts: new order, paused campaign, plan expiring
- Performance charts 30d/90d
- Deprecate `/sponsor/*` and `/marketplace/my-company` via redirects
