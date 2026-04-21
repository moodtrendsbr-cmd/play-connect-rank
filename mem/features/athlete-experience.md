---
name: Athlete Experience (Phase 11.5)
description: Athlete profile reorganized as a mobile-first sports hub at /athlete/dashboard with 5 blocks (Hero, Meu Dia, Torneios, Ranking, Discovery). Reuses existing queries and AthleteActivities component.
type: feature
---

# Athlete Experience — Phase 11.5

The Athlete shell (`/athlete/*`) is mounted via `AthleteShell` and exposes a dedicated dashboard at `/athlete/dashboard` (the index now redirects there).

## Dashboard structure (`src/pages/athlete/AthleteDashboard.tsx`)

5 blocks, mobile-first:
1. **Athlete Hero** — large avatar, name, nickname, city/team/arena + 4 KPIs (Torneios, Vitórias, Check-ins, Ranking) + 3 large CTAs.
2. **Meu Dia** (`#hoje`) — pending check-ins (amber strip) and upcoming tournaments in next 7 days.
3. **Torneios e Jogos** (`#jogos`) — active enrollments + last 5 match results.
4. **Ranking e Histórico** (`#historico`) — ranking position + reused `<AthleteActivities />` component.
5. **Discovery** (`#descobrir`) — open tournaments + arenas via `arenas_public` + shortcuts to feed/marketplace.

## Routing (`src/App.tsx`)

```
/athlete                → redirect to /athlete/dashboard
/athlete/dashboard      → AthleteDashboard
/athlete/perfil         → Profile (legacy, kept)
/athlete/meu-dia        → AthleteDashboard (anchor #hoje)
/athlete/torneios       → Tournaments
/athlete/jogos          → AthleteDashboard (anchor #jogos)
/athlete/ranking        → Ranking
/athlete/historico      → AthleteDashboard (anchor #historico)
/athlete/descobrir      → Explore
/athlete/feed           → Feed
/athlete/mensagens      → Messages
```

## Sidebar (5 groups)

- **Meu Perfil**: Dashboard · Meu perfil
- **Meu Dia**: Hoje · Mensagens
- **Torneios**: Torneios · Meus jogos
- **Ranking & Histórico**: Ranking · Histórico
- **Descobrir**: Descobrir · Feed

## Queries reused (no new tables, no new edge functions)

- `profiles` (full_name, nickname, avatar_url, city, state, team, arena)
- `enrollments` joined with `tournaments` filtered by `user_id`
- `match_results` filtered by `winner_id` (wins) and `winner_id|loser_id` (recent)
- `arenas_public` view for discovery
- `tournaments` with future end_date for open tournaments
- `<AthleteActivities />` component for history timeline

## Constraints

- No backend changes (no migrations, no RLS, no edge, no ORKYM bridge).
- All legacy routes (`/profile`, `/feed`, `/tournaments`, `/ranking`, `/messages`, `/explore`) remain untouched.
- `Profile.tsx` continues to handle athlete profile edition at `/athlete/perfil`.
- Pending for Phase 11.6+: dedicated `/athlete/jogos` calendar page; dedicated `/athlete/historico` stats page; WhatsApp reminders; Profile.tsx split.
