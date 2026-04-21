---
name: social-graph
description: Sistema de perfis públicos de atletas com histórico de atividades e ranking básico (Fase 6)
type: feature
---

Athlete profile reusa `profiles`/`profiles_public` (não há tabela `athlete_profiles`).

**Tabela `athlete_activities`** (append-only) é alimentada por 4 triggers:
- `enrollments` → `tournament.enrolled` (insert) + `tournament.checked_in` (update)
- `modality_matches` → `tournament.match_won`/`tournament.match_lost` por participante
- `arena_attendance` → `class.attended` (status=present)
- `posts`/`clips` → `social.posted`/`social.clip_posted`

**Views públicas (security_invoker=on):**
- `athletes_public` — agrega wins/participations/attendances via LATERAL
- `athlete_activities_public` — feed individual filtrado
- `social_feed_public` — UNION global (posts + activities + ads + tournaments)
- `marketplace_public` — produtos approved + companies approved
- `ads_public` — campanhas ativas com slot info

**RPC `search_global(_term)`** — busca unificada em 4 buckets (athletes/arenas/tournaments/products), ILIKE simples.

Frontend: `/explore` (hub), `/athletes` (ranking), `<AthleteActivities />` em UserProfile.

Sem IA local, sem ranking complexo, sem rede social tipo Instagram. Tabelas base nunca expostas a anon.
