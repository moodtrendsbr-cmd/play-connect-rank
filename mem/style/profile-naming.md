---
name: Profile naming glossary
description: Single source of truth for shell headers, sidebars, dashboard towers and CTAs across the 6 MoodPlay profiles. Defined in src/lib/profileNaming.ts.
type: design
---

Naming oficial (Fase 11.8):

- **MoodPlay** (CamelCase, sem espaço) — nunca "Mood Play".
- **Control Tower** — visão de controle de qualquer perfil. Variantes: Control Tower (Admin), Control Tower da Rede (Tenant), Control Tower da Arena (Arena), Event Control Tower (Organizer), Athlete Hub (Athlete), Company Control Tower (Company).
- **Ações ORKYM** — substitui "Ações sugeridas" e "Ações IA".
- **Autonomia** — substitui "Controle automático" e "Governança IA".
- **Patrocínios** (sempre plural) — substitui sponsor / sponsorship / patrocinador.
- **Campanhas** — substitui ads / publicidade / advertising. Itens legacy ficam como sub-item "Legado".
- **Financeiro** — substitui billing / cobranças / finance.

Headers de shell seguem o formato `[Chip do papel] · [Nome contextual]`:
- Admin · MoodPlay global
- Rede · {tenantName}
- Arena · {arenaName}
- Organizador · MoodPlay
- Atleta · MoodPlay
- Empresa · {companyName}

CTAs canônicos: "Falar com a ORKYM", "Continuar no WhatsApp", "Pedir pelo WhatsApp", "Gerar QR", "Abrir QR", "Ver detalhes".

Use `PROFILE_NAMING`, `SECTION_LABELS` e `CTA_LABELS` de `src/lib/profileNaming.ts` em vez de strings soltas.
